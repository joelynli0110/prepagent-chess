from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import OpponentSpace
from app.dependencies import get_db
from app.schemas.opponent_spaces import OpponentSpaceCreate, OpponentSpaceRead

router = APIRouter(prefix="/opponents", tags=["opponents"])


@router.post("", response_model=OpponentSpaceRead)
def create_opponent_space(
    payload: OpponentSpaceCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> OpponentSpace:
    opponent = OpponentSpace(
        display_name=payload.display_name,
        canonical_name=payload.canonical_name,
        notes=payload.notes,
    )
    db.add(opponent)
    db.commit()
    db.refresh(opponent)

    from app.api.routes.imports import create_onboarding_jobs, run_onboarding_pipeline
    profile_id, cb_id, cc_id = create_onboarding_jobs(
        db, opponent.id, opponent.display_name, canonical_name=opponent.canonical_name
    )
    db.commit()

    background_tasks.add_task(
        run_onboarding_pipeline,
        opponent.id, opponent.display_name,
        profile_id, cb_id, cc_id,
    )

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



@router.delete("", status_code=204)
def delete_all_opponents(db: Session = Depends(get_db)) -> None:
    for opponent in db.scalars(select(OpponentSpace)).all():
        db.delete(opponent)
    db.commit()


@router.delete("/{opponent_id}", status_code=204)
def delete_opponent(opponent_id: str, db: Session = Depends(get_db)) -> None:
    opponent = db.get(OpponentSpace, opponent_id)
    if not opponent:
        raise HTTPException(status_code=404, detail="Opponent space not found")
    db.delete(opponent)
    db.commit()