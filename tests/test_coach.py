"""Tests for the coaching module."""
from __future__ import annotations

from dataclasses import asdict
from unittest.mock import patch, MagicMock

import pytest

from prep_agent.session_types import (
    CoachingAdvice, PlannedPrep, BranchScore, LinePark,
)
from prep_agent.prefs import PrepPrefs
from prep_agent.types import Side, TurningPoint, Severity
from prep_agent.coach import generate_coaching, _build_coaching_prompt


# ── Fixtures ──────────────────────────────────────────────────────

def _make_planned() -> PlannedPrep:
    """Build a minimal PlannedPrep for testing."""
    branch_score = BranchScore(
        branch_moves_san=["e4", "e5", "Nf3"],
        opponent_side=Side.BLACK,
        games=12,
        frequency_score=0.8,
        weakness_score=0.6,
        fit_score=0.7,
        total_score=2.1,
        avg_drop_cp=95.0,
        blunder_rate=0.15,
    )
    turning_point = TurningPoint(
        title="Turning point (drop 1.2)",
        fen="rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
        pos_key="pos123",
        opening_key="e4_e5_Nf3",
        opoonent_mistake_move_san="Bc5",
        opoonent_mistake_move_uci="f8c5",
        punish_move_uci="d2d4",
        drop_cp_equiv=120,
        severity=Severity.MISTAKE,
    )
    line_park = LinePark(
        oppoennt_side=Side.BLACK,
        branch_moves_san=["e4", "e5", "Nf3"],
        headline="Italian Game: punish passive Bc5",
        critical_positions=[turning_point],
    )
    return PlannedPrep(
        opponent_name="TestOpponent",
        pref=PrepPrefs(),
        ranked_branches=[branch_score],
        chosen_targets=[line_park],
    )


# ── Prompt construction ──────────────────────────────────────────

class TestPromptConstruction:
    def test_prompt_contains_target_headline(self):
        planned = _make_planned()
        prompt = _build_coaching_prompt(planned, "TestOpponent")
        assert "Italian Game: punish passive Bc5" in prompt

    def test_prompt_contains_opponent_name(self):
        planned = _make_planned()
        prompt = _build_coaching_prompt(planned, "Magnus")
        assert "Magnus" in prompt

    def test_prompt_contains_score_data(self):
        planned = _make_planned()
        prompt = _build_coaching_prompt(planned, "TestOpponent")
        assert "total=2.10" in prompt
        assert "blunder_rate=15.0%" in prompt
        assert "avg_drop=95cp" in prompt

    def test_prompt_contains_turning_point_details(self):
        planned = _make_planned()
        prompt = _build_coaching_prompt(planned, "TestOpponent")
        assert "Bc5" in prompt
        assert "d2d4" in prompt
        assert "1.2 pawns" in prompt


# ── CoachingAdvice dataclass ─────────────────────────────────────

class TestCoachingAdviceSerialization:
    def test_round_trip(self):
        advice = CoachingAdvice(
            created_at="2025-01-01T00:00:00Z",
            coach_model="mistral",
            advice_text="Play d4 to seize the center.",
            targets_addressed=["Italian Game: punish passive Bc5"],
        )
        d = asdict(advice)
        restored = CoachingAdvice(**d)
        assert restored.advice_text == advice.advice_text
        assert restored.coach_model == "mistral"
        assert restored.targets_addressed == advice.targets_addressed

    def test_asdict_keys(self):
        advice = CoachingAdvice(
            created_at="2025-01-01T00:00:00Z",
            coach_model="llama3",
            advice_text="text",
            targets_addressed=[],
        )
        d = asdict(advice)
        assert set(d.keys()) == {"created_at", "coach_model", "advice_text", "targets_addressed"}


# ── generate_coaching with mocked LLM ────────────────────────────

class TestGenerateCoaching:
    @patch("prep_agent.coach.ChatOllama")
    def test_returns_valid_coaching_advice(self, mock_ollama_cls):
        mock_llm = MagicMock()
        mock_response = MagicMock()
        mock_response.content = "Focus on central pawn breaks after e4 e5 Nf3."
        mock_llm.invoke.return_value = mock_response
        mock_ollama_cls.return_value = mock_llm

        planned = _make_planned()
        advice = generate_coaching(planned, "TestOpponent", model="mistral")

        assert isinstance(advice, CoachingAdvice)
        assert advice.coach_model == "mistral"
        assert "central pawn breaks" in advice.advice_text
        assert advice.targets_addressed == ["Italian Game: punish passive Bc5"]

    @patch("prep_agent.coach.ChatOllama")
    def test_passes_model_and_url(self, mock_ollama_cls):
        mock_llm = MagicMock()
        mock_response = MagicMock()
        mock_response.content = "advice"
        mock_llm.invoke.return_value = mock_response
        mock_ollama_cls.return_value = mock_llm

        planned = _make_planned()
        generate_coaching(planned, "Opp", model="llama3", base_url="http://myhost:1234")

        mock_ollama_cls.assert_called_once_with(
            model="llama3", base_url="http://myhost:1234", temperature=0.3,
        )

    @patch("prep_agent.coach.ChatOllama")
    def test_prompt_sent_to_llm_contains_targets(self, mock_ollama_cls):
        mock_llm = MagicMock()
        mock_response = MagicMock()
        mock_response.content = "advice"
        mock_llm.invoke.return_value = mock_response
        mock_ollama_cls.return_value = mock_llm

        planned = _make_planned()
        generate_coaching(planned, "TestOpponent")

        call_args = mock_llm.invoke.call_args[0][0]
        prompt_text = call_args[0].content
        assert "Italian Game: punish passive Bc5" in prompt_text
        assert "TestOpponent" in prompt_text
