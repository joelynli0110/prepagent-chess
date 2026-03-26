"""Fetch games from Chess.com as PGN for a given username."""
from __future__ import annotations

import json
import urllib.error
import urllib.request

_HEADERS = {"User-Agent": "prepagent-chess/1.0"}


def _get(url: str) -> bytes:
    req = urllib.request.Request(url, headers=_HEADERS)
    with urllib.request.urlopen(req, timeout=15) as resp:
        return resp.read()


def fetch_pgn(username: str, max_games: int = 100) -> str:
    """
    Fetch up to max_games recent games for a Chess.com user as a PGN string.
    Iterates monthly archives from newest to oldest until enough games are collected.
    """
    archives_url = f"https://api.chess.com/pub/player/{username}/games/archives"
    try:
        data = json.loads(_get(archives_url))
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            raise ValueError(f"Chess.com player not found: {username!r}")
        raise

    archives: list[str] = data.get("archives", [])
    if not archives:
        return ""

    pgn_parts: list[str] = []
    collected = 0

    for archive_url in reversed(archives):  # newest first
        if collected >= max_games:
            break
        try:
            month_data = json.loads(_get(archive_url))
        except Exception:
            continue

        games = month_data.get("games", [])
        for game in reversed(games):  # newest first within month
            if collected >= max_games:
                break
            pgn = game.get("pgn", "").strip()
            if pgn:
                pgn_parts.append(pgn)
                collected += 1

    return "\n\n".join(reversed(pgn_parts))  # chronological order
