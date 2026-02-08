"""Standalone coaching function — calls Ollama without running the full graph."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from langchain_community.chat_models import ChatOllama
from langchain_core.messages import HumanMessage

from .session_types import PlannedPrep, CoachingAdvice


def _build_coaching_prompt(planned: PlannedPrep, opponent_name: str) -> str:
    """Construct the coaching prompt from a PlannedPrep."""
    # Detailed target descriptions
    target_lines = []
    for i, t in enumerate(planned.chosen_targets, 1):
        line = f"{i}. {t.headline}"
        if t.critical_positions:
            for cp in t.critical_positions[:3]:
                line += (
                    f"\n   - Turning point: opponent played {cp.opoonent_mistake_move_san}"
                    f" (drop ~{cp.drop_cp_equiv / 100:.1f} pawns), punish with {cp.punish_move_uci}"
                )
        target_lines.append(line)
    targets_text = "\n".join(target_lines)

    # Score breakdowns from ranked branches
    score_lines = []
    for bs in planned.ranked_branches[:5]:
        score_lines.append(
            f"- {' '.join(bs.branch_moves_san)}: "
            f"total={bs.total_score:.2f} "
            f"(freq={bs.frequency_score:.2f}, weakness={bs.weakness_score:.2f}, fit={bs.fit_score:.2f}), "
            f"blunder_rate={bs.blunder_rate:.1%}, avg_drop={bs.avg_drop_cp:.0f}cp"
        )
    scores_text = "\n".join(score_lines) if score_lines else "No detailed scores available."

    return (
        f"You are an experienced chess coach. Your student is preparing "
        f"against {opponent_name}.\n\n"
        f"## Chosen prep targets\n{targets_text}\n\n"
        f"## Branch scoring breakdown\n{scores_text}\n\n"
        f"For each target give 2-3 sentences of practical advice: "
        f"typical middlegame plans, pawn structures to aim for, and "
        f"how to punish the opponent's habitual mistakes. "
        f"Reference specific blunder rates and score data where relevant."
    )


def generate_coaching(
    planned: PlannedPrep,
    opponent_name: str,
    model: str = "mistral",
    base_url: str = "http://localhost:11434",
) -> CoachingAdvice:
    """Generate coaching advice from an already-built PlannedPrep via Ollama."""
    llm = ChatOllama(model=model, base_url=base_url, temperature=0.3)

    prompt = _build_coaching_prompt(planned, opponent_name)
    response = llm.invoke([HumanMessage(content=prompt)])

    return CoachingAdvice(
        created_at=datetime.utcnow().isoformat(timespec="seconds") + "Z",
        coach_model=model,
        advice_text=response.content,
        targets_addressed=[t.headline for t in planned.chosen_targets],
    )
