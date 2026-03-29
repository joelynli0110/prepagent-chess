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
from app.schemas.reports import ChatRequest, ReportRead, ReportRequest, ResumeRequest, TranslateRequest
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
    "synthesis": "Synthesis agent — writing preparation narrative…",
}

# Parallel agents: these run concurrently so we track done flags only,
# not a single "current_agent" label.
_PARALLEL_AGENTS = {"scouting", "pattern", "psychology"}


def _write_progress(db: Session, report_id: str, node: str) -> None:
    """Persist per-node progress into report.content without touching status."""
    report = db.get(Report, report_id)
    if not report:
        return
    existing = report.content or {}
    existing[f"{node}_done"] = True
    # Only show a label for synthesis (sequential); parallel agents show via done flags
    if node not in _PARALLEL_AGENTS:
        existing["current_agent"] = node
        existing["current_agent_label"] = _AGENT_LABELS.get(node, node)
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


# Google Translate language codes for our supported languages
_GT_LANG_CODES: dict[str, str] = {
    "en": "en",
    "es": "es",
    "fr": "fr",
    "de": "de",
    "it": "it",
    "zh": "zh-CN",
    "ja": "ja",
}


def _gt(text: str, target: str) -> str:
    """Translate a non-empty string via Google Translate. Returns original on empty."""
    if not text or not text.strip():
        return text
    from deep_translator import GoogleTranslator
    return GoogleTranslator(source="auto", target=target).translate(text) or text


def _gt_list(items: list, target: str) -> list:
    """Translate a list of strings via Google Translate."""
    if not items:
        return items
    from deep_translator import GoogleTranslator
    translator = GoogleTranslator(source="auto", target=target)
    return [translator.translate(item) or item for item in items if item]


@router.post("/{report_id}/translate")
def translate_report(
    opponent_id: str,
    report_id: str,
    req: TranslateRequest,
    db: Session = Depends(get_db),
) -> dict:
    """Translate the report to the requested language using Google Translate."""
    report = db.get(Report, report_id)
    if not report or report.opponent_space_id != opponent_id:
        raise HTTPException(status_code=404, detail="Report not found")
    if report.status != "ready":
        raise HTTPException(status_code=409, detail="Report is not ready yet")

    lang_code = _GT_LANG_CODES.get(req.target_language, req.target_language)

    content = report.content or {}
    narrative = content.get("narrative", "") or content.get("markdown", "") or ""
    plan = content.get("plan") or {}
    scouting = content.get("scouting_report") or {}
    pattern = content.get("pattern_report") or {}
    psychology = content.get("psychology_report") or {}

    try:
        return {
            "narrative": _gt(narrative, lang_code),
            "plan": {
                "focus_areas": _gt_list(plan.get("focus_areas") or [], lang_code),
                "phase_weakness": _gt(plan.get("phase_weakness") or "", lang_code),
                "prep_priority": _gt(plan.get("prep_priority") or "", lang_code),
                "risk_notes": _gt(plan.get("risk_notes") or "", lang_code),
            },
            "scouting": {
                "time_pressure_insight": _gt(scouting.get("time_pressure_insight") or "", lang_code),
                "rating_insight": _gt(scouting.get("rating_insight") or "", lang_code),
                "key_findings": _gt_list(scouting.get("key_findings") or [], lang_code),
            },
            "pattern": {
                "structural_tendencies": _gt_list(pattern.get("structural_tendencies") or [], lang_code),
                "recurring_error_patterns": _gt_list(pattern.get("recurring_error_patterns") or [], lang_code),
                "exploit_positions": _gt_list(pattern.get("exploit_positions") or [], lang_code),
            },
            "psychology": {
                "psychological_profile": _gt(psychology.get("psychological_profile") or "", lang_code),
                "exploit_strategy": _gt(psychology.get("exploit_strategy") or "", lang_code),
                "color_insight": _gt(psychology.get("color_insight") or "", lang_code),
                "fatigue_insight": _gt(psychology.get("fatigue_insight") or "", lang_code),
            },
        }
    except Exception as exc:
        logger.exception("Translation failed for report %s", report_id)
        raise HTTPException(status_code=500, detail=str(exc))


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
