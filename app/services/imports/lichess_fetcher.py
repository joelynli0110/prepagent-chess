"""Fetch games from Lichess as PGN for a given username."""
from __future__ import annotations

import urllib.error
import urllib.parse
import urllib.request

_BASE = "https://lichess.org/api/games/user"

_HEADERS = {
    "Accept": "application/x-chess-pgn",
    "User-Agent": "prepagent-chess/1.0",
}


def fetch_pgn(username: str, max_games: int = 100) -> str:
    """
    Fetch up to max_games games for a Lichess user as a PGN string.
    Includes bullet, blitz, rapid, and classical games.
    """
    params = urllib.parse.urlencode({
        "max": max_games,
        "perfType": "bullet,blitz,rapid,classical",
        "clocks": "true",
        "evals": "false",
        "opening": "true",
        "rated": "true",
    })
    url = f"{_BASE}/{urllib.parse.quote(username)}?{params}"
    req = urllib.request.Request(url, headers=_HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return resp.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        raise urllib.error.HTTPError(
            url, exc.code, f"Lichess returned {exc.code} for {username}", exc.headers, None
        ) from exc
