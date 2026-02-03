from __future__ import annotations

from typing import List, Dict, Set
from collections import defaultdict

from .types import OpeningProfile, BlunderEvent, PrepConfig, TargetPlan, TurningPoint, Side

def build_targets(
    opening_profile: OpeningProfile,
    blunders: List[BlunderEvent],
    cfg: PrepConfig
) -> List[TargetPlan]:
    # group blunders by opponent side (opponent-as-white / opponent-as-black)
    by_side: Dict[Side, List[BlunderEvent]] = defaultdict(list)
    for b in blunders:
        by_side[b.opponent_side].append(b)

    targets: List[TargetPlan] = []
    
    for side in [Side.WHITE, Side.BLACK]:
        likely_openings = opening_profile.as_white_top if side == Side.WHITE else (
            opening_profile.as_black_vs_e4_top + opening_profile.as_black_vs_d4_top
        )
        likely_openings = sorted(likely_openings, key=lambda x: x.games, reverse=True)[:3]

        # pick turning points: highest drops, dedup by pos key
        chosen: List[TurningPoint] = []
        seen: Set[str] = set()
        for b in by_side.get(side,[]):
            if cfg.dedupe_by_pos_key and b.pos_key in seen:
                continue
            seen.add(b.pos_key)

            note = "Pattern: opponent often collapses here-look for forcing moves (checks/captures) and punish loose pieces"
            chosen.append(TurningPoint(
                title=f"Turning point (drop {b.drop_cp_equiv/100:.1f})",
                fen=b.fen_before,
                pos_key=b.pos_key,
                opening_key=b.opening_key,
                opening_mistake_move_san=b.played_move_san,
                opoonent_mistake_move_uci=b.played_move_uci,
                severity=b.severity,
                drop_cp_equiv=b.drop_cp_equiv,
                punish_move_uci=b.refutation_first_uci,
                refutation_line_uci=b.refutation_pv_uci,
                note=note
            ))

            if len(chosen) >= cfg.max_turning_points_per_side:
                break

        if not likely_openings or not chosen:
            continue

        headline = f"Opponent as White: expect these lines" if side == Side.WHITE else "Opponent as Black: expect these defenses"
        targets.append(TargetPlan(
            opponent_side=side,
            headline=headline,
            likely_openings=likely_openings,
            turning_points=chosen
        ))

    return targets