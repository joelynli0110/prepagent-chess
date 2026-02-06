# prep_agent/prefs.py
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Literal, List, Tuple


class RiskProfile(str, Enum):
    SOLID = "solid"
    PRACTICAL = "practical"
    SHARP = "sharp"


class TimeBudget(str, Enum):
    QUICK = "quick"
    NORMAL = "normal"
    DEEP = "deep"


@dataclass
class PrepPrefs:
    """
    User constraints/preferences that shape the agent plan.
    """
    focus: Literal["both", "opp_as_white", "opp_as_black"] = "both"
    risk: RiskProfile = RiskProfile.PRACTICAL
    time_budget: TimeBudget = TimeBudget.NORMAL

    def __post_init__(self):
        # Convert strings to enums if needed (when loading from JSON)
        if isinstance(self.risk, str):
            self.risk = RiskProfile(self.risk)
        if isinstance(self.time_budget, str):
            self.time_budget = TimeBudget(self.time_budget)

    # Your repertoire constraints
    as_white_first_moves: List[str] = field(default_factory=lambda: ["e4", "d4"])
    as_black_vs_e4: List[str] = field(default_factory=lambda: ["c5", "e5"])
    as_black_vs_d4: List[str] = field(default_factory=lambda: ["Nf6", "d5"])

    # Hard constraints / custom filters
    banned_branch_keywords: List[str] = field(default_factory=list)  # e.g. ["Sicilian Defense", "King's Indian Defense"]
    max_targets_per_side: int = 3
    max_turning_points_per_side: int = 10

    # Optional notes
    notes: str = ""

    def normalize(self) -> PrepPrefs:
        """Normalize/clean the preferences."""
        return PrepPrefs(
            focus=self.focus,
            risk=self.risk,
            time_budget=self.time_budget,
            as_white_first_moves=[m.strip() for m in self.as_white_first_moves if m.strip()],
            as_black_vs_e4=[m.strip() for m in self.as_black_vs_e4 if m.strip()],
            as_black_vs_d4=[m.strip() for m in self.as_black_vs_d4 if m.strip()],
            banned_branch_keywords=[k.strip() for k in self.banned_branch_keywords if k.strip()],
            max_targets_per_side=max(1, self.max_targets_per_side),
            max_turning_points_per_side=max(1, self.max_turning_points_per_side),
            notes=self.notes.strip(),
        )

    def validate(self) -> Tuple[bool, List[str]]:
        """Validate the preferences. Returns (is_valid, list_of_errors)."""
        errors = []

        if self.focus not in ("both", "opp_as_white", "opp_as_black"):
            errors.append(f"Invalid focus: {self.focus}")

        if not self.as_white_first_moves:
            errors.append("At least one first move as White is required")

        if not self.as_black_vs_e4:
            errors.append("At least one response to e4 is required")

        if not self.as_black_vs_d4:
            errors.append("At least one response to d4 is required")

        if self.max_targets_per_side < 1:
            errors.append("Max targets per side must be at least 1")

        if self.max_turning_points_per_side < 1:
            errors.append("Max turning points per side must be at least 1")

        return (len(errors) == 0, errors)
