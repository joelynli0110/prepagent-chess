"""
Search for a chess player's accounts on Lichess and Chess.com by their real name.
Derives candidate usernames from the display name and checks each platform.
Enriches results with FIDE profile data (nationality, birth year).
"""
from __future__ import annotations

import json
import logging
import re
import time
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
        # Single-name candidates first — titled players on Chess.com almost
        # always use just their first name (e.g. "hikaru", "magnuscarlsen").
        candidates += [
            first,
            last,
            f"{first}{last}",
            f"{last}{first}",
            f"{first}_{last}",
            f"{last}_{first}",
            f"{first}.{last}",
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


_FIDE_FULL_TITLE_MAP = {
    "grandmaster": "GM",
    "international master": "IM",
    "fide master": "FM",
    "candidate master": "CM",
    "woman grandmaster": "WGM",
    "woman international master": "WIM",
    "woman fide master": "WFM",
    "woman candidate master": "WCM",
}


def _fetch_fide_profile(fide_id: int) -> Optional[dict]:
    """Scrape full profile data from a FIDE profile page."""
    url = f"https://ratings.fide.com/profile/{fide_id}"
    req = urllib.request.Request(url, headers=_FIDE_HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            html = resp.read().decode("utf-8")
    except Exception as exc:
        logger.debug("FIDE profile %s fetch failed: %s", fide_id, exc)
        return None

    result: dict = {"fide_id": fide_id, "fide_url": url}

    # Name from <h1 class="player-title">Last, First</h1>
    m = re.search(r'class="player-title"[^>]*>([^<]+)</h1>', html)
    if m:
        raw = m.group(1).strip()
        if "," in raw:
            last, first = raw.split(",", 1)
            result["name"] = f"{first.strip()} {last.strip()}"
        else:
            result["name"] = raw

    # Photo as base64 data URL
    m = re.search(r'class="profile-top__photo"[^>]+src="(data:image/[^"]+)"', html)
    if m:
        result["photo_url"] = m.group(1)

    # Ratings from profile-standart / profile-rapid / profile-blitz divs
    m = re.search(r'class="profile-standart[^"]*"[^>]*>.*?<p>(\d{3,4})</p>', html, re.DOTALL)
    if m:
        result["rating_std"] = int(m.group(1))
    m = re.search(r'class="profile-rapid[^"]*"[^>]*>.*?<p>(\d{3,4})</p>', html, re.DOTALL)
    if m:
        result["rating_rapid"] = int(m.group(1))
    m = re.search(r'class="profile-blitz[^"]*"[^>]*>.*?<p>(\d{3,4})</p>', html, re.DOTALL)
    if m:
        result["rating_blitz"] = int(m.group(1))

    # Title — full name like "Grandmaster" → abbreviation
    m = re.search(r'class="profile-info-title[^"]*"[^>]*>.*?<p>([^<]+)</p>', html, re.DOTALL)
    if m:
        full = m.group(1).strip().lower()
        result["title"] = _FIDE_FULL_TITLE_MAP.get(full, m.group(1).strip() or None)

    # Birth year
    m = re.search(r'class="profile-info-byear[^"]*"[^>]*>\s*(\d{4})', html)
    if m:
        result["birth_year"] = int(m.group(1))

    # Nationality (full name) and federation ISO2 from flag src
    m = re.search(r'class="profile-info-country[^"]*"[^>]*>.*?<img[^>]+/([a-z]{2})\.svg[^>]*>([^<]+)', html, re.DOTALL)
    if m:
        result["federation_iso2"] = m.group(1).upper()
        result["nationality"] = m.group(2).strip()

    # Gender
    m = re.search(r'class="profile-info-sex[^"]*"[^>]*>\s*([^\n<]+)', html)
    if m:
        result["gender"] = m.group(1).strip() or None

    return result


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


# Titles Chess.com recognises, ordered from most to least common among top players.
_CHESSCOM_TITLES = ["GM", "WGM", "IM", "WIM", "FM", "WFM", "NM", "WNM", "CM", "WCM"]


def _fetch_titled_usernames(title: str) -> list[str]:
    """Fetch all Chess.com usernames for a given title abbreviation."""
    data = _fetch_json(
        f"https://api.chess.com/pub/titled/{title}",
        _CHESSCOM_HEADERS,
        timeout=20,
    )
    if not data or not isinstance(data, dict):
        return []
    return data.get("players", [])


def _name_tokens(name: str) -> set[str]:
    """Lower-case name parts: 'Hikaru Nakamura' → {'hikaru', 'nakamura'}."""
    return {p.strip().lower() for p in re.split(r"[\s,._-]+", name) if p.strip()}


def _profile_from_username(username: str) -> Optional[dict]:
    data = _fetch_json(
        f"https://api.chess.com/pub/player/{username}",
        _CHESSCOM_HEADERS,
    )
    if not data or not isinstance(data, dict):
        return None
    return data


def search_chesscom(display_name: str, title_hint: Optional[str] = None) -> list[dict]:
    """
    Search Chess.com for a titled player matching *display_name*.

    Strategy (agentic):
      1. Determine which title lists to check (use FIDE title hint when available,
         otherwise try all common titles in order).
      2. Fetch the full titled-player list for each title via
         GET /pub/titled/{TITLE} — this returns every Chess.com username that
         holds that title, typically a few hundred to ~3 000 entries.
      3. Shortlist usernames whose text overlaps with the display name
         (e.g. 'hikaru' appears in 'Hikaru Nakamura' tokens).
      4. For each shortlisted username, fetch the profile and check the `name`
         field for a match. Return on first confirmed hit.
    """
    query_tokens = _name_tokens(display_name)
    if not query_tokens:
        return []

    # Which title lists to search
    if title_hint:
        titles_to_try = [title_hint.upper()]
        # Add the remaining titles as fallback
        titles_to_try += [t for t in _CHESSCOM_TITLES if t != title_hint.upper()]
    else:
        titles_to_try = _CHESSCOM_TITLES

    for title in titles_to_try:
        usernames = _fetch_titled_usernames(title)
        if not usernames:
            continue

        # Shortlist: keep usernames that share at least one token with the name
        candidates = [
            u for u in usernames
            if _name_tokens(u) & query_tokens
        ]
        logger.debug(
            "Chess.com titled/%s: %d total, %d candidates for %r",
            title, len(usernames), len(candidates), display_name,
        )

        for username in candidates:
            profile = _profile_from_username(username)
            time.sleep(0.2)
            if not profile:
                continue

            uname = profile.get("username", "")
            real_name = (profile.get("name") or "").strip()

            # Accept if the real name on the profile shares tokens with our query,
            # or if there's only one candidate (username already matched).
            profile_tokens = _name_tokens(real_name) if real_name else set()
            if len(candidates) == 1 or (profile_tokens & query_tokens):
                country_url = profile.get("country") or ""
                country = country_url.split("/")[-1] if country_url else None
                return [{
                    "platform": "chesscom",
                    "username": uname,
                    "real_name": real_name or None,
                    "title": title,
                    "country": country or None,
                    "avatar": profile.get("avatar") or None,
                    "url": profile.get("url") or f"https://www.chess.com/member/{uname}",
                }]

    return []


def build_player_profile(display_name: str) -> Optional[dict]:
    """
    Build a player profile dict from FIDE data only.
    Returns None when no FIDE record is found.

    Sources:
      - FIDE search  → FIDE ID
      - FIDE profile page → name, title, photo, ratings, nationality, birth_year, gender
    """
    from datetime import date as _date

    # 1. FIDE search — get the FIDE ID
    fide_results = search_fide_players(display_name, max_results=1)
    if not fide_results:
        return None

    fide_id = fide_results[0].get("fide_id")
    if not fide_id:
        return None

    # 2. FIDE profile page — all data including photo
    profile = _fetch_fide_profile(fide_id)
    if not profile:
        return None

    # Fall back search result fields for anything the profile page missed
    sr = fide_results[0]
    if not profile.get("name"):
        profile["name"] = sr.get("name")
    if not profile.get("title"):
        profile["title"] = sr.get("title")
    if not profile.get("birth_year"):
        profile["birth_year"] = sr.get("birth_year")
    if not profile.get("rating_std"):
        profile["rating_std"] = sr.get("rating_std")
    if not profile.get("rating_rapid"):
        profile["rating_rapid"] = sr.get("rating_rapid")
    if not profile.get("rating_blitz"):
        profile["rating_blitz"] = sr.get("rating_blitz")

    # Derived
    by = profile.get("birth_year")
    if by:
        profile["age"] = _date.today().year - by

    return profile


def search_all(display_name: str) -> list[dict]:
    """Search Chess.com for accounts matching the player and enrich with FIDE data."""
    results = search_chesscom(display_name)

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
