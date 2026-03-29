"""Fetch games from Chess.com as PGN for a given username."""
from __future__ import annotations

import json
import urllib.error
import urllib.request

_API_BASE = "https://api.chess.com/pub"
_HEADERS = {"User-Agent": "prepagent-chess/1.0"}


def _get(url: str) -> bytes:
    req = urllib.request.Request(url, headers=_HEADERS)
    with urllib.request.urlopen(req, timeout=20) as resp:
        return resp.read()


def get_profile(username: str) -> dict:
    """
    Return the Chess.com public profile for a player.
    Raises ValueError if the player is not found.
    """
    try:
        return json.loads(_get(f"{_API_BASE}/player/{username}"))
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            raise ValueError(f"Chess.com player not found: {username!r}")
        raise


def fetch_pgn(username: str, max_games: int = 500) -> str:
    """
    Fetch up to max_games recent games for a Chess.com user as a PGN string.

    Uses the /games/archives → /games/{year}/{month}/pgn pipeline:
      1. Fetch archive list (list of monthly archive URLs)
      2. Iterate months newest-first, download each month's raw PGN
      3. Stop once max_games games have been collected
    """
    try:
        data = json.loads(_get(f"{_API_BASE}/player/{username}/games/archives"))
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            raise ValueError(f"Chess.com player not found: {username!r}")
        raise

    archives: list[str] = data.get("archives", [])
    if not archives:
        return ""

    month_pgns: list[str] = []
    collected = 0

    for archive_url in reversed(archives):  # newest month first
        if collected >= max_games:
            break
        pgn_url = f"{archive_url}/pgn"
        try:
            raw = _get(pgn_url)
            pgn_text = raw.decode("utf-8", errors="replace").strip()
        except Exception:
            continue

        if not pgn_text:
            continue

        # Count games in this month's PGN block (each game starts with [Event)
        n_games = pgn_text.count("\n[Event ") + (1 if pgn_text.startswith("[Event ") else 0)

        month_pgns.append(pgn_text)
        collected += n_games

    # Reverse so the final PGN is in chronological (oldest-first) order
    return "\n\n".join(reversed(month_pgns))
