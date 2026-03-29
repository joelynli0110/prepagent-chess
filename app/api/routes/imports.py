import urllib.error

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.models import Job, JobStatus, JobType, OpponentSpace
from app.dependencies import get_db
from app.schemas.jobs import JobRead
from app.services.imports.chessbase_fetcher import fetch_pgn, parse_player_slug
from app.services.imports.chesscom_fetcher import fetch_pgn as chesscom_fetch_pgn
from app.services.imports.platform_search import build_player_profile, search_all
from app.services.jobs.import_jobs import process_pgn_import_job

router = APIRouter(prefix="/opponents/{opponent_id}/imports", tags=["imports"])


@router.post("/pgn", response_model=JobRead)
def import_pgn(
    opponent_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> Job:
    opponent = db.get(OpponentSpace, opponent_id)
    if not opponent:
        raise HTTPException(status_code=404, detail="Opponent space not found")

    raw = file.file.read()
    try:
        pgn_text = raw.decode("utf-8")
    except UnicodeDecodeError:
        pgn_text = raw.decode("latin-1")

    job = Job(
        opponent_space_id=opponent_id,
        job_type=JobType.import_pgn,
        status=JobStatus.queued,
        payload={"filename": file.filename},
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    background_tasks.add_task(_run_import_job, job.id, opponent_id, pgn_text)
    return job



def _run_import_job(job_id: str, opponent_id: str, pgn_text: str, source: str = "upload") -> None:
    from app.db.session import SessionLocal

    db = SessionLocal()
    try:
        job = db.get(Job, job_id)
        if not job:
            return
        process_pgn_import_job(db, job, opponent_id, pgn_text, source=source)
    finally:
        db.close()


class ChessbaseImportRequest(BaseModel):
    url: str


@router.post("/chessbase", response_model=JobRead)
def import_chessbase(
    opponent_id: str,
    payload: ChessbaseImportRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> Job:
    opponent = db.get(OpponentSpace, opponent_id)
    if not opponent:
        raise HTTPException(status_code=404, detail="Opponent space not found")

    try:
        slug, pgn_text = fetch_pgn(payload.url)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except urllib.error.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"ChessBase fetch failed: {exc}")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not fetch PGN from ChessBase: {exc}")

    job = Job(
        opponent_space_id=opponent_id,
        job_type=JobType.import_pgn,
        status=JobStatus.queued,
        payload={"source": "chessbase", "slug": slug},
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    background_tasks.add_task(_run_import_job, job.id, opponent_id, pgn_text, "chessbase")
    return job


class PlatformImportRequest(BaseModel):
    username: str
    max_games: int = 500


@router.get("/search-platforms", response_model=list[dict])
def search_platforms(opponent_id: str, db: Session = Depends(get_db)) -> list[dict]:
    """Search Chess.com for accounts matching the opponent's real name."""
    opponent = db.get(OpponentSpace, opponent_id)
    if not opponent:
        raise HTTPException(status_code=404, detail="Opponent space not found")
    return search_all(opponent.display_name)


@router.post("/chesscom", response_model=JobRead)
def import_chesscom(
    opponent_id: str,
    payload: PlatformImportRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> Job:
    opponent = db.get(OpponentSpace, opponent_id)
    if not opponent:
        raise HTTPException(status_code=404, detail="Opponent space not found")

    # Accept full URL like https://www.chess.com/member/hikaru/games or just username
    username = payload.username.strip().rstrip("/")
    if "chess.com" in username:
        # Extract username from URL: /member/{username}[/...]
        import re as _re
        m = _re.search(r"/member/([^/?\s]+)", username)
        if not m:
            raise HTTPException(status_code=422, detail="Could not extract username from Chess.com URL")
        username = m.group(1)

    try:
        pgn_text = chesscom_fetch_pgn(username, max_games=payload.max_games)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Chess.com fetch failed: {exc}")

    if not pgn_text.strip():
        raise HTTPException(status_code=404, detail=f"No games found for Chess.com user {username!r}")

    job = Job(
        opponent_space_id=opponent_id,
        job_type=JobType.import_pgn,
        status=JobStatus.queued,
        payload={"source": "chesscom", "username": username},
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    background_tasks.add_task(_run_import_job, job.id, opponent_id, pgn_text, "chesscom")
    return job


def _derive_chessbase_slug(display_name: str) -> str | None:
    """'Magnus Carlsen' → 'Carlsen_Magnus' (ChessBase slug format)."""
    parts = display_name.replace(",", " ").split()
    parts = [p.strip() for p in parts if p.strip()]
    if len(parts) >= 2:
        return f"{parts[-1].title()}_{parts[0].title()}"
    return None


def _bg_chesscom_scout(job_id: str, opponent_id: str, display_name: str) -> None:
    """
    Background task: search Chess.com for the player by name, update the
    placeholder job with the found username, then fetch and import their games.

    Uses an agentic approach:
      1. Look up the player's FIDE title (GM/IM/FM/…) if available.
      2. Fetch Chess.com's titled-player list for that title.
      3. Find the username whose profile name matches the opponent.
    """
    from app.db.session import SessionLocal
    from app.services.imports.platform_search import search_chesscom, search_fide_players
    db = SessionLocal()
    try:
        job = db.get(Job, job_id)
        if not job:
            return
        try:
            # Step 1: get title hint from FIDE to narrow the Chess.com titled list
            title_hint: str | None = None
            fide_results = search_fide_players(display_name, max_results=1)
            if fide_results:
                title_hint = fide_results[0].get("title")  # e.g. "GM"

            accounts = search_chesscom(display_name, title_hint=title_hint)
            if not accounts:
                job.status = JobStatus.failed
                job.result = {"error": f"No Chess.com account found for {display_name!r}"}
                db.commit()
                return

            username = accounts[0]["username"]
            # Update placeholder with the discovered username
            job.payload = {"source": "chesscom", "username": username}
            job.status = JobStatus.running
            db.commit()

            pgn_text = chesscom_fetch_pgn(username, max_games=500)
            if not pgn_text.strip():
                job.status = JobStatus.failed
                job.result = {"error": f"No games found for Chess.com user {username!r}"}
                db.commit()
                return
            process_pgn_import_job(db, job, opponent_id, pgn_text, source="chesscom")
        except Exception as exc:
            job.status = JobStatus.failed
            job.result = {"error": str(exc)}
            db.commit()
    finally:
        db.close()


def _run_auto_chessbase_import(job_id: str, opponent_id: str, slug: str) -> None:
    from app.db.session import SessionLocal
    db = SessionLocal()
    try:
        job = db.get(Job, job_id)
        if not job:
            return
        try:
            _, pgn_text = fetch_pgn(slug)
            process_pgn_import_job(db, job, opponent_id, pgn_text, source="chessbase")
        except Exception as exc:
            job.status = JobStatus.failed
            job.result = {"error": str(exc)}
            db.commit()
    finally:
        db.close()


@router.get("/jobs", response_model=list[JobRead])
def list_import_jobs(opponent_id: str, db: Session = Depends(get_db)) -> list[Job]:
    """Return all import jobs for this opponent, newest first."""
    opponent = db.get(OpponentSpace, opponent_id)
    if not opponent:
        raise HTTPException(status_code=404, detail="Opponent space not found")
    return sorted(opponent.jobs, key=lambda j: j.created_at, reverse=True)


@router.post("/auto", response_model=list[JobRead])
def import_auto(
    opponent_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> list[Job]:
    """
    Scout an opponent: fetch FIDE profile, search Chess.com for their account,
    and import games from ChessBase and Chess.com in background jobs.
    Returns immediately with the list of queued jobs.
    """
    opponent = db.get(OpponentSpace, opponent_id)
    if not opponent:
        raise HTTPException(status_code=404, detail="Opponent space not found")

    created_jobs: list[Job] = []
    display_name = opponent.display_name

    # ChessBase — slug derived from name, no network call needed upfront
    slug = _derive_chessbase_slug(display_name)
    if slug:
        cb_job = Job(
            opponent_space_id=opponent_id,
            job_type=JobType.import_pgn,
            status=JobStatus.queued,
            payload={"source": "chessbase", "slug": slug},
        )
        db.add(cb_job)
        db.flush()
        created_jobs.append(cb_job)
        background_tasks.add_task(_run_auto_chessbase_import, cb_job.id, opponent_id, slug)

    # Chess.com — create placeholder job now; background task searches by name
    # then updates the job with the discovered username before importing
    cc_job = Job(
        opponent_space_id=opponent_id,
        job_type=JobType.import_pgn,
        status=JobStatus.queued,
        payload={"source": "chesscom", "username": None},
    )
    db.add(cc_job)
    db.flush()
    created_jobs.append(cc_job)
    background_tasks.add_task(_bg_chesscom_scout, cc_job.id, opponent_id, display_name)

    db.commit()
    for job in created_jobs:
        db.refresh(job)

    # FIDE profile — background task, doesn't block the response
    background_tasks.add_task(_bg_store_player_profile, opponent_id, display_name)

    return created_jobs


def _bg_store_player_profile(opponent_id: str, display_name: str) -> None:
    """Background task: fetch FIDE profile and persist it on the opponent."""
    from app.db.session import SessionLocal
    db = SessionLocal()
    try:
        opponent = db.get(OpponentSpace, opponent_id)
        if not opponent:
            return
        profile = build_player_profile(display_name)
        if not profile:
            return
        opponent.profile_data = profile
        db.commit()
    finally:
        db.close()


