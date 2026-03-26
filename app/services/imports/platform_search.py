"""
Search for a chess player's accounts on Lichess and Chess.com by their real name.
Derives candidate usernames from the display name and checks each platform.
"""
from __future__ import annotations

import json
import logging
import urllib.request
from typing import Optional

logger = logging.getLogger(__name__)

_LICHESS_HEADERS = {"Accept": "application/json", "User-Agent": "prepagent-chess/1.0"}
_CHESSCOM_HEADERS = {"User-Agent": "prepagent-chess/1.0"}


def _candidate_usernames(display_name: str) -> list[str]:
    """Generate likely usernames from a real name like 'Magnus Carlsen'."""
    parts = display_name.lower().replace(",", " ").split()
    parts = [p for p in parts if p]
    candidates: list[str] = []
    if len(parts) >= 2:
        first, last = parts[0], parts[-1]
        candidates += [
            f"{first}{last}",
            f"{last}{first}",
            f"{first}_{last}",
            f"{last}_{first}",
            f"{first}.{last}",
        ]
    elif len(parts) == 1:
        candidates.append(parts[0])
    return candidates


def _fetch_json(url: str, headers: dict, timeout: int = 8) -> Optional[dict | list]:
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as exc:
        logger.debug("Fetch %s failed: %s", url, exc)
        return None


def search_lichess(display_name: str) -> list[dict]:
    """Return Lichess player profiles that plausibly match the real name."""
    candidates = _candidate_usernames(display_name)
    if not candidates:
        return []

    # Batch lookup via POST /api/users
    body = "\n".join(candidates).encode()
    req = urllib.request.Request(
        "https://lichess.org/api/users",
        data=body,
        headers={**_LICHESS_HEADERS, "Content-Type": "text/plain"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            users = json.loads(resp.read().decode("utf-8"))
    except Exception as exc:
        logger.debug("Lichess batch lookup failed: %s", exc)
        return []

    results = []
    for user in users:
        title = user.get("title") or ""
        # Lichess only grants titles after manual identity verification
        if not title:
            continue
        profile = user.get("profile") or {}
        real_name = (profile.get("realName") or "").strip()
        username = user.get("username", "")
        results.append({
            "platform": "lichess",
            "username": username,
            "real_name": real_name or None,
            "title": title,
            "url": f"https://lichess.org/@/{username}",
        })

    return results


def search_chesscom(display_name: str) -> list[dict]:
    """Return Chess.com profiles that plausibly match the real name."""
    candidates = _candidate_usernames(display_name)
    results = []
    seen: set[str] = set()

    for username in candidates:
        data = _fetch_json(
            f"https://api.chess.com/pub/player/{username}",
            _CHESSCOM_HEADERS,
        )
        if not data or not isinstance(data, dict):
            continue
        uname = data.get("username", "")
        if uname.lower() in seen:
            continue
        seen.add(uname.lower())

        title = (data.get("title") or "").strip()
        # A non-empty title (GM, IM, FM, …) is the reliable signal for a
        # verified titled player; the `verified` flag is not consistently set
        # by the Chess.com API for titled accounts.
        if not title:
            continue

        real_name = (data.get("name") or "").strip()

        results.append({
            "platform": "chesscom",
            "username": uname,
            "real_name": real_name or None,
            "title": title,
            "url": data.get("url") or f"https://www.chess.com/member/{uname}",
        })

    return results


def search_all(display_name: str) -> list[dict]:
    lichess = search_lichess(display_name)
    chesscom = search_chesscom(display_name)
    return lichess + chesscom
