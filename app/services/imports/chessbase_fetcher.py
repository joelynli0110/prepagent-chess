from __future__ import annotations

import json
import re
import urllib.error
import urllib.request
from typing import Optional


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


def fetch_player_profile(slug: str) -> Optional[dict]:
    """
    Fetch structured player data from the ChessBase player page via JSON-LD.
    Returns a dict with photo_url, name, nationality, birth_year, title,
    fide_id, chessbase_id, and chessbase_url — or None on failure.
    """
    url = f"https://players.chessbase.com/en/player/{slug}"
    req = urllib.request.Request(url, headers=_HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            html = resp.read().decode("utf-8")
    except Exception:
        return None

    m = re.search(r'<script type="application/ld\+json">\s*(.*?)\s*</script>', html, re.DOTALL)
    if not m:
        return None
    try:
        data = json.loads(m.group(1))
    except Exception:
        return None
    if data.get("@type") != "Person":
        return None

    # Photo
    photo_url: Optional[str] = None
    image = data.get("image")
    if isinstance(image, dict):
        photo_url = image.get("url") or image.get("contentUrl")
    elif isinstance(image, str):
        photo_url = image
    if photo_url and photo_url.startswith("/"):
        photo_url = f"https://players.chessbase.com{photo_url}"

    # Nationality (full country name, e.g. "Norway")
    nationality: Optional[str] = None
    nat = data.get("nationality")
    if isinstance(nat, dict):
        nationality = nat.get("name")
    elif isinstance(nat, str):
        nationality = nat

    # Birth year
    birth_year: Optional[int] = None
    bd = data.get("birthDate")
    if bd:
        try:
            birth_year = int(str(bd)[:4])
        except (ValueError, TypeError):
            pass

    # Chess title: "GM (Chess Title)" → "GM"
    title: Optional[str] = None
    jt = (data.get("jobTitle") or "").strip()
    if jt:
        title = jt.split("(")[0].strip() or None

    # FIDE ID and ChessBase ID from identifier array
    fide_id: Optional[int] = None
    chessbase_id: Optional[int] = None
    for ident in data.get("identifier", []):
        if not isinstance(ident, dict):
            continue
        prop = ident.get("propertyID", "")
        val = ident.get("value")
        if prop == "FIDE" and val:
            try:
                fide_id = int(val)
            except (ValueError, TypeError):
                pass
        elif prop == "ChessBaseID" and val:
            try:
                chessbase_id = int(val)
            except (ValueError, TypeError):
                pass

    return {
        "photo_url": photo_url,
        "name": data.get("name"),
        "nationality": nationality,
        "birth_year": birth_year,
        "title": title,
        "fide_id": fide_id,
        "chessbase_id": chessbase_id,
        "chessbase_url": url,
    }
