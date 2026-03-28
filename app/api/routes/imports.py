import urllib.error

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.models import Job, JobStatus, JobType, OpponentSpace
from app.dependencies import get_db
from app.schemas.jobs import JobRead
from app.services.imports.chessbase_fetcher import fetch_pgn, parse_player_slug
from app.services.imports.lichess_fetcher import fetch_pgn as lichess_fetch_pgn
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
    max_games: int = 100


@router.get("/search-platforms", response_model=list[dict])
def search_platforms(opponent_id: str, db: Session = Depends(get_db)) -> list[dict]:
    """Search Lichess and Chess.com for accounts matching the opponent's real name."""
    opponent = db.get(OpponentSpace, opponent_id)
    if not opponent:
        raise HTTPException(status_code=404, detail="Opponent space not found")
    return search_all(opponent.display_name)


@router.post("/lichess", response_model=JobRead)
def import_lichess(
    opponent_id: str,
    payload: PlatformImportRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> Job:
    opponent = db.get(OpponentSpace, opponent_id)
    if not opponent:
        raise HTTPException(status_code=404, detail="Opponent space not found")

    try:
        pgn_text = lichess_fetch_pgn(payload.username, max_games=payload.max_games)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Lichess fetch failed: {exc}")

    if not pgn_text.strip():
        raise HTTPException(status_code=404, detail=f"No games found for Lichess user {payload.username!r}")

    job = Job(
        opponent_space_id=opponent_id,
        job_type=JobType.import_pgn,
        status=JobStatus.queued,
        payload={"source": "lichess", "username": payload.username},
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    background_tasks.add_task(_run_import_job, job.id, opponent_id, pgn_text, "lichess")
    return job


def _derive_chessbase_slug(display_name: str) -> str | None:
    """'Magnus Carlsen' → 'Carlsen_Magnus' (ChessBase slug format)."""
    parts = display_name.replace(",", " ").split()
    parts = [p.strip() for p in parts if p.strip()]
    if len(parts) >= 2:
        return f"{parts[-1].title()}_{parts[0].title()}"
    return None


def _run_auto_platform_import(job_id: str, opponent_id: str, platform: str, username: str) -> None:
    from app.db.session import SessionLocal
    db = SessionLocal()
    try:
        job = db.get(Job, job_id)
        if not job:
            return
        try:
            if platform == "lichess":
                pgn_text = lichess_fetch_pgn(username, max_games=200)
            else:
                pgn_text = chesscom_fetch_pgn(username, max_games=200)
            if not pgn_text.strip():
                job.status = JobStatus.failed
                job.result = {"error": f"No games found for {platform} user {username!r}"}
                db.commit()
                return
            process_pgn_import_job(db, job, opponent_id, pgn_text, source=platform)
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
    One-shot import: derive ChessBase slug from the opponent name, search
    Chess.com and Lichess for verified/titled accounts, and kick off a
    background import job for every source found.
    """
    opponent = db.get(OpponentSpace, opponent_id)
    if not opponent:
        raise HTTPException(status_code=404, detail="Opponent space not found")

    created_jobs: list[Job] = []

    # ChessBase — slug derived from name, no network call needed
    slug = _derive_chessbase_slug(opponent.display_name)
    if slug:
        job = Job(
            opponent_space_id=opponent_id,
            job_type=JobType.import_pgn,
            status=JobStatus.queued,
            payload={"source": "chessbase", "slug": slug},
        )
        db.add(job)
        db.flush()
        created_jobs.append(job)
        background_tasks.add_task(_run_auto_chessbase_import, job.id, opponent_id, slug)

    # Chess.com + Lichess — network search, returns only verified/titled players
    accounts = search_all(opponent.display_name)
    for acc in accounts:
        platform = acc["platform"]
        username = acc["username"]
        job = Job(
            opponent_space_id=opponent_id,
            job_type=JobType.import_pgn,
            status=JobStatus.queued,
            payload={"source": platform, "username": username},
        )
        db.add(job)
        db.flush()
        created_jobs.append(job)
        background_tasks.add_task(
            _run_auto_platform_import, job.id, opponent_id, platform, username
        )

    db.commit()
    for job in created_jobs:
        db.refresh(job)

    # Build and store player profile (FIDE + Chess.com)
    _store_player_profile(db, opponent)

    return created_jobs


def _store_player_profile(db: Session, opponent: OpponentSpace) -> None:
    """Fetch profile data from FIDE + Chess.com and persist it on the opponent."""
    profile = build_player_profile(opponent.display_name)
    if not profile:
        return
    opponent.profile_data = profile
    db.commit()


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

    try:
        pgn_text = chesscom_fetch_pgn(payload.username, max_games=payload.max_games)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Chess.com fetch failed: {exc}")

    if not pgn_text.strip():
        raise HTTPException(status_code=404, detail=f"No games found for Chess.com user {payload.username!r}")

    job = Job(
        opponent_space_id=opponent_id,
        job_type=JobType.import_pgn,
        status=JobStatus.queued,
        payload={"source": "chesscom", "username": payload.username},
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    background_tasks.add_task(_run_import_job, job.id, opponent_id, pgn_text, "chesscom")
    return job