"""Branch scoring: frequency + weakness + repertoire fit."""
from __future__ import annotations

from typing import List

from .types import PrepReport, Side, OpeningBranchStat, BlunderEvent
from .prefs import PrepPrefs, RiskProfile
from .session_types import BranchScore


# ── weight tables by risk profile ──────────────────────────────────

_WEIGHTS = {
    RiskProfile.SOLID:     (0.50, 0.20, 0.30),
    RiskProfile.PRACTICAL: (0.40, 0.35, 0.25),
    RiskProfile.SHARP:     (0.25, 0.50, 0.25),
}


# ── helpers (ported from planner_v1) ───────────────────────────────

def _branch_text(branch: OpeningBranchStat) -> str:
    return " ".join(branch.moves_san).lower()


def _is_banned(branch: OpeningBranchStat, banned_keywords_lc: List[str]) -> bool:
    if not banned_keywords_lc:
        return False
    txt = _branch_text(branch)
    return any(k in txt for k in banned_keywords_lc)


def _fits_repertoire(
    branch: OpeningBranchStat, opponent_side: Side, prefs: PrepPrefs
) -> bool:
    moves = branch.moves_san
    if not moves:
        return True

    if opponent_side == Side.BLACK:
        first = moves[0].lower()
        return any(first.startswith(x.lower()) for x in prefs.as_white_first_moves)

    # opponent is white → you are black; don't block in current version
    return True


# ── weakness computation ───────────────────────────────────────────

def _weakness_for_branch(
    branch_key: str,
    opponent_side: Side,
    games_in_branch: int,
    blunders: List[BlunderEvent],
) -> tuple[float, float, float]:
    """Return (weakness_score, blunder_rate, avg_drop_cp) for a branch."""
    matching = [
        b for b in blunders
        if b.opponent_side == opponent_side and b.opening_key.startswith(branch_key)
    ]
    if not matching or games_in_branch == 0:
        return 0.0, 0.0, 0.0

    blunder_rate = len(matching) / games_in_branch
    avg_drop_cp = sum(b.drop_cp_equiv for b in matching) / len(matching)

    score = (
        0.5 * min(1.0, blunder_rate / 0.5)
        + 0.5 * min(1.0, avg_drop_cp / 300.0)
    )
    return score, blunder_rate, avg_drop_cp


# ── public API ─────────────────────────────────────────────────────

def score_branches(report: PrepReport, prefs: PrepPrefs) -> List[BranchScore]:
    """Score every opening branch in *report* and return sorted by total_score desc."""
    prefs = prefs.normalize()
    freq_w, weak_w, fit_w = _WEIGHTS[prefs.risk]
    banned_lc = [k.lower() for k in prefs.banned_branch_keywords]

    # collect (side, branches) respecting focus filter
    side_branches: list[tuple[Side, List[OpeningBranchStat]]] = []
    if prefs.focus in ("both", "opp_as_white"):
        side_branches.append((Side.WHITE, report.opening_profile.as_white_top))
    if prefs.focus in ("both", "opp_as_black"):
        side_branches.append((
            Side.BLACK,
            report.opening_profile.as_black_vs_e4_top
            + report.opening_profile.as_black_vs_d4_top,
        ))

    results: List[BranchScore] = []

    for opponent_side, branches in side_branches:
        if not branches:
            continue
        max_games = max(b.games for b in branches)

        for br in branches:
            # frequency
            freq_score = br.games / max_games if max_games > 0 else 0.0

            # weakness
            br_key = " ".join(br.moves_san).strip()
            weak_score, blunder_rate, avg_drop = _weakness_for_branch(
                br_key, opponent_side, br.games, report.blunders,
            )

            # fit (binary 0/1)
            if _is_banned(br, banned_lc):
                fit = 0.0
            elif _fits_repertoire(br, opponent_side, prefs):
                fit = 1.0
            else:
                fit = 0.0

            total = freq_w * freq_score + weak_w * weak_score + fit_w * fit

            results.append(BranchScore(
                branch_moves_san=br.moves_san,
                opponent_side=opponent_side,
                games=br.games,
                frequency_score=round(freq_score, 4),
                weakness_score=round(weak_score, 4),
                fit_score=fit,
                total_score=round(total, 4),
                avg_drop_cp=round(avg_drop, 1),
                blunder_rate=round(blunder_rate, 4),
            ))

    results.sort(key=lambda s: s.total_score, reverse=True)
    return results
