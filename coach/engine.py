from __future__ import annotations

import sys
import asyncio
import chess.engine


# Fix Windows asyncio subprocess issue
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())


class StockfishEngine:
    """Simple wrapper around python-chess engine for Stockfish."""

    def __init__(self, path: str = "stockfish"):
        self.path = path
        self.engine = chess.engine.SimpleEngine.popen_uci(path)

    def close(self):
        """Close the engine process."""
        self.engine.quit()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
