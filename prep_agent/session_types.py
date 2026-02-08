from __future__ import annotations
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Any, Dict, Optional, Literal, List
from datetime import datetime

from .types import PrepConfig, PrepReport, OpeningBranchStat, TurningPoint, Side
from .prefs import PrepPrefs, RiskProfile, TimeBudget


@dataclass
class BranchScore:
    """
    Scoring breakdown to explain why we pickedd this branch.
    """
    branch_moves_san: List[str]
    opponent_side: Side
    games: int

    frequency_score: float
    weakness_score: float
    fit_score: float
    total_score: float

    # supporting evidence
    avg_drop_cp: float = 0.0
    blunder_rate: float = 0.0


@dataclass
class LinePark:
    """
    A compact repertoire snippet for a target branch"""

    oppoennt_side: Side
    branch_moves_san: List[str]

    headline: str
    recommended_line_uci: List[str] = field(default_factory=list)
    recommended_line_san: List[str] = field(default_factory=list)

    critical_positions: List[TurningPoint] = field(default_factory=list)

    # Optional: explanation text 
    notes: str = ""


@dataclass
class PlannedPrep:
    """
    Result of applying prefs + scoring to a PrepReport
    """
    opponent_name: Optional[str]
    pref: PrepPrefs

    ranked_branches: List[BranchScore] = field(default_factory=list)
    chosen_targets: List[LinePark] = field(default_factory=list)

    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())


class DrillMode(str, Enum):
    PUNISH = "punish" # find best move
    PLAN = "plan" # hint only (non-spoiler)
    MULTICHOICE = "multichoice"


@dataclass
class DrillItem:
    drill_id: str
    mode: DrillMode
    opponent_side: Side

    fen: str
    prompt: str

    # ground truth (engine)
    best_move_uci: Optional[str] = None
    best_line_uci: List[str] = field(default_factory=list)

    # for multichoice
    choices_uci: List[str] = field(default_factory=list)

    # metadata
    source_opening_key: str = ""
    drop_cp_equiv: Optional[int] = None


@dataclass
class DrillPack:
    pack_id: str
    opponent_name: Optional[str]
    items: List[DrillItem]
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat(timespec="seconds") + "Z")


@dataclass
class CoachingAdvice:
    """LLM-generated coaching advice for a prep plan."""
    created_at: str
    coach_model: str          # e.g. "mistral", "llama3"
    advice_text: str
    targets_addressed: List[str]  # headlines of targets this covers


@dataclass
class PrepSession:
    """
    Persisted session container.
    """
    session_id: str
    created_at: str
    opponent_name: Optional[str]

    cfg: PrepConfig
    prefs: PrepPrefs = field(default_factory=PrepPrefs)

    # snapshots / artifacts
    report: Optional[PrepReport] = None
    planned: Optional[PlannedPrep] = None
    drills: Optional[DrillPack] = None
    coaching: Optional[CoachingAdvice] = None

    # simple audit trail
    activity_log: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)