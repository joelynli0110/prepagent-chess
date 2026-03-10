from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import EngineAnalysis, Game, MoveFact, OpponentSpace
from app.dependencies import get_db
from app.schemas.games import (
    AnalyzeGameRequest,
    AnalyzeGameResponse,
    EngineAnalysisRead,
    GameRead,
    MoveFactRead,
)
from app.services.engine.analysis_service import AnalysisService

router = APIRouter(tags=["games"])


@router.get("/opponents/{opponent_id}/games", response_model=list[GameRead])
def list_games(opponent_id: str, db: Session = Depends(get_db)) -> list[Game]:
    opponent = db.get(OpponentSpace, opponent_id)
    if not opponent:
        raise HTTPException(status_code=404, detail="Opponent space not found")

    stmt = (
        select(Game)
        .where(Game.opponent_space_id == opponent_id)
        .order_by(Game.date_played.desc().nullslast(), Game.created_at.desc())
    )
    return list(db.scalars(stmt).all())


@router.get("/games/{game_id}", response_model=GameRead)
def get_game(game_id: str, db: Session = Depends(get_db)) -> Game:
    game = db.get(Game, game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    return game


@router.get("/games/{game_id}/moves", response_model=list[MoveFactRead])
def get_game_moves(game_id: str, db: Session = Depends(get_db)) -> list[MoveFact]:
    game = db.get(Game, game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    stmt = select(MoveFact).where(MoveFact.game_id == game_id).order_by(MoveFact.ply.asc())
    return list(db.scalars(stmt).all())


@router.get("/games/{game_id}/analysis", response_model=list[EngineAnalysisRead])
def get_game_analysis(game_id: str, db: Session = Depends(get_db)) -> list[EngineAnalysis]:
    game = db.get(Game, game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    stmt = select(EngineAnalysis).where(EngineAnalysis.game_id == game_id).order_by(EngineAnalysis.ply.asc())
    return list(db.scalars(stmt).all())


@router.post("/games/{game_id}/analyze", response_model=AnalyzeGameResponse)
def analyze_game(game_id: str, payload: AnalyzeGameRequest, db: Session = Depends(get_db)) -> AnalyzeGameResponse:
    game = db.get(Game, game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    service = AnalysisService()
    try:
        analyzed_positions = service.analyze_game(
            db=db,
            game_id=game_id,
            depth=payload.depth,
            max_plies=payload.max_plies,
        )
    except FileNotFoundError:
        raise HTTPException(
            status_code=500,
            detail="Stockfish binary not found. Check STOCKFISH_PATH in your environment.",
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Engine analysis failed: {exc}")

    return AnalyzeGameResponse(
        game_id=game_id,
        analyzed_positions=analyzed_positions,
        depth=payload.depth,
    )