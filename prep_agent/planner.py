"""Build a PlannedPrep from a PrepReport + PrepPrefs using scored branches."""
from __future__ import annotations

from collections import defaultdict
from typing import Dict, List

from .types import PrepReport, Side, BlunderEvent, TurningPoint
from .prefs import PrepPrefs
from .session_types import BranchScore, LinePark, PlannedPrep
from .scoring import score_branches


# ── helpers ────────────────────────────────────────────────────────

def _blunder_to_turning_point(b: BlunderEvent) -> TurningPoint:
    return TurningPoint(
        title=f"Turning point (drop {b.drop_cp_equiv / 100:.1f})",
        fen=b.fen_before,
        pos_key=b.pos_key,
        opening_key=b.opening_key,
        opoonent_mistake_move_san=b.playing_move_san,
        opoonent_mistake_move_uci=b.playing_move_uci,
        severity=b.severity,
        drop_cp_equiv=b.drop_cp_equiv,
        punish_move_uci=b.refutation_first_uci,
        refutation_line_uci=list(b.refutation_pv_uci),
        note="(auto) Look for forcing moves and punish loose pieces.",
    )


def _headline(bs: BranchScore) -> str:
    moves = " ".join(bs.branch_moves_san) if bs.branch_moves_san else "(root)"
    parts = [moves, f"{bs.games} games"]
    if bs.blunder_rate > 0:
        parts.append(f"{bs.blunder_rate * 100:.0f}% blunder rate")
    if bs.fit_score > 0:
        parts.append("fits repertoire")
    return " \u2014 ".join(parts)


# ── public API ─────────────────────────────────────────────────────

def build_planned_prep(report: PrepReport, prefs: PrepPrefs) -> PlannedPrep:
    """Score branches, select top targets per side, attach turning points."""
    prefs = prefs.normalize()
    ranked = score_branches(report, prefs)

    # select top N per side
    selected: Dict[Side, List[BranchScore]] = defaultdict(list)
    for bs in ranked:
        if len(selected[bs.opponent_side]) < prefs.max_targets_per_side:
            selected[bs.opponent_side].append(bs)

    # build LinePark for each chosen branch
    chosen: List[LinePark] = []
    for side, branches_scored in selected.items():
        for bs in branches_scored:
            br_key = " ".join(bs.branch_moves_san).strip()

            # collect turning points matching this branch
            tps: List[TurningPoint] = []
            seen_pos: set[str] = set()
            for b in report.blunders:
                if b.opponent_side != side:
                    continue
                if br_key and not b.opening_key.startswith(br_key):
                    continue
                if b.pos_key in seen_pos:
                    continue
                seen_pos.add(b.pos_key)
                tps.append(_blunder_to_turning_point(b))
                if len(tps) >= prefs.max_turning_points_per_side:
                    break

            chosen.append(LinePark(
                oppoennt_side=side,
                branch_moves_san=bs.branch_moves_san,
                headline=_headline(bs),
                critical_positions=tps,
            ))

    return PlannedPrep(
        opponent_name=report.opponent_name,
        pref=prefs,
        ranked_branches=ranked,
        chosen_targets=chosen,
    )
