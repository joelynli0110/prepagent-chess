import logging

from fastapi import APIRouter, HTTPException

from app.services.imports.platform_search import search_fide_players

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/players", tags=["players"])


@router.get("/search")
def search_players(q: str = "") -> list[dict]:
    """Search the FIDE database for players matching *q*. Returns up to 15 candidates."""
    if not q or len(q.strip()) < 2:
        return []
    try:
        results = search_fide_players(q.strip())
        logger.info("FIDE search %r → %d results", q, len(results))
        return results
    except Exception as exc:
        logger.exception("FIDE search failed for %r", q)
        raise HTTPException(status_code=502, detail=f"FIDE search failed: {exc}")
