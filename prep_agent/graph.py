"""LangGraph-based agent workflow for the prep pipeline."""
from __future__ import annotations

from datetime import datetime
from typing import Annotated, List, Optional

from typing_extensions import TypedDict

from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage

from .types import (
    PrepConfig, PrepReport, OpeningProfile, BlunderEvent, TargetPlan,
    GameMeta, PlyRecord, Side,
)
from .prefs import PrepPrefs
from .session_types import PlannedPrep
from .ingest import ingest_pgns
from .openings import build_opening_profile
from .blunders import extract_opponent_blunders
from .select import build_targets
from .report import render_markdown_report
from .planner import build_planned_prep


# ── 1. Shared state ───────────────────────────────────────────────

class PrepState(TypedDict, total=False):
    """State dict flowing through every node."""

    # --- inputs (set once at invocation) ---
    pgn_texts: List[str]
    opponent_name: Optional[str]
    cfg: PrepConfig
    prefs: PrepPrefs

    # --- intermediate artefacts (populated by nodes) ---
    games: List[GameMeta]
    plies: List[PlyRecord]
    opening_profile: Optional[OpeningProfile]
    blunders: List[BlunderEvent]
    targets: List[TargetPlan]
    report: Optional[PrepReport]
    planned: Optional[PlannedPrep]

    # --- LLM conversation history (for the coach node) ---
    messages: Annotated[list[BaseMessage], add_messages]

    # --- control flow ---
    status: str
    enable_coach: bool


# ── 2. Node functions ─────────────────────────────────────────────

def ingest_node(state: PrepState) -> dict:
    """Parse PGN texts into games + plies."""
    games, plies = ingest_pgns(
        state["pgn_texts"], state.get("opponent_name"), state["cfg"],
    )
    return {
        "games": games,
        "plies": plies,
        "status": "ingested",
        "messages": [AIMessage(content=f"Ingested {len(games)} games.")],
    }


def profile_node(state: PrepState) -> dict:
    """Build the opening frequency profile."""
    profile = build_opening_profile(state["games"], state["plies"], state["cfg"])
    w = len(profile.as_white_top)
    be4 = len(profile.as_black_vs_e4_top)
    bd4 = len(profile.as_black_vs_d4_top)
    return {
        "opening_profile": profile,
        "status": "profiled",
        "messages": [AIMessage(
            content=f"Opening profile built: {w} white, {be4} black-vs-e4, {bd4} black-vs-d4 branches.",
        )],
    }


def blunder_node(state: PrepState) -> dict:
    """Run Stockfish analysis to detect opponent blunders."""
    blunders = extract_opponent_blunders(
        state["games"], state["plies"], state["cfg"],
    )
    return {
        "blunders": blunders,
        "status": "blunders_found",
        "messages": [AIMessage(content=f"Found {len(blunders)} opponent blunders.")],
    }


def report_node(state: PrepState) -> dict:
    """Assemble the full PrepReport from intermediate results."""
    profile = state["opening_profile"]
    blunders = state["blunders"]
    targets = build_targets(profile, blunders, state["cfg"])
    markdown = render_markdown_report(
        state.get("opponent_name"),
        state["games"],
        profile,
        blunders,
        targets,
        state["cfg"],
    )
    report = PrepReport(
        created_at=datetime.now().isoformat(),
        games_ingested=len(state["games"]),
        opening_profile=profile,
        blunders=blunders,
        targets=targets,
        markdown_report=markdown,
        opponent_name=state.get("opponent_name"),
    )
    return {
        "targets": targets,
        "report": report,
        "status": "report_ready",
        "messages": [AIMessage(content="Report assembled.")],
    }


def plan_node(state: PrepState) -> dict:
    """Score branches and build PlannedPrep."""
    planned = build_planned_prep(state["report"], state["prefs"])
    lines = [f"Planned {len(planned.chosen_targets)} target(s):"]
    for t in planned.chosen_targets:
        lines.append(f"  - {t.headline}")
    return {
        "planned": planned,
        "status": "planned",
        "messages": [AIMessage(content="\n".join(lines))],
    }


def coach_node(state: PrepState) -> dict:
    """LLM generates natural-language coaching advice for the plan."""
    from langchain_openai import ChatOpenAI

    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.3)
    planned = state["planned"]
    opp = state.get("opponent_name") or "the opponent"

    targets_text = "\n".join(
        f"- {t.headline}" for t in planned.chosen_targets
    )
    prompt = (
        f"You are an experienced chess coach. Your student is preparing "
        f"against {opp}.\n\n"
        f"Chosen prep targets:\n{targets_text}\n\n"
        f"For each target give 2-3 sentences of practical advice: "
        f"typical middlegame plans, pawn structures to aim for, and "
        f"how to punish the opponent's habitual mistakes."
    )
    response = llm.invoke([HumanMessage(content=prompt)])
    return {
        "status": "coached",
        "messages": [response],
    }


# ── 3. Routing ─────────────────────────────────────────────────────

def _after_plan(state: PrepState) -> str:
    """After planning, decide whether to invoke the LLM coach."""
    if state.get("enable_coach", False):
        return "coach"
    return END


# ── 4. Graph construction ─────────────────────────────────────────

def build_prep_graph():
    """Compile the LangGraph StateGraph for the prep pipeline."""
    graph = StateGraph(PrepState)

    graph.add_node("ingest", ingest_node)
    graph.add_node("profile", profile_node)
    graph.add_node("blunders", blunder_node)
    graph.add_node("report", report_node)
    graph.add_node("plan", plan_node)
    graph.add_node("coach", coach_node)

    # linear chain
    graph.add_edge(START, "ingest")
    graph.add_edge("ingest", "profile")
    graph.add_edge("profile", "blunders")
    graph.add_edge("blunders", "report")
    graph.add_edge("report", "plan")

    # conditional: plan → coach (if enabled) or → END
    graph.add_conditional_edges("plan", _after_plan, {"coach": "coach", END: END})
    graph.add_edge("coach", END)

    return graph.compile()


# ── 5. Convenience runners ────────────────────────────────────────

def run_prep_graph(
    pgn_texts: List[str],
    opponent_name: Optional[str],
    cfg: PrepConfig,
    prefs: PrepPrefs,
    enable_coach: bool = False,
) -> PrepState:
    """Run the full pipeline end-to-end and return final state."""
    app = build_prep_graph()
    initial: PrepState = {
        "pgn_texts": pgn_texts,
        "opponent_name": opponent_name,
        "cfg": cfg,
        "prefs": prefs,
        "games": [],
        "plies": [],
        "opening_profile": None,
        "blunders": [],
        "targets": [],
        "report": None,
        "planned": None,
        "messages": [HumanMessage(content=f"Prepare against {opponent_name or 'opponent'}")],
        "status": "start",
        "enable_coach": enable_coach,
    }
    return app.invoke(initial)


def stream_prep_graph(
    pgn_texts: List[str],
    opponent_name: Optional[str],
    cfg: PrepConfig,
    prefs: PrepPrefs,
    enable_coach: bool = False,
):
    """Yield (node_name, output) tuples for real-time UI updates."""
    app = build_prep_graph()
    initial: PrepState = {
        "pgn_texts": pgn_texts,
        "opponent_name": opponent_name,
        "cfg": cfg,
        "prefs": prefs,
        "games": [],
        "plies": [],
        "opening_profile": None,
        "blunders": [],
        "targets": [],
        "report": None,
        "planned": None,
        "messages": [HumanMessage(content=f"Prepare against {opponent_name or 'opponent'}")],
        "status": "start",
        "enable_coach": enable_coach,
    }
    for event in app.stream(initial):
        for node_name, output in event.items():
            yield node_name, output
