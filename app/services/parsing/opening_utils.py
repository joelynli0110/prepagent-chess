from __future__ import annotations

from typing import Optional

from app.services.parsing.opening_book import lookup_opening


def detect_opening_from_moves(moves_san: list[str]) -> tuple[Optional[str], Optional[str]]:
    """
    Detect opening ECO and name from a list of SAN moves by replaying the
    position and looking up each EPD in the lichess ECO book.

    Returns the deepest (most specific) match found, i.e. the last position
    that appears in the opening book.
    """
    import chess

    board = chess.Board()
    best_eco: Optional[str] = None
    best_name: Optional[str] = None

    for san in moves_san:
        try:
            move = board.parse_san(san)
        except Exception:
            break
        board.push(move)
        epd = board.epd()
        result = lookup_opening(epd)
        if result:
            best_eco, best_name = result

    return best_eco, best_name
