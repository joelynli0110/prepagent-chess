from typing import Any

import chess
import chess.engine

from app.config import settings


class StockfishClient:
    def __init__(self, path: str | None = None):
        self.path = path or settings.stockfish_path

    def analyze_position(self, fen: str, depth: int = 12) -> dict[str, Any]:
        board = chess.Board(fen)
        with chess.engine.SimpleEngine.popen_uci(self.path) as engine:
            info = engine.analyse(board, chess.engine.Limit(depth=depth))
            score = info["score"].white().score(mate_score=100000)
            pv = [move.uci() for move in info.get("pv", [])]
            return {
                "score_cp": score,
                "best_move_uci": pv[0] if pv else None,
                "pv": pv,
            }