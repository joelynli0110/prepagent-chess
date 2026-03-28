"""LangGraph pipeline for chess preparation report generation.

Graph flow:
  orchestrator ──[interrupt_before="scouting"]──► scouting (Scouting Agent)
                                                       │
                                                   pattern (Pattern Agent)
                                                       │
                                                  psychology (Psychology Agent)
                                                       │
                                                   synthesis (Synthesis Agent)
                                                       │
                                                      END

The interrupt lets the user review and optionally adjust the strategy plan
before the three specialist agents run.
"""
from __future__ import annotations

import json
import logging
from typing import Any, TypedDict

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, StateGraph

from app.config import settings
from app.services.agent import prompts, retrieval

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# State
# ---------------------------------------------------------------------------

class PrepState(TypedDict, total=False):
    opponent_space_id: str
    risk_mode: str                  # "need_win" | "balanced" | "draw_ok"
    quick_summary: dict[str, Any]   # passed in at generation time
    strategy_plan: dict[str, Any]   # produced by orchestrator
    # Raw data gathered by Scouting Agent
    scouting_data: dict[str, Any]
    pattern_data: dict[str, Any]
    psychology_data: dict[str, Any]
    # LLM reports from each specialist agent
    scouting_report: dict[str, Any]
    pattern_report: dict[str, Any]
    psychology_report: dict[str, Any]
    # Synthesis outputs
    narrative: str
    report_markdown: str
    opening_tree: list[dict]


# ---------------------------------------------------------------------------
# LLM factory — switches between Anthropic and Ollama via LLM_PROVIDER env
# ---------------------------------------------------------------------------

def _make_llm(model: str, ollama_model: str, temperature: float = 0.3) -> BaseChatModel:
    if settings.llm_provider == "anthropic":
        from langchain_anthropic import ChatAnthropic
        return ChatAnthropic(
            model=model,
            api_key=settings.anthropic_api_key,
            temperature=temperature,
            max_tokens=4096,
        )
    from langchain_ollama import ChatOllama
    return ChatOllama(
        model=ollama_model,
        base_url=settings.ollama_base_url,
        temperature=temperature,
    )


def _get_chat_llm() -> BaseChatModel:
    return _make_llm(settings.chat_model, settings.ollama_chat_model, temperature=0.2)


def _get_analyst_llm() -> BaseChatModel:
    return _make_llm(settings.tagger_model, settings.ollama_tagger_model, temperature=0.0)


def _get_report_llm() -> BaseChatModel:
    return _make_llm(settings.report_model, settings.ollama_report_model, temperature=0.4)


def _parse_json(raw: str, fallback: Any) -> Any:
    """Strip markdown fences and parse JSON, returning fallback on failure."""
    raw = raw.strip()
    if raw.startswith("```"):
        parts = raw.split("```", 2)
        raw = parts[1] if len(parts) >= 2 else raw
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip().rstrip("`").strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("JSON parse failed; raw=%s…", raw[:120])
        return fallback


# ---------------------------------------------------------------------------
# Node: Orchestrator
# ---------------------------------------------------------------------------

def orchestrator_node(state: PrepState) -> dict:
    """Plan the preparation strategy from the quick summary.

    Pure LLM step — no DB calls. Completes before the human-in-the-loop
    interrupt so the user can review and adjust before expensive agents run.
    """
    summary = state.get("quick_summary", {})
    risk_mode = state.get("risk_mode", "balanced")

    prompt = prompts.ORCHESTRATOR_PROMPT.format(
        name=summary.get("name", "Unknown"),
        title=summary.get("title") or "—",
        rating=summary.get("rating_std") or "—",
        game_count=summary.get("game_count", 0),
        risk_mode=risk_mode,
        openings=json.dumps(summary.get("top_openings", []), indent=2),
    )

    llm = _get_chat_llm()
    response = llm.invoke([
        SystemMessage(content=prompts.ORCHESTRATOR_SYSTEM),
        HumanMessage(content=prompt),
    ])

    plan = _parse_json(response.content, {"raw": response.content.strip()})
    return {"strategy_plan": plan}


# ---------------------------------------------------------------------------
# Node: Scouting Agent
# ---------------------------------------------------------------------------

def scouting_node(state: PrepState) -> dict:
    """Fetch raw game data from DB then produce a scouting LLM report.

    Covers time control distribution, rating bracket performance, and
    time-pressure collapse events.
    """
    from app.db.session import SessionLocal

    space_id = state["opponent_space_id"]
    db = SessionLocal()
    try:
        data = retrieval.get_scouting_data(db, space_id)
    finally:
        db.close()

    prompt = prompts.SCOUTING_PROMPT.format(
        time_control_breakdown=json.dumps(data["time_control_breakdown"], indent=2),
        rating_bracket_breakdown=json.dumps(data["rating_bracket_breakdown"], indent=2),
        pressure_rate=data["time_pressure_blunder_rate_pct"],
        normal_rate=data["normal_blunder_rate_pct"],
        pressure_multiplier=data.get("pressure_multiplier", "N/A"),
        time_pressure_sample=json.dumps(data["time_pressure_sample"], indent=2),
        total_games=data["total_games"],
    )

    llm = _get_analyst_llm()
    response = llm.invoke([
        SystemMessage(content=prompts.SCOUTING_SYSTEM),
        HumanMessage(content=prompt),
    ])

    report = _parse_json(response.content, {"raw": response.content.strip()})
    return {"scouting_data": data, "scouting_report": report}


# ---------------------------------------------------------------------------
# Node: Pattern Agent
# ---------------------------------------------------------------------------

def pattern_node(state: PrepState) -> dict:
    """Fetch structural/positional evidence then produce a pattern LLM report.

    Covers opening stats, book deviation habits, phase-wise error distribution,
    and critical positions (highest-CPL blunders with FEN).
    """
    from app.db.session import SessionLocal

    space_id = state["opponent_space_id"]
    db = SessionLocal()
    try:
        data = retrieval.get_pattern_data(db, space_id)
    finally:
        db.close()

    prompt = prompts.PATTERN_PROMPT.format(
        opening_stats=json.dumps(data["opening_stats"], indent=2),
        book_deviations=json.dumps(data["book_deviations"], indent=2),
        phase_distribution=json.dumps(data["phase_distribution"], indent=2),
        critical_positions=json.dumps(
            [{k: v for k, v in p.items() if k != "fen_before"} for p in data["critical_positions"]],
            indent=2,
        ),
    )

    llm = _get_analyst_llm()
    response = llm.invoke([
        SystemMessage(content=prompts.PATTERN_SYSTEM),
        HumanMessage(content=prompt),
    ])

    report = _parse_json(response.content, {"raw": response.content.strip()})
    return {"pattern_data": data, "pattern_report": report}


# ---------------------------------------------------------------------------
# Node: Psychology Agent
# ---------------------------------------------------------------------------

def psychology_node(state: PrepState) -> dict:
    """Fetch behavioral data then produce a psychology LLM report.

    Covers color preference, comfort/discomfort openings, and blunder timing.
    """
    from app.db.session import SessionLocal

    space_id = state["opponent_space_id"]
    db = SessionLocal()
    try:
        data = retrieval.get_psychology_data(db, space_id)
    finally:
        db.close()

    prompt = prompts.PSYCHOLOGY_PROMPT.format(
        color_stats=json.dumps(data["color_stats"], indent=2),
        comfort_openings=json.dumps(data["comfort_openings"], indent=2),
        discomfort_openings=json.dumps(data["discomfort_openings"], indent=2),
        blunder_by_move=json.dumps(data["blunder_by_move_number"], indent=2),
        blunder_by_round=json.dumps(data["blunder_by_round"], indent=2) if data["has_round_data"] else "null",
        win_by_round=json.dumps(data["win_by_round"], indent=2) if data["has_round_data"] else "null",
    )

    llm = _get_analyst_llm()
    response = llm.invoke([
        SystemMessage(content=prompts.PSYCHOLOGY_SYSTEM),
        HumanMessage(content=prompt),
    ])

    report = _parse_json(response.content, {"raw": response.content.strip()})
    return {"psychology_data": data, "psychology_report": report}


# ---------------------------------------------------------------------------
# Node: Synthesis Agent
# ---------------------------------------------------------------------------

def synthesis_node(state: PrepState) -> dict:
    """Combine all three agent reports into a unified prep narrative + opening tree."""
    prompt = prompts.SYNTHESIS_PROMPT.format(
        risk_mode=state.get("risk_mode", "balanced"),
        plan=json.dumps(state.get("strategy_plan", {}), indent=2),
        scouting_report=json.dumps(state.get("scouting_report", {}), indent=2),
        pattern_report=json.dumps(state.get("pattern_report", {}), indent=2),
        psychology_report=json.dumps(state.get("psychology_report", {}), indent=2),
    )

    llm = _get_report_llm()
    response = llm.invoke([
        SystemMessage(content=prompts.SYNTHESIS_SYSTEM),
        HumanMessage(content=prompt),
    ])

    raw = response.content.strip()

    # Split narrative from opening tree JSON on the sentinel
    opening_tree: list[dict] = []
    if "---OPENING_TREE---" in raw:
        parts = raw.split("---OPENING_TREE---", 1)
        narrative = parts[0].strip()
        opening_tree = _parse_json(parts[1].strip(), [])
    else:
        narrative = raw

    # Enrich tree nodes with real stats from opening_stats
    opening_stats = (state.get("pattern_data") or {}).get("opening_stats", [])
    stats_by_eco: dict[str, dict] = {}
    for s in opening_stats:
        eco = s.get("eco")
        if eco:
            # Keep the entry with most games when ECO appears for both colors
            if eco not in stats_by_eco or s["games_count"] > stats_by_eco[eco]["games_count"]:
                stats_by_eco[eco] = s

    def _enrich(node: dict) -> dict:
        eco = node.get("eco")
        if eco:
            # Try exact match first, then 3-char prefix
            match = stats_by_eco.get(eco) or stats_by_eco.get(eco[:3])
            if match:
                node["stats"] = {
                    "games": match["games_count"],
                    "win_pct": match["win_pct"],
                    "avg_cpl": match["avg_cpl"],
                    "blunder_rate": round(match["blunder_rate"] * 100, 1),
                }
        node["children"] = [_enrich(c) for c in node.get("children") or []]
        return node

    opening_tree = [_enrich(n) for n in opening_tree]

    # Build markdown report
    plan = state.get("strategy_plan", {})
    scouting = state.get("scouting_report", {})
    pattern = state.get("pattern_report", {})
    psychology = state.get("psychology_report", {})

    opening_stats = (state.get("pattern_data") or {}).get("opening_stats", [])
    openings_md = "\n".join(
        f"- **{o.get('opening_name') or o.get('eco', '?')}** "
        f"({o.get('color', '?')}) — {o.get('games_count', 0)} games, "
        f"{o.get('win_pct', 0)}% wins"
        for o in opening_stats[:6]
    )

    tree_md = "\n".join(
        f"- **{t.get('eco', '?')} {t.get('opening_name', '')}** "
        f"[{t.get('action', '').replace('_', ' ')}] — {t.get('reason', '')}"
        for t in opening_tree
    ) if opening_tree else "—"

    report_markdown = f"""# Preparation Report

## Strategy Plan
- **Focus areas:** {', '.join(plan.get('focus_areas', []))}
- **Target openings:** {', '.join(plan.get('target_openings', []))}
- **Phase weakness:** {plan.get('phase_weakness', '—')}
- **Prep priority:** {plan.get('prep_priority', '—')}

## Scouting
- **Time pressure sensitivity:** {scouting.get('time_pressure_sensitivity', '—')}
- **Time pressure insight:** {scouting.get('time_pressure_insight', '—')}
- **Rating insight:** {scouting.get('rating_insight', '—')}

## Patterns
- **Book deviation:** {pattern.get('book_deviation_habit', '—')}
- **Dominant weakness:** {pattern.get('dominant_phase_weakness', '—')}

## Psychology
- **Color preference:** {psychology.get('color_preference', '—')} — {psychology.get('color_insight', '—')}
- **Exploit strategy:** {psychology.get('exploit_strategy', '—')}

## Opening Repertoire
{openings_md}

## Opening Tree
{tree_md}

## Analysis
{narrative}
"""

    return {
        "narrative": narrative,
        "report_markdown": report_markdown,
        "opening_tree": opening_tree,
    }


# ---------------------------------------------------------------------------
# Graph assembly
# ---------------------------------------------------------------------------

def build_prep_graph() -> StateGraph:
    g = StateGraph(PrepState)

    g.add_node("orchestrator", orchestrator_node)
    g.add_node("scouting",    scouting_node)
    g.add_node("pattern",     pattern_node)
    g.add_node("psychology",  psychology_node)
    g.add_node("synthesis",   synthesis_node)

    g.set_entry_point("orchestrator")
    g.add_edge("orchestrator", "scouting")
    g.add_edge("scouting",     "pattern")
    g.add_edge("pattern",      "psychology")
    g.add_edge("psychology",   "synthesis")
    g.add_edge("synthesis",    END)

    return g.compile(
        checkpointer=MemorySaver(),
        interrupt_before=["scouting"],  # pause after orchestrator for human review
    )


prep_graph = build_prep_graph()
