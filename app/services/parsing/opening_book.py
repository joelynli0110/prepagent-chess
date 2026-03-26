"""
ECO opening book backed by the lichess-org/chess-openings TSV dataset.

The TSV has columns: eco, name, pgn
We replay each PGN line to compute the final board EPD, then build a
dict: EPD -> (eco, name) for fast position-based lookup.

The processed dict is cached in a pickle file next to this module so
the expensive build step only runs once.
"""
from __future__ import annotations

import csv
import io
import logging
import os
import pickle
import urllib.request
from functools import lru_cache
from typing import Optional

import chess
import chess.pgn

logger = logging.getLogger(__name__)

_DIR = os.path.dirname(__file__)
_TSV_CACHE = os.path.join(_DIR, "_eco_raw.tsv")
_BOOK_CACHE = os.path.join(_DIR, "_eco_book.pkl")

_TSV_URLS = [
    "https://raw.githubusercontent.com/lichess-org/chess-openings/master/a.tsv",
    "https://raw.githubusercontent.com/lichess-org/chess-openings/master/b.tsv",
    "https://raw.githubusercontent.com/lichess-org/chess-openings/master/c.tsv",
    "https://raw.githubusercontent.com/lichess-org/chess-openings/master/d.tsv",
    "https://raw.githubusercontent.com/lichess-org/chess-openings/master/e.tsv",
]


def _download_tsv() -> str:
    parts: list[str] = []
    header_written = False
    for url in _TSV_URLS:
        logger.info("Downloading opening book: %s", url)
        req = urllib.request.Request(url, headers={"User-Agent": "prepagent-chess/1.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            text = resp.read().decode("utf-8")
        lines = text.splitlines()
        if not header_written:
            parts.append(lines[0])
            header_written = True
        parts.extend(lines[1:])
    return "\n".join(parts)


def _pgn_to_epd(pgn_moves: str) -> Optional[str]:
    """Replay a PGN move string and return the final board EPD."""
    try:
        game = chess.pgn.read_game(io.StringIO(f"{pgn_moves} *"))
        if game is None:
            return None
        board = game.board()
        for move in game.mainline_moves():
            board.push(move)
        return board.epd()
    except Exception:
        return None


def _build_book(tsv: str) -> dict[str, tuple[str, str]]:
    book: dict[str, tuple[str, str]] = {}
    reader = csv.DictReader(io.StringIO(tsv), delimiter="\t")
    for row in reader:
        eco = row.get("eco", "").strip()
        name = row.get("name", "").strip()
        pgn = row.get("pgn", "").strip()
        if not (eco and name and pgn):
            continue
        epd = _pgn_to_epd(pgn)
        if epd:
            # Longer PGN = more specific variation; keep it
            book[epd] = (eco, name)
    return book


def _load_or_build() -> dict[str, tuple[str, str]]:
    # Use pickled book if available
    if os.path.exists(_BOOK_CACHE):
        try:
            with open(_BOOK_CACHE, "rb") as f:
                book = pickle.load(f)
            if book:
                logger.info("Loaded ECO book from cache (%d entries)", len(book))
                return book
        except Exception:
            pass

    # Download TSV (use local copy if already fetched)
    if os.path.exists(_TSV_CACHE):
        with open(_TSV_CACHE, encoding="utf-8") as f:
            tsv = f.read()
    else:
        tsv = _download_tsv()
        with open(_TSV_CACHE, "w", encoding="utf-8") as f:
            f.write(tsv)

    logger.info("Building ECO position index…")
    book = _build_book(tsv)
    logger.info("Built ECO book with %d entries", len(book))

    with open(_BOOK_CACHE, "wb") as f:
        pickle.dump(book, f)

    return book


# Module-level cache — not lru_cache so failures don't get cached
_book: Optional[dict[str, tuple[str, str]]] = None


def load_eco_book() -> dict[str, tuple[str, str]]:
    global _book
    if _book is None:
        try:
            _book = _load_or_build()
        except Exception as exc:
            logger.warning("Could not load ECO opening book: %s", exc)
            _book = {}
    return _book


def lookup_opening(epd: str) -> Optional[tuple[str, str]]:
    """Return (eco, name) for the given EPD, or None if not in the book."""
    return load_eco_book().get(epd)
