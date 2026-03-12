from __future__ import annotations

from typing import Optional

import chess


def detect_opening_from_moves(moves_san: list[str]) -> tuple[Optional[str], Optional[str]]:
    """
    Lightweight fallback opening detector.
    Returns (eco, opening_name).
    Expand gradually over time.
    """
    seq = " ".join(moves_san[:8])

    patterns = [
        ("C50", "Italian Game", ["e4", "e5", "Nf3", "Nc6", "Bc4"]),
        ("C60", "Ruy Lopez", ["e4", "e5", "Nf3", "Nc6", "Bb5"]),
        ("B20", "Sicilian Defense", ["e4", "c5"]),
        ("B10", "Caro-Kann Defense", ["e4", "c6"]),
        ("C00", "French Defense", ["e4", "e6"]),
        ("B01", "Scandinavian Defense", ["e4", "d5"]),
        ("D00", "Queen's Pawn Game", ["d4", "d5"]),
        ("D06", "Queen's Gambit", ["d4", "d5", "c4"]),
        ("E60", "King's Indian Defense", ["d4", "Nf6", "c4", "g6"]),
        ("A04", "Reti Opening", ["Nf3"]),
    ]

    for eco, name, pattern in patterns:
        if len(moves_san) >= len(pattern) and moves_san[:len(pattern)] == pattern:
            return eco, name

    return None, None