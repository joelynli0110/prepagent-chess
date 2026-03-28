from typing import Any, Optional

import chess
import chess.engine

from app.config import settings


class StockfishClient:
    """Wraps a Stockfish process with a persistent engine and in-memory FEN cache.

    Use as a context manager for bulk analysis so the engine process is opened
    once and shared across all positions:

        with StockfishClient() as client:
            result = client.analyze_position(fen, depth=12)

    When called outside a context manager the engine is opened and closed
    per call (safe for single-position use, slower for bulk).
    """

    def __init__(self, path: str | None = None):
        self.path = path or settings.stockfish_path
        self._engine: Optional[chess.engine.SimpleEngine] = None
        # (fen, depth) → {score_cp, best_move_uci, pv}
        self._cache: dict[tuple[str, int], dict[str, Any]] = {}

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def open(self) -> None:
        if self._engine is None:
            self._engine = chess.engine.SimpleEngine.popen_uci(self.path)

    def close(self) -> None:
        if self._engine is not None:
            try:
                self._engine.quit()
            except Exception:
                pass
            self._engine = None

    def __enter__(self) -> "StockfishClient":
        self.open()
        return self

    def __exit__(self, *_: object) -> None:
        self.close()

    # ------------------------------------------------------------------
    # Analysis
    # ------------------------------------------------------------------

    def analyze_position(self, fen: str, depth: int = 12) -> dict[str, Any]:
        key = (fen, depth)
        if key in self._cache:
            return self._cache[key]

        # Also accept a hit from a deeper cached result for the same FEN
        for cached_depth in range(depth + 1, depth + 10):
            deeper_key = (fen, cached_depth)
            if deeper_key in self._cache:
                result = self._cache[deeper_key]
                self._cache[key] = result
                return result

        opened_here = self._engine is None
        if opened_here:
            self.open()

        try:
            board = chess.Board(fen)
            info = self._engine.analyse(board, chess.engine.Limit(depth=depth))  # type: ignore[union-attr]
            score_cp = info["score"].white().score(mate_score=100_000)
            pv = [move.uci() for move in info.get("pv", [])]
            result = {
                "score_cp": score_cp,
                "best_move_uci": pv[0] if pv else None,
                "pv": pv,
            }
            self._cache[key] = result
            return result
        finally:
            if opened_here:
                self.close()
