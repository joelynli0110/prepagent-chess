from __future__ import annotations

from typing import List, Optional
from .types import GameMeta, PrepConfig, PrepReport, OpeningProfile, BlunderEvent, TargetPlan, TurningPoint, OpeningBranchStat, Side


def render_markdown_report(
    opponent_name: Optional[str],
    games: List[GameMeta],
    opening_profile: OpeningProfile,
    blunders: List[BlunderEvent],
    targets: List[TargetPlan],
    cfg: PrepConfig
) -> str:
    opp = opponent_name or opening_profile.opponent_name or "Oppponent"
    lines = []
    lines.append(f"# Prep Report: {opp}")
    lines.append("")
    lines.append(f"**Games ingested:** {len(games)}")
    lines.append(f"- Opening plies profiled: **{cfg.opening_plies}**")
    lines.append("")

    def branch_table(title: str, items):
        lines.append(f"## {title}")
        lines.append("")
        if not items:
            lines.append("_No data._")
            lines.append("")
            return
        lines.append("| Branch (first moves) | Games | Score |")
        lines.append("|---|---:|---:|")
        for b in items:
            mv = " ".join(b.moves_san)
            lines.append(f"| `{mv}` | {b.games} | {b.score:.2f} |")
        lines.append("")

    branch_table("Opponent as White — top branches", opening_profile.as_white_top[:10])
    branch_table("Opponent as Black vs 1.e4 — top branches", opening_profile.as_black_vs_e4_top[:10])
    branch_table("Opponent as Black vs 1.d4 — top branches", opening_profile.as_black_vs_d4_top[:10])

    lines.append("## Biggest blunders (top 15)")
    lines.append("")
    lines.append("| Side | Opening key | Ply | Move | Drop (pawns) |")
    lines.append("|---|---|---:|---|---:|")
    for b in blunders[:15]:
        drop_p = b.drop_cp_equiv / 100.0
        lines.append(f"| {b.opponent_side} | `{b.opening_key}` | {b.ply} | `{b.played_move_san}` | {drop_p:.1f} |")
    lines.append("")

    for t in targets:
        side_label = "Opponent as White" if t.opponent_side == Side.WHITE else "Opponent as Black"
        lines.append(f"## Target plan: {side_label}")
        lines.append("")
        lines.append(t.headline)
        lines.append("")
        if t.likely_openings:
            lines.append("**Likely openings/defenses:**")
            for br in t.likely_openings:
                lines.append(f"- `{ ' '.join(br.moves_san) }` (games: {br.games}, score: {br.score:.2f})")
            lines.append("")
        if t.turning_points:
            lines.append("**Turning points to drill:**")
            for i, tp in enumerate(t.turning_points[:10], 1):
                lines.append(f"{i}. {tp.title} — opponent played `{tp.opponent_mistake_move_san}` (drop {tp.drop_cp_equiv/100:.1f})")
            lines.append("")

    return "\n".join(lines)