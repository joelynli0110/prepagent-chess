from __future__ import annotations

from typing import List, Optional, Tuple
import chess
import chess.engine

from .types import GameMeta, PlyRecord, PrepConfig, BlunderEvent, Severity, Side
from coach.engine import StockfishEngine # reuse existing engine wrapper


def _score_to_cp_mate_pov(score: chess.engine.Score, pov_color: chess.Color) -> Tuple[Optional[int], Optional[int]]:
    pov = score.pov(pov_color)
    if pov.ismate():
        return None, pov.mate()
    return pov.score(mate_score=100000), None


def _mate_or_cp_to_numeric(cp: Optional[int], mate_in: Optional[int]) -> int:
    if mate_in is not None:
        sign = 1 if mate_in > 0 else -1
        return sign * (100000 - 1000 * abs(mate_in))
    return int (cp or 0)


def extract_opponent_blunders(
    games: List[GameMeta],
    plies: List[PlyRecord],
    cfg: PrepConfig,
) -> List[BlunderEvent]:
    meta_by_id = {g.game_id: g for g in games}

    # Configure engine from cfg
    eng = StockfishEngine(path=cfg.stockfish_path)
    eng.engine.configure({"Threads": cfg.engine_threads, "Hash": cfg.engine_hash_mb})

    limit = chess.engine.Limit(time=cfg.engine_movetime_ms / 1000.0)
    out: List[BlunderEvent] = []

    try:
        for pr in plies:
            meta = meta_by_id[pr.game_id]
            if not meta.opponent_side:
                continue

            # only evaluate moves made by opponent
            if pr.side_who_moved != meta.opponent_side:
                continue

            board_before = chess.Board(pr.fen_before)
            opponent_color = chess.WHITE if meta.opponent_side == Side.WHITE else chess.BLACK

            # Evaluate before (best play for opponent)
            info_before = eng.engine.analyse(board_before, limit)
            cp_b, mate_b = _score_to_cp_mate_pov(info_before["score"], opponent_color)

            # Evaluate after (best play after opponent played their move)
            board_after = chess.Board(pr.fen_after)
            info_afer = eng.engine.analyse(board_after, limit)
            cp_a, mate_a = _score_to_cp_mate_pov(info_afer["score"], opponent_color)

            before_num = _mate_or_cp_to_numeric(cp_b, mate_b)
            after_num = _mate_or_cp_to_numeric(cp_a, mate_a)
            drop = before_num - after_num

            if drop < cfg.mistake_drop_cp:
                continue

            severity = Severity.BLUNDER if drop >= cfg.blunder_drop_cp else Severity.MISTAKE

            # refutation: best line for the side to move in after-position (opponent's opponent)
            info_ref = eng.engine.analyse(board_after, limit)
            pv = info_ref.get("pv", [])
            pv_uci = [m.uci() for m in pv] [:10]
            first = pv_uci[0] if pv_uci else None

            out.append(BlunderEvent(
                game_id=pr.game_id,
                ply=pr.ply,
                opponent_side=meta.opponent_side,
                fen_before=pr.fen_before,
                pos_key=pr.pos_key,
                opening_key=pr.opening_key,
                played_move_uci=pr.move_uci,
                played_move_san=pr.move_san,
                drop_cp_equiv=int(drop),
                severity=severity,
                refutation_pv_uci=pv_uci,
                refutation_first_uci=first
            ))

    finally:
        eng.close()

    # Sort biggest first
    out.sort(key=lambda x: x.drop_cp_equiv, reverse=True)
    return out