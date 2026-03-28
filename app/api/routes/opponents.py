from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import OpponentSpace
from app.dependencies import get_db
from app.schemas.opponent_spaces import OpponentSpaceCreate, OpponentSpaceRead

router = APIRouter(prefix="/opponents", tags=["opponents"])


@router.post("", response_model=OpponentSpaceRead)
def create_opponent_space(payload: OpponentSpaceCreate, db: Session = Depends(get_db)) -> OpponentSpace:
    opponent = OpponentSpace(
        display_name=payload.display_name,
        canonical_name=payload.canonical_name,
        notes=payload.notes,
    )
    db.add(opponent)
    db.commit()
    db.refresh(opponent)
    return opponent


@router.get("", response_model=list[OpponentSpaceRead])
def list_opponents(db: Session = Depends(get_db)) -> list[OpponentSpace]:
    return list(db.scalars(select(OpponentSpace)).all())


@router.get("/{opponent_id}", response_model=OpponentSpaceRead)
def get_opponent(opponent_id: str, db: Session = Depends(get_db)) -> OpponentSpace:
    opponent = db.get(OpponentSpace, opponent_id)
    if not opponent:
        raise HTTPException(status_code=404, detail="Opponent space not found")
    return opponent


@router.post("/{opponent_id}/profile/refresh", response_model=OpponentSpaceRead)
def refresh_profile(opponent_id: str, db: Session = Depends(get_db)) -> OpponentSpace:
    """Re-fetch and store profile data from FIDE + Chess.com."""
    from app.api.routes.imports import _store_player_profile

    opponent = db.get(OpponentSpace, opponent_id)
    if not opponent:
        raise HTTPException(status_code=404, detail="Opponent space not found")
    _store_player_profile(db, opponent)
    db.refresh(opponent)
    return opponent


@router.delete("/{opponent_id}", status_code=204)
def delete_opponent(opponent_id: str, db: Session = Depends(get_db)) -> None:
    opponent = db.get(OpponentSpace, opponent_id)
    if not opponent:
        raise HTTPException(status_code=404, detail="Opponent space not found")
    db.delete(opponent)
    db.commit()