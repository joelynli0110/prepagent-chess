"""Tests for branch scoring and planner (no engine needed)."""
from __future__ import annotations

import pytest

from prep_agent.types import (
    BlunderEvent, OpeningBranchStat, OpeningProfile, PrepReport,
    Severity, Side, TargetPlan,
)
from prep_agent.prefs import PrepPrefs, RiskProfile
from prep_agent.session_types import BranchScore
from prep_agent.scoring import score_branches, _weakness_for_branch
from prep_agent.planner import build_planned_prep


# ── fixtures ───────────────────────────────────────────────────────

def _make_branch(side: Side, moves: list[str], games: int, score: float = 0.5):
    return OpeningBranchStat(side=side, moves_san=moves, games=games, score=score)


def _make_blunder(
    side: Side, opening_key: str, drop_cp: int = 200, pos_key: str | None = None,
):
    return BlunderEvent(
        game_id="g1",
        ply=10,
        opponent_side=side,
        fen_before="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        pos_key=pos_key or f"pk-{opening_key}-{drop_cp}",
        opening_key=opening_key,
        playing_move_uci="e2e4",
        playing_move_san="e4",
        drop_cp_equiv=drop_cp,
        severity=Severity.BLUNDER,
    )


def _make_report(
    white_branches: list[OpeningBranchStat] | None = None,
    black_e4_branches: list[OpeningBranchStat] | None = None,
    black_d4_branches: list[OpeningBranchStat] | None = None,
    blunders: list[BlunderEvent] | None = None,
) -> PrepReport:
    return PrepReport(
        created_at="2025-01-01",
        games_ingested=100,
        opening_profile=OpeningProfile(
            opening_plies=8,
            as_white_top=white_branches or [],
            as_black_vs_e4_top=black_e4_branches or [],
            as_black_vs_d4_top=black_d4_branches or [],
        ),
        blunders=blunders or [],
        targets=[],
        markdown_report="",
        opponent_name="TestOpponent",
    )


# ── frequency_score tests ─────────────────────────────────────────

class TestFrequencyScore:
    def test_most_played_gets_1(self):
        report = _make_report(white_branches=[
            _make_branch(Side.WHITE, ["e4", "e5"], 20),
            _make_branch(Side.WHITE, ["d4", "d5"], 10),
        ])
        prefs = PrepPrefs(focus="opp_as_white")
        scores = score_branches(report, prefs)
        top = max(scores, key=lambda s: s.frequency_score)
        assert top.frequency_score == 1.0
        assert top.games == 20

    def test_half_frequency(self):
        report = _make_report(white_branches=[
            _make_branch(Side.WHITE, ["e4", "e5"], 20),
            _make_branch(Side.WHITE, ["d4", "d5"], 10),
        ])
        prefs = PrepPrefs(focus="opp_as_white")
        scores = score_branches(report, prefs)
        lesser = [s for s in scores if s.games == 10][0]
        assert lesser.frequency_score == 0.5


# ── weakness_score tests ──────────────────────────────────────────

class TestWeaknessScore:
    def test_no_blunders_zero(self):
        score, rate, avg = _weakness_for_branch("e4 e5", Side.WHITE, 10, [])
        assert score == 0.0

    def test_50pct_blunder_rate_300cp_gives_max(self):
        blunders = [
            _make_blunder(Side.WHITE, "e4 e5 Nf3", 300, pos_key=f"p{i}")
            for i in range(5)
        ]
        score, rate, avg = _weakness_for_branch("e4 e5", Side.WHITE, 10, blunders)
        assert rate == 0.5
        assert avg == 300.0
        assert score == pytest.approx(1.0)

    def test_partial_weakness(self):
        blunders = [_make_blunder(Side.WHITE, "e4 e5 Nf3", 150, pos_key="p1")]
        score, rate, avg = _weakness_for_branch("e4 e5", Side.WHITE, 10, blunders)
        # rate = 1/10 = 0.1 → 0.5 * min(1, 0.1/0.5) = 0.5 * 0.2 = 0.1
        # avg = 150 → 0.5 * min(1, 150/300) = 0.5 * 0.5 = 0.25
        assert score == pytest.approx(0.35)

    def test_only_matches_correct_side(self):
        blunders = [_make_blunder(Side.BLACK, "e4 e5", 300)]
        score, _, _ = _weakness_for_branch("e4 e5", Side.WHITE, 10, blunders)
        assert score == 0.0


# ── fit_score tests ───────────────────────────────────────────────

class TestFitScore:
    def test_banned_keyword_gives_zero(self):
        report = _make_report(white_branches=[
            _make_branch(Side.WHITE, ["e4", "c5"], 15),
        ])
        prefs = PrepPrefs(
            focus="opp_as_white",
            banned_branch_keywords=["c5"],
        )
        scores = score_branches(report, prefs)
        assert scores[0].fit_score == 0.0

    def test_matching_repertoire_gives_one(self):
        report = _make_report(black_e4_branches=[
            _make_branch(Side.BLACK, ["e4", "c5"], 10),
        ])
        prefs = PrepPrefs(
            focus="opp_as_black",
            as_white_first_moves=["e4"],
        )
        scores = score_branches(report, prefs)
        assert scores[0].fit_score == 1.0

    def test_non_matching_repertoire_gives_zero(self):
        report = _make_report(black_e4_branches=[
            _make_branch(Side.BLACK, ["e4", "c5"], 10),
        ])
        prefs = PrepPrefs(
            focus="opp_as_black",
            as_white_first_moves=["d4"],  # you only play d4, branch is e4
        )
        scores = score_branches(report, prefs)
        assert scores[0].fit_score == 0.0


# ── weight profiles ───────────────────────────────────────────────

class TestWeightProfiles:
    def _two_branch_report(self):
        """Branch A: high freq, no weakness. Branch B: low freq, high weakness."""
        return _make_report(
            white_branches=[
                _make_branch(Side.WHITE, ["e4", "e5"], 20),
                _make_branch(Side.WHITE, ["d4", "Nf6"], 5),
            ],
            blunders=[
                _make_blunder(Side.WHITE, "d4 Nf6", 300, pos_key=f"p{i}")
                for i in range(3)   # 3 blunders in 5 games = 60%
            ],
        )

    def test_solid_prefers_frequency(self):
        report = self._two_branch_report()
        prefs = PrepPrefs(focus="opp_as_white", risk=RiskProfile.SOLID)
        scores = score_branches(report, prefs)
        # e4 e5 (freq=1.0) should be first
        assert scores[0].branch_moves_san == ["e4", "e5"]

    def test_sharp_prefers_weakness(self):
        report = self._two_branch_report()
        prefs = PrepPrefs(focus="opp_as_white", risk=RiskProfile.SHARP)
        scores = score_branches(report, prefs)
        # d4 Nf6 (high weakness) should be first
        assert scores[0].branch_moves_san == ["d4", "Nf6"]


# ── top-N selection ───────────────────────────────────────────────

class TestTopNSelection:
    def test_max_targets_per_side(self):
        report = _make_report(white_branches=[
            _make_branch(Side.WHITE, ["e4", "e5"], 20),
            _make_branch(Side.WHITE, ["d4", "d5"], 15),
            _make_branch(Side.WHITE, ["c4"], 10),
            _make_branch(Side.WHITE, ["Nf3"], 5),
        ])
        prefs = PrepPrefs(focus="opp_as_white", max_targets_per_side=2)
        planned = build_planned_prep(report, prefs)
        assert len(planned.chosen_targets) == 2

    def test_both_sides_get_targets(self):
        report = _make_report(
            white_branches=[_make_branch(Side.WHITE, ["e4"], 10)],
            black_e4_branches=[_make_branch(Side.BLACK, ["e4", "c5"], 8)],
        )
        prefs = PrepPrefs(focus="both", max_targets_per_side=2)
        planned = build_planned_prep(report, prefs)
        sides = {t.oppoennt_side for t in planned.chosen_targets}
        assert Side.WHITE in sides
        assert Side.BLACK in sides


# ── headline / "why" text ─────────────────────────────────────────

class TestHeadline:
    def test_headline_contains_games(self):
        report = _make_report(
            white_branches=[_make_branch(Side.WHITE, ["e4", "e5"], 12)],
            blunders=[
                _make_blunder(Side.WHITE, "e4 e5 Nf3", 200, pos_key=f"p{i}")
                for i in range(5)
            ],
        )
        prefs = PrepPrefs(focus="opp_as_white")
        planned = build_planned_prep(report, prefs)
        hl = planned.chosen_targets[0].headline
        assert "12 games" in hl

    def test_headline_contains_blunder_rate(self):
        report = _make_report(
            white_branches=[_make_branch(Side.WHITE, ["e4", "e5"], 10)],
            blunders=[
                _make_blunder(Side.WHITE, "e4 e5 Nf3", 200, pos_key=f"p{i}")
                for i in range(4)
            ],
        )
        prefs = PrepPrefs(focus="opp_as_white")
        planned = build_planned_prep(report, prefs)
        hl = planned.chosen_targets[0].headline
        assert "blunder rate" in hl

    def test_headline_contains_fits_repertoire(self):
        report = _make_report(
            white_branches=[_make_branch(Side.WHITE, ["e4", "e5"], 10)],
        )
        prefs = PrepPrefs(focus="opp_as_white")
        planned = build_planned_prep(report, prefs)
        hl = planned.chosen_targets[0].headline
        assert "fits repertoire" in hl


# ── turning points in planner ─────────────────────────────────────

class TestTurningPoints:
    def test_turning_points_attached(self):
        report = _make_report(
            white_branches=[_make_branch(Side.WHITE, ["e4", "e5"], 10)],
            blunders=[
                _make_blunder(Side.WHITE, "e4 e5 Nf3", 250, pos_key="p1"),
                _make_blunder(Side.WHITE, "e4 e5 Bc4", 180, pos_key="p2"),
            ],
        )
        prefs = PrepPrefs(focus="opp_as_white")
        planned = build_planned_prep(report, prefs)
        tps = planned.chosen_targets[0].critical_positions
        assert len(tps) == 2

    def test_turning_points_capped(self):
        report = _make_report(
            white_branches=[_make_branch(Side.WHITE, ["e4", "e5"], 50)],
            blunders=[
                _make_blunder(Side.WHITE, "e4 e5", 200, pos_key=f"p{i}")
                for i in range(20)
            ],
        )
        prefs = PrepPrefs(focus="opp_as_white", max_turning_points_per_side=3)
        planned = build_planned_prep(report, prefs)
        assert len(planned.chosen_targets[0].critical_positions) <= 3

    def test_deduplicates_by_pos_key(self):
        report = _make_report(
            white_branches=[_make_branch(Side.WHITE, ["e4", "e5"], 10)],
            blunders=[
                _make_blunder(Side.WHITE, "e4 e5", 200, pos_key="same"),
                _make_blunder(Side.WHITE, "e4 e5", 300, pos_key="same"),
            ],
        )
        prefs = PrepPrefs(focus="opp_as_white")
        planned = build_planned_prep(report, prefs)
        assert len(planned.chosen_targets[0].critical_positions) == 1
