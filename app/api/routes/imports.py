from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.db.models import Job, JobStatus, JobType, OpponentSpace
from app.dependencies import get_db
from app.schemas.jobs import JobRead
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



def _run_import_job(job_id: str, opponent_id: str, pgn_text: str) -> None:
    from app.db.session import SessionLocal

    db = SessionLocal()
    try:
        job = db.get(Job, job_id)
        if not job:
            return
        process_pgn_import_job(db, job, opponent_id, pgn_text)
    finally:
        db.close()