from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Game, OpponentSpace
from app.dependencies import get_db
from app.services.opponents.identity import OpponentIdentityService

router = APIRouter(prefix="/opponents/{opponent_id}", tags=["identity"])


@router.post("/recompute-identity")
def recompute_identity(opponent_id: str, db: Session = Depends(get_db)) -> dict:
    opponent = db.get(OpponentSpace, opponent_id)
    if not opponent:
        raise HTTPException(status_code=404, detail="Opponent space not found")

    games = list(
        db.scalars(
            select(Game).where(Game.opponent_space_id == opponent_id)
        ).all()
    )

    service = OpponentIdentityService()
    updated = 0
    for game in games:
        result = service.infer_side(
            canonical_name=opponent.canonical_name,
            white_name=game.white_name,
            black_name=game.black_name,
        )
        game.opponent_name_in_game = result.matched_name
        game.opponent_side = result.opponent_side
        updated += 1

    db.commit()
    return {"updated_games": updated}