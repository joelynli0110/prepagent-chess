"""
Search for a chess player's accounts on Lichess and Chess.com by their real name.
Derives candidate usernames from the display name and checks each platform.
Enriches results with FIDE profile data (nationality, birth year).
"""
from __future__ import annotations

import json
import logging
import re
import urllib.parse
import urllib.request
from typing import Optional

logger = logging.getLogger(__name__)

_LICHESS_HEADERS = {"Accept": "application/json", "User-Agent": "prepagent-chess/1.0"}
_CHESSCOM_HEADERS = {"User-Agent": "prepagent-chess/1.0"}
_FIDE_SEARCH_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; prepagent-chess/1.0)",
    "Accept": "text/html,application/xhtml+xml",
    "Referer": "https://ratings.fide.com/",
    "X-Requested-With": "XMLHttpRequest",
}
_FIDE_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; prepagent-chess/1.0)",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}


_TITLE_PREFIXES = ("gm", "im", "fm", "wgm", "wim", "wfm")


def _candidate_usernames(display_name: str) -> list[str]:
    """Generate likely usernames from a real name like 'Magnus Carlsen'.

    Includes standalone first/last name (e.g. 'hikaru' for Nakamura on
    Chess.com) and title-prefixed variants (e.g. 'gmhikaru' which matches
    Lichess user 'GMHikaru' since Lichess lookups are case-insensitive).
    """
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
            first,
            last,
        ]
        for pfx in _TITLE_PREFIXES:
            candidates.append(f"{pfx}{first}")
            candidates.append(f"{pfx}{last}")
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


# ---------------------------------------------------------------------------
# FIDE player search (search.fide.com AJAX endpoint)
# ---------------------------------------------------------------------------

# Maps single-letter FIDE title codes (used in the search table) to
# standard abbreviations.
_FIDE_TITLE_MAP: dict[str, str] = {
    "g": "GM", "m": "IM", "f": "FM", "c": "CM",
    "wg": "WGM", "wm": "WIM", "wf": "WFM", "wc": "WCM",
}


def _parse_fide_search_html(html: str) -> list[dict]:
    """Parse the HTML table returned by the FIDE search AJAX endpoint."""
    results: list[dict] = []
    rows = re.findall(r"<tr>\s*(.*?)\s*</tr>", html, re.DOTALL)
    for row in rows:
        if "<th" in row:
            continue

        fide_id_m = re.search(r'data-label="FIDEID"[^>]*>\s*(\d+)', row)
        if not fide_id_m:
            continue
        fide_id = int(fide_id_m.group(1))

        name_m = re.search(r'class="found_name">([^<]+)', row)
        if not name_m:
            continue
        fide_name = name_m.group(1).strip()  # "Carlsen, Magnus"

        # Convert "Last, First" → "First Last" for display
        if "," in fide_name:
            last, first = fide_name.split(",", 1)
            display_name = f"{first.strip()} {last.strip()}"
        else:
            display_name = fide_name

        title_m = re.search(r'data-label="title"[^>]*>\s*([^\s<][^<]*?)\s*</td>', row)
        raw_title = (title_m.group(1).strip() if title_m else "").lower()
        title: Optional[str] = _FIDE_TITLE_MAP.get(raw_title) or (raw_title.upper() if raw_title else None)

        fed_m = re.search(r'alt="([A-Z]{2,4})"', row)
        federation: Optional[str] = fed_m.group(1) if fed_m else None

        # All three rating cells share data-label="Rtg" — extract in order
        all_rtg = re.findall(r'data-label="Rtg"[^>]*>\s*(\d*)', row)
        def _rtg(idx: int) -> Optional[int]:
            v = all_rtg[idx].strip() if idx < len(all_rtg) else ""
            return int(v) if v.isdigit() else None
        rating_std:   Optional[int] = _rtg(0)
        rating_rapid: Optional[int] = _rtg(1)
        rating_blitz: Optional[int] = _rtg(2)

        birth_m = re.search(r'data-label="B-Year"[^>]*>\s*(\d{4})', row)
        birth_year: Optional[int] = int(birth_m.group(1)) if birth_m else None

        results.append({
            "fide_id": fide_id,
            "name": display_name,
            "fide_name": fide_name,
            "title": title,
            "federation": federation,
            "birth_year": birth_year,
            "rating_std": rating_std,
            "rating_rapid": rating_rapid,
            "rating_blitz": rating_blitz,
            "fide_url": f"https://ratings.fide.com/profile/{fide_id}",
        })

    return results


def search_fide_players(query: str, max_results: int = 15) -> list[dict]:
    """
    Search the FIDE ratings database for players matching *query*.
    Returns up to *max_results* candidates with name, title, federation,
    birth year, standard rating, and FIDE profile URL.
    """
    if not query or len(query) < 2:
        return []
    encoded = urllib.parse.quote(query)
    url = f"https://ratings.fide.com/incl_search_l.php?search={encoded}"
    req = urllib.request.Request(url, headers=_FIDE_SEARCH_HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            html = resp.read().decode("utf-8")
    except Exception as exc:
        logger.debug("FIDE player search failed: %s", exc)
        return []

    players = _parse_fide_search_html(html)
    players.sort(key=lambda p: p.get("rating_std") or 0, reverse=True)
    return players[:max_results]


# ---------------------------------------------------------------------------
# FIDE helpers (profile enrichment used by search_all)
# ---------------------------------------------------------------------------

def _search_fide_id(display_name: str) -> Optional[int]:
    """Search ratings.fide.com for a player name and return their FIDE ID."""
    encoded = urllib.parse.quote(display_name)
    url = f"https://ratings.fide.com/incl_search_l.php?search={encoded}&simple=1"
    req = urllib.request.Request(url, headers={
        **_FIDE_HEADERS,
        "Referer": "https://ratings.fide.com/",
        "X-Requested-With": "XMLHttpRequest",
    })
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            html = resp.read().decode("utf-8")
    except Exception as exc:
        logger.debug("FIDE search failed: %s", exc)
        return None

    m = re.search(r'/profile/(\d+)', html)
    if m:
        return int(m.group(1))
    return None


def _fetch_fide_profile(fide_id: int) -> Optional[dict]:
    """Scrape birth year and federation from a FIDE profile page."""
    url = f"https://ratings.fide.com/profile/{fide_id}"
    req = urllib.request.Request(url, headers=_FIDE_HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            html = resp.read().decode("utf-8")
    except Exception as exc:
        logger.debug("FIDE profile %s fetch failed: %s", fide_id, exc)
        return None

    birth_year: Optional[int] = None
    m = re.search(r'class="profile-info-byear[^"]*"[^>]*>\s*(\d{4})', html)
    if m:
        birth_year = int(m.group(1))

    federation: Optional[str] = None
    m = re.search(
        r'class="profile-info-country[^"]*">.*?<img[^>]+>\s*([^\n<]+)',
        html,
        re.DOTALL,
    )
    if m:
        federation = m.group(1).strip()

    gender: Optional[str] = None
    m = re.search(r'class="profile-info-sex[^"]*"[^>]*>\s*([^\n<]+)', html)
    if m:
        gender = m.group(1).strip() or None

    # Standard rating (first profile-top-rating-value on the page)
    rating_std: Optional[int] = None
    m = re.search(r'class="profile-top-rating-value[^"]*"[^>]*>\s*(\d{3,4})', html)
    if m:
        rating_std = int(m.group(1))

    return {
        "fide_id": fide_id,
        "birth_year": birth_year,
        "federation": federation,
        "gender": gender,
        "rating_std": rating_std,
        "fide_url": url,
    }


# ---------------------------------------------------------------------------
# Platform searches
# ---------------------------------------------------------------------------

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
        country = profile.get("country") or None  # ISO-3166-1 alpha-2, e.g. "NO"
        username = user.get("username", "")
        results.append({
            "platform": "lichess",
            "username": username,
            "real_name": real_name or None,
            "title": title,
            "country": country,
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

        # country field is a URL like "https://api.chess.com/pub/country/NO"
        country_url = data.get("country") or ""
        country = country_url.split("/")[-1] if country_url else None

        results.append({
            "platform": "chesscom",
            "username": uname,
            "real_name": real_name or None,
            "title": title,
            "country": country or None,
            "avatar": data.get("avatar") or None,
            "url": data.get("url") or f"https://www.chess.com/member/{uname}",
        })

    return results


def build_player_profile(display_name: str) -> Optional[dict]:
    """
    Build a player profile dict from FIDE + Chess.com data.
    Returns None only when no FIDE record is found at all.

    Sources:
      - FIDE search  → name, title, federation, birth_year, rating_std, fide_url
      - FIDE profile → gender (and rating fallback)
      - Chess.com    → avatar photo URL
    """
    from datetime import date as _date

    # 1. FIDE search — primary source for player identity
    fide_results = search_fide_players(display_name, max_results=1)
    if not fide_results:
        return None

    fide = fide_results[0]
    profile: dict = {
        "name": fide.get("name"),
        "title": fide.get("title"),
        "federation": fide.get("federation"),
        "birth_year": fide.get("birth_year"),
        "rating_std": fide.get("rating_std"),
        "rating_rapid": fide.get("rating_rapid"),
        "rating_blitz": fide.get("rating_blitz"),
        "fide_id": fide.get("fide_id"),
        "fide_url": fide.get("fide_url"),
    }

    # 2. FIDE profile page — gender + rating fallback
    fide_id = fide.get("fide_id")
    if fide_id:
        fide_page = _fetch_fide_profile(fide_id)
        if fide_page:
            profile["gender"] = fide_page.get("gender")
            if not profile.get("birth_year"):
                profile["birth_year"] = fide_page.get("birth_year")
            if not profile.get("federation"):
                profile["federation"] = fide_page.get("federation")
            if not profile.get("rating_std"):
                profile["rating_std"] = fide_page.get("rating_std")

    # 3. Chess.com — avatar
    chesscom = search_chesscom(display_name)
    if chesscom and chesscom[0].get("avatar"):
        profile["photo_url"] = chesscom[0]["avatar"]

    # 4. Derived fields
    by = profile.get("birth_year")
    if by:
        profile["age"] = _date.today().year - by

    return profile


def search_all(display_name: str) -> list[dict]:
    """Search all platforms and enrich results with FIDE profile data."""
    results = search_lichess(display_name) + search_chesscom(display_name)

    fide_id = _search_fide_id(display_name)
    fide = _fetch_fide_profile(fide_id) if fide_id else None

    if fide:
        for r in results:
            r["birth_year"] = fide.get("birth_year")
            r["fide_url"] = fide.get("fide_url")
            # Prefer the platform's own country code; fall back to FIDE federation
            if not r.get("country"):
                r["country"] = fide.get("federation")
    else:
        for r in results:
            r["birth_year"] = None
            r["fide_url"] = None

    return results
