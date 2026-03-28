"""Report generation endpoints.

Flow:
  POST /generate          → runs orchestrator, pauses, returns plan for review
  POST /{id}/resume       → user approves (optionally adjusts plan), runs pipeline
  GET  /                  → list reports for opponent
  GET  /{id}              → fetch single report
"""
from __future__ import annotations

import logging
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.models import OpponentSpace, Report
from app.db.session import SessionLocal
from app.dependencies import get_db
from app.schemas.reports import ChatRequest, ReportRead, ReportRequest, ResumeRequest
from app.services.agent import prompts, retrieval as retrieval_svc
from app.services.agent.graph import PrepState, _get_chat_llm, prep_graph

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/opponents/{opponent_id}/reports",
    tags=["reports"],
)


# ---------------------------------------------------------------------------
# Background task helpers
# ---------------------------------------------------------------------------

def _run_orchestrator(report_id: str, thread_id: str, initial_state: PrepState) -> None:
    """Run orchestrator node → interrupt (saves plan to Report, status=awaiting_review)."""
    db = SessionLocal()
    try:
        config = {"configurable": {"thread_id": thread_id}}

        # graph.invoke runs until interrupt_before="retrieval"
        result = prep_graph.invoke(initial_state, config)

        plan = result.get("strategy_plan", {})
        report = db.get(Report, report_id)
        if report:
            existing = report.content or {}
            report.content = {**existing, "plan": plan}
            report.status = "awaiting_review"
            db.commit()

    except Exception as exc:
        logger.exception("Orchestrator failed for report %s", report_id)
        _mark_failed(db, report_id, str(exc))
    finally:
        db.close()


_AGENT_LABELS = {
    "scouting":   "Scouting agent — analysing game distribution & time pressure…",
    "pattern":    "Pattern agent — identifying structural tendencies & book deviations…",
    "psychology": "Psychology agent — profiling comfort zones & fatigue patterns…",
    "synthesis":  "Synthesis agent — writing preparation narrative…",
}


def _write_progress(db: Session, report_id: str, node: str) -> None:
    """Persist per-node progress into report.content without touching status."""
    report = db.get(Report, report_id)
    if not report:
        return
    existing = report.content or {}
    existing["current_agent"] = node
    existing["current_agent_label"] = _AGENT_LABELS.get(node, node)
    existing[f"{node}_done"] = True
    report.content = dict(existing)
    db.commit()


def _run_pipeline(report_id: str, thread_id: str, plan_override: dict | None) -> None:
    """Resume graph from checkpoint: scouting → pattern → psychology → synthesis."""
    db = SessionLocal()
    try:
        report = db.get(Report, report_id)
        if report:
            report.status = "running"
            db.commit()

        config = {"configurable": {"thread_id": thread_id}}

        if plan_override:
            prep_graph.update_state(config, {"strategy_plan": plan_override})

        # stream(stream_mode="updates") yields {node_name: state_updates} after
        # each node completes — accumulate into result and write progress each time.
        result: dict = {}
        for chunk in prep_graph.stream(None, config, stream_mode="updates"):
            for node_name, updates in chunk.items():
                result.update(updates)
                _write_progress(db, report_id, node_name)

        report = db.get(Report, report_id)
        if report:
            existing_content = report.content or {}
            report.content = {
                **existing_content,
                "current_agent": None,
                "scouting_report": result.get("scouting_report", {}),
                "pattern_report": result.get("pattern_report", {}),
                "psychology_report": result.get("psychology_report", {}),
                "critical_positions": (result.get("pattern_data") or {}).get("critical_positions", []),
                "opening_stats": (result.get("pattern_data") or {}).get("opening_stats", []),
                "narrative": result.get("narrative", ""),
                "markdown": result.get("report_markdown", ""),
                "opening_tree": result.get("opening_tree", []),
            }
            report.status = "ready"
            db.commit()

    except Exception as exc:
        logger.exception("Pipeline failed for report %s", report_id)
        _mark_failed(db, report_id, str(exc))
    finally:
        db.close()


def _mark_failed(db: Session, report_id: str, error: str) -> None:
    try:
        report = db.get(Report, report_id)
        if report:
            report.status = "failed"
            existing = report.content or {}
            report.content = {**existing, "error": error}
            db.commit()
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/generate", response_model=ReportRead)
def generate_report(
    opponent_id: str,
    req: ReportRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> Report:
    """Start report generation.

    Immediately kicks off the orchestrator in the background, which produces
    a strategy plan and then pauses for human review.  Poll GET /{id} until
    status == "awaiting_review" to see the plan.
    """
    opponent = db.get(OpponentSpace, opponent_id)
    if not opponent:
        raise HTTPException(status_code=404, detail="Opponent space not found")

    thread_id = str(uuid4())

    report = Report(
        opponent_space_id=opponent_id,
        title=f"Prep report — {opponent.display_name}",
        status="draft",
        content={"thread_id": thread_id, "risk_mode": req.risk_mode},
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    # Gather quick summary synchronously (fast DB read) so it's in the state
    quick_summary = retrieval_svc.get_quick_summary(db, opponent_id)

    initial_state: PrepState = {
        "opponent_space_id": opponent_id,
        "risk_mode": req.risk_mode,
        "quick_summary": quick_summary,
        "strategy_plan": {},
        "scouting_data": {},
        "pattern_data": {},
        "psychology_data": {},
        "scouting_report": {},
        "pattern_report": {},
        "psychology_report": {},
        "narrative": "",
        "report_markdown": "",
        "opening_tree": [],
    }

    background_tasks.add_task(_run_orchestrator, report.id, thread_id, initial_state)
    return report


@router.post("/{report_id}/resume", response_model=ReportRead)
def resume_report(
    opponent_id: str,
    report_id: str,
    req: ResumeRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> Report:
    """Approve the strategy plan and run the full pipeline.

    Pass ``plan_adjustments`` to override any fields in the orchestrator's
    plan before resuming; omit it (or pass null) to approve as-is.
    """
    report = db.get(Report, report_id)
    if not report or report.opponent_space_id != opponent_id:
        raise HTTPException(status_code=404, detail="Report not found")
    if report.status not in ("awaiting_review",):
        raise HTTPException(
            status_code=409,
            detail=f"Report is in status '{report.status}', expected 'awaiting_review'",
        )

    thread_id = (report.content or {}).get("thread_id")
    if not thread_id:
        raise HTTPException(status_code=500, detail="Report is missing thread_id")

    # Apply overrides: merge on top of the existing plan
    plan_override: dict | None = None
    if req.plan_adjustments:
        existing_plan = (report.content or {}).get("plan", {})
        plan_override = {**existing_plan, **req.plan_adjustments}

    background_tasks.add_task(_run_pipeline, report.id, thread_id, plan_override)
    return report


@router.get("/", response_model=list[ReportRead])
def list_reports(
    opponent_id: str,
    db: Session = Depends(get_db),
) -> list[Report]:
    """List all reports for this opponent, newest first."""
    opponent = db.get(OpponentSpace, opponent_id)
    if not opponent:
        raise HTTPException(status_code=404, detail="Opponent space not found")
    rows = db.query(Report).filter(
        Report.opponent_space_id == opponent_id
    ).order_by(Report.created_at.desc()).all()
    return rows


@router.get("/{report_id}", response_model=ReportRead)
def get_report(
    opponent_id: str,
    report_id: str,
    db: Session = Depends(get_db),
) -> Report:
    report = db.get(Report, report_id)
    if not report or report.opponent_space_id != opponent_id:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


@router.post("/{report_id}/chat")
def chat_with_report(
    opponent_id: str,
    report_id: str,
    req: ChatRequest,
    db: Session = Depends(get_db),
) -> dict:
    """Ask a question about the report. Uses the report content as context."""
    from langchain_core.messages import HumanMessage, SystemMessage

    report = db.get(Report, report_id)
    if not report or report.opponent_space_id != opponent_id:
        raise HTTPException(status_code=404, detail="Report not found")
    if report.status != "ready":
        raise HTTPException(status_code=409, detail="Report is not ready yet")

    content = report.content or {}

    system_prompt = prompts.CHAT_CONTEXT.format(
        plan=content.get("plan", {}),
        scouting=content.get("scouting_report", {}),
        patterns=content.get("pattern_report", {}),
        psychology=content.get("psychology_report", {}),
        narrative=content.get("narrative", ""),
    )

    try:
        llm = _get_chat_llm()
        response = llm.invoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=req.message),
        ])
        return {"reply": response.content.strip()}
    except Exception as exc:
        logger.exception("Chat failed for report %s", report_id)
        raise HTTPException(status_code=500, detail=str(exc))
