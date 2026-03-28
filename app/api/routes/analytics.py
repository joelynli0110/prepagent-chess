from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Game, Job, JobStatus, JobType, MoveFact, OpponentSpace
from app.dependencies import get_db
from app.schemas.analytics import (
    BlunderSummaryRead,
    OpeningStatRead,
    OpponentAnalyzeRequest,
)
from app.schemas.jobs import JobRead
from app.services.analytics.blunder_patterns import BlunderPatternsService
from app.services.analytics.opening_stats import OpeningStatsService
from app.services.engine.analysis_service import AnalysisService
from app.services.opponents.identity import OpponentIdentityService
from app.services.parsing.opening_utils import detect_opening_from_moves

_opening_stats_service = OpeningStatsService()

router = APIRouter(prefix="/opponents/{opponent_id}", tags=["analytics"])


def _run_analysis(job_id: str, opponent_id: str, payload_dict: dict) -> None:
    from app.db.session import SessionLocal

    db = SessionLocal()
    try:
        job = db.get(Job, job_id)
        if not job:
            return
        job.status = JobStatus.running
        db.commit()

        opponent = db.get(OpponentSpace, opponent_id)
        if not opponent:
            job.status = JobStatus.failed
            job.result = {"error": "Opponent not found"}
            db.commit()
            return

        identity_service = OpponentIdentityService()
        games = list(db.scalars(select(Game).where(Game.opponent_space_id == opponent_id)).all())

        for game in games:
            result = identity_service.infer_side(
                canonical_name=opponent.canonical_name,
                white_name=game.white_name,
                black_name=game.black_name,
            )
            game.opponent_name_in_game = result.matched_name
            game.opponent_side = result.opponent_side

        for game in games:
            moves = list(
                db.scalars(
                    select(MoveFact)
                    .where(MoveFact.game_id == game.id)
                    .order_by(MoveFact.ply.asc())
                ).all()
            )
            eco, opening_name = detect_opening_from_moves([m.san for m in moves])
            if eco:
                game.eco = eco
            if opening_name:
                game.opening_name = opening_name

        db.commit()

        service = AnalysisService()
        analyzed_games, analyzed_positions = service.analyze_opponent(
            db=db,
            opponent_id=opponent_id,
            depth=payload_dict["depth"],
            only_missing=payload_dict.get("only_missing", True),
            job=job,
        )

        # Refresh persisted opening stats now that engine data is available
        _opening_stats_service.refresh(db, opponent_id)

        job.status = JobStatus.completed
        job.result = {
            "analyzed_games": analyzed_games,
            "analyzed_positions": analyzed_positions,
        }
        db.commit()

    except Exception as exc:
        try:
            job = db.get(Job, job_id)
            if job:
                job.status = JobStatus.failed
                job.result = {"error": str(exc)}
                db.commit()
        except Exception:
            pass
    finally:
        db.close()


@router.post("/analyze", response_model=JobRead)
def analyze_opponent(
    opponent_id: str,
    payload: OpponentAnalyzeRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> Job:
    opponent = db.get(OpponentSpace, opponent_id)
    if not opponent:
        raise HTTPException(status_code=404, detail="Opponent space not found")

    job = Job(
        opponent_space_id=opponent_id,
        job_type=JobType.analyze_games,
        status=JobStatus.queued,
        payload=payload.model_dump(),
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    background_tasks.add_task(_run_analysis, job.id, opponent_id, payload.model_dump())
    return job


@router.get("/openings", response_model=list[OpeningStatRead])
def get_openings(opponent_id: str, db: Session = Depends(get_db)) -> list[dict]:
    opponent = db.get(OpponentSpace, opponent_id)
    if not opponent:
        raise HTTPException(status_code=404, detail="Opponent space not found")
    return _opening_stats_service.get(db, opponent_id)


@router.post("/openings/refresh", response_model=list[OpeningStatRead])
def refresh_openings(opponent_id: str, db: Session = Depends(get_db)) -> list[dict]:
    """Recompute and persist opening stats from current games + analysis data."""
    opponent = db.get(OpponentSpace, opponent_id)
    if not opponent:
        raise HTTPException(status_code=404, detail="Opponent space not found")
    return _opening_stats_service.refresh(db, opponent_id)


@router.get("/blunders", response_model=list[BlunderSummaryRead])
def get_blunders(opponent_id: str, db: Session = Depends(get_db)) -> list[dict]:
    opponent = db.get(OpponentSpace, opponent_id)
    if not opponent:
        raise HTTPException(status_code=404, detail="Opponent space not found")

    service = BlunderPatternsService()
    return service.compute(db, opponent_id)