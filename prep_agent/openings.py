from __future__ import annotations

from collections import defaultdict
from typing import List, Dict, Optional, Tuple

from .types import (
    GameMeta, PlyRecord, PrepConfig, OpeningProfile, OpeningBranchStat, Side   
)


def _opponent_points(result: str, opponent_side: Side) -> float:
    # result examples: '1-0', '0-1', '1/2-1/2'
    if result == '1-0':
        return 1.0 if opponent_side == Side.WHITE else 0.0
    elif result == '0-1':
        return 1.0 if opponent_side == Side.BLACK else 0.0
    elif result == '1/2-1/2':
        return 0.5
    else:
        return 0.0 # unknown or other result
    

def build_opening_profile(
    games: List[GameMeta],
    plies: List[PlyRecord],
    cfg: PrepConfig
) -> OpeningProfile:
    # Map game_id to meta
    meta_by_id = {g.game_id: g for g in games}

    # For each game, compute opening branch (first N plies SAN)
    branch_moves_by_game: Dict[str, List[str]] = defaultdict(list)
    for pr in plies:
        if pr.ply < cfg.opening_plies:
            branch_moves_by_game[pr.game_id].append(pr.move_san)

    # Aggregate for opponent as white vs oppenent as black
    stats_white: Dict[Tuple[str, ...], List[float]] = defaultdict(list)
    stats_black_vs_e4: Dict[Tuple[str, ...], List[float]] = defaultdict(list)
    stats_black_vs_d4: Dict[Tuple[str, ...], List[float]] = defaultdict(list)

    for game_id, moves in branch_moves_by_game.items():
        meta = meta_by_id[game_id]
        if not meta.opponent_side:
            continue

        points = _opponent_points(meta.result or '', meta.opponent_side)
        key = tuple(moves)

        if meta.opponent_side == Side.WHITE:
            stats_white[key].append(points)
        else:
            # opponent is black: look at White's first move
            first = moves[0]
            if first.startswith('e4'):
                stats_black_vs_e4[key].append(points)
            elif first.startswith('d4'):
                stats_black_vs_d4[key].append(points)
            else:
                pass


    def top_list(stats: Dict[Tuple[str, ...], List[float]], side: Side, topn: int=10):
        out =[]
        for moves_key, pts_list in stats.items():
            out.append(OpeningBranchStat(
                side=side,
                moves_san=list(moves_key),
                games=len(pts_list),
                score=sum(pts_list) / max(1, len(pts_list))
            ))

        out.sort(key=lambda x: (x.games, x.score), reverse=True)
        return out[:topn]
    
    opponent_name = next((g.opponent_name for g in games if g.opponent_name), None)

    return OpeningProfile(
        opponent_name=opponent_name,
        opening_plies=cfg.opening_plies,
        as_white_top=top_list(stats_white, Side.WHITE),
        as_black_vs_e4_top=top_list(stats_black_vs_e4, Side.BLACK),
        as_black_vs_d4_top=top_list(stats_black_vs_d4, Side.BLACK)
    )