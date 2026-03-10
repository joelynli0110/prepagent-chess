from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.models import OpponentSpace
from app.dependencies import get_db
from app.schemas.analytics import (
    BlunderSummaryRead,
    OpeningStatRead,
    OpponentAnalyzeRequest,
    OpponentAnalyzeResponse,
)
from app.services.analytics.blunder_patterns import BlunderPatternsService
from app.services.analytics.opening_stats import OpeningStatsService
from app.services.engine.analysis_service import AnalysisService

router = APIRouter(prefix="/opponents/{opponent_id}", tags=["analytics"])


@router.post("/analyze", response_model=OpponentAnalyzeResponse)
def analyze_opponent(opponent_id: str, payload: OpponentAnalyzeRequest, db: Session = Depends(get_db)) -> OpponentAnalyzeResponse:
    opponent = db.get(OpponentSpace, opponent_id)
    if not opponent:
        raise HTTPException(status_code=404, detail="Opponent space not found")

    service = AnalysisService()
    try:
        analyzed_games, analyzed_positions = service.analyze_opponent(
            db=db,
            opponent_id=opponent_id,
            depth=payload.depth,
            max_games=payload.max_games,
            max_plies=payload.max_plies,
            only_missing=payload.only_missing,
        )
    except FileNotFoundError:
        raise HTTPException(
            status_code=500,
            detail="Stockfish binary not found. Check STOCKFISH_PATH in your environment.",
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Opponent analysis failed: {exc}")

    requested_games = len(opponent.games)
    if payload.max_games is not None:
        requested_games = min(requested_games, payload.max_games)

    return OpponentAnalyzeResponse(
        opponent_id=opponent_id,
        requested_games=requested_games,
        analyzed_games=analyzed_games,
        analyzed_positions=analyzed_positions,
        depth=payload.depth,
    )


@router.get("/openings", response_model=list[OpeningStatRead])
def get_openings(opponent_id: str, db: Session = Depends(get_db)) -> list[dict]:
    opponent = db.get(OpponentSpace, opponent_id)
    if not opponent:
        raise HTTPException(status_code=404, detail="Opponent space not found")

    service = OpeningStatsService()
    return service.compute(db, opponent_id)


@router.get("/blunders", response_model=list[BlunderSummaryRead])
def get_blunders(opponent_id: str, db: Session = Depends(get_db)) -> list[dict]:
    opponent = db.get(OpponentSpace, opponent_id)
    if not opponent:
        raise HTTPException(status_code=404, detail="Opponent space not found")

    service = BlunderPatternsService()
    return service.compute(db, opponent_id)