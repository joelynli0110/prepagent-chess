from __future__ import annotations
from dataclasses import dataclass
from typing import List, Optional, Dict, Tuple
from collections import defaultdict

from .types import PrepReport, Side, OpeningBranchStat, TurningPoint
from .prefs import PrepPrefs


@dataclass
class SimpleTarget:
    opponent_side: Side
    branch: OpeningBranchStat
    turning_points: List[TurningPoint]


@dataclass
class SimplePlan:
    opponent_name: Optional[str]
    prefs: PrepPrefs
    targets: List[SimpleTarget]


def _branch_text(branch: OpeningBranchStat) -> str:
    return " ".join(branch.moves_san).lower()


def _is_banned(branch: OpeningBranchStat, banned_keywords_lc: List[str]) -> bool:
    if not banned_keywords_lc:
        return False
    txt = _branch_text(branch)
    return any(k in txt for k in banned_keywords_lc)


def _fits_repertoire(branch: OpeningBranchStat, opponent_side: Side, prefs: PrepPrefs) -> bool:
    """
    MVP repertoire fit:
    - If opponent is White: you are Black. Look at opponent first move (e4/d4/...)
      Ensure it is in your supported buckets (vs e4, vs d4) – we assume you'll prepare either way.
      (In PR2: just don't block; keep simple)
    - If opponent is Black: you are White. Ensure your as_white_first_moves includes first move.
      But the branch list is from opponent perspective (opponent as black vs e4/d4). We'll map:
         opponent black vs 1.e4 => you (white) play e4 (must be allowed)
         opponent black vs 1.d4 => you (white) play d4 (must be allowed)
    """
    moves = branch.moves_san
    if not moves:
        return True

    if opponent_side == Side.BLACK:
        # opponent is black, so white's first move is moves[0] typically "e4" or "d4"
        first = moves[0].lower()
        # simple: allow if your white first moves includes e4 or d4 matching prefix
        return any(first.startswith(x.lower()) for x in prefs.as_white_first_moves)

    if opponent_side == Side.WHITE:
        # opponent is white, you are black; in PR2 we don't block by your black defense list
        # because branch list is "opponent as white" (their line), not your defense choice.
        return True

    return True


def build_simple_plan(report: PrepReport, prefs: PrepPrefs) -> SimplePlan:
    prefs = prefs.normalize()

    # choose branches based on focus
    branches_by_side: Dict[Side, List[OpeningBranchStat]] = {
        Side.WHITE: report.opening_profile.as_white_top,
        Side.BLACK: report.opening_profile.as_black_vs_e4_top + report.opening_profile.as_black_vs_d4_top,
    }

    chosen_targets: List[SimpleTarget] = []

    # group turning points (already in report.targets in Sprint1, but we prefer using blunders directly)
    blunders_by_opening_and_side = defaultdict(list)
    for b in report.blunders:
        blunders_by_opening_and_side[(b.opponent_side, b.opening_key)].append(b)

    # helper: convert BlunderEvent -> TurningPoint (reuse shape from Sprint1 select.py)
    def to_turning_point(b) -> TurningPoint:
        return TurningPoint(
            title=f"Turning point (drop {b.drop_cp_equiv/100:.1f})",
            fen=b.fen_before,
            pos_key=b.pos_key,
            opening_key=b.opening_key,
            opponent_mistake_move_san=b.played_move_san,
            opponent_mistake_move_uci=b.played_move_uci,
            severity=b.severity,
            drop_cp_equiv=b.drop_cp_equiv,
            punish_move_uci=b.refutation_first_uci,
            refutation_line_uci=b.refutation_pv_uci,
            note="(auto) Look for forcing moves and punish loose pieces.",
        )

    for side in [Side.WHITE, Side.BLACK]:
        if prefs.focus == "opp_as_white" and side != Side.WHITE:
            continue
        if prefs.focus == "opp_as_black" and side != Side.BLACK:
            continue

        candidates = []
        for br in branches_by_side[side]:
            if _is_banned(br, prefs.banned_branch_keywords):
                continue
            if not _fits_repertoire(br, side, prefs):
                continue
            candidates.append(br)

        candidates = sorted(candidates, key=lambda x: x.games, reverse=True)[:prefs.max_targets_per_side]

        for br in candidates:
            # collect turning points within this opening_key prefix (opening_key in plies is progressive)
            # We'll match blunders where opening_key startswith this branch sequence (san string).
            br_key = " ".join(br.moves_san).strip()
            tps: List[TurningPoint] = []
            seen_pos = set()

            # use all blunders for this side; filter by opening_key prefix
            for b in report.blunders:
                if b.opponent_side != side:
                    continue
                if br_key and not b.opening_key.startswith(br_key):
                    continue
                if b.pos_key in seen_pos:
                    continue
                seen_pos.add(b.pos_key)
                tps.append(to_turning_point(b))
                if len(tps) >= prefs.max_turning_points_per_side:
                    break

            chosen_targets.append(SimpleTarget(opponent_side=side, branch=br, turning_points=tps))

    return SimplePlan(opponent_name=report.opponent_name, prefs=prefs, targets=chosen_targets)
