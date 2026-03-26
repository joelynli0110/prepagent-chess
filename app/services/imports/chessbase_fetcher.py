from __future__ import annotations

import re
import urllib.error
import urllib.request


_PGN_BASE = "https://players.chessbase.com/games"

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://players.chessbase.com/",
}


def parse_player_slug(url: str) -> str:
    """
    Extract the LastName_FirstName slug from a ChessBase player URL.

    Accepted formats:
      https://players.chessbase.com/en/player/Carlsen_Magnus/40108
      Carlsen_Magnus
    """
    # Full URL — grab the path segment after /player/
    match = re.search(r"/player/([^/?#]+)", url)
    if match:
        return match.group(1)

    # Bare slug like "Carlsen_Magnus"
    slug = url.strip().strip("/")
    if re.fullmatch(r"[A-Za-z]+_[A-Za-z]+", slug):
        return slug

    raise ValueError(
        f"Cannot parse ChessBase player slug from: {url!r}. "
        "Expected a URL like https://players.chessbase.com/en/player/Carlsen_Magnus/40108"
    )


def fetch_pgn(player_url: str) -> tuple[str, str]:
    """
    Fetch the PGN file for a ChessBase player.

    Returns (slug, pgn_text).
    Raises ValueError for bad URLs, urllib.error.HTTPError for HTTP failures.
    """
    slug = parse_player_slug(player_url)
    pgn_url = f"{_PGN_BASE}/{slug}.pgn"

    req = urllib.request.Request(pgn_url, headers=_HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read()
    except urllib.error.HTTPError as exc:
        raise urllib.error.HTTPError(
            pgn_url, exc.code, f"ChessBase returned {exc.code} for {pgn_url}", exc.headers, None
        ) from exc

    # ChessBase PGN files are typically latin-1 encoded
    try:
        pgn_text = raw.decode("utf-8")
    except UnicodeDecodeError:
        pgn_text = raw.decode("latin-1")

    return slug, pgn_text
