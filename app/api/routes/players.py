from fastapi import APIRouter

from app.services.imports.platform_search import search_fide_players

router = APIRouter(prefix="/players", tags=["players"])


@router.get("/search")
def search_players(q: str = "") -> list[dict]:
    """Search the FIDE database for players matching *q*. Returns up to 15 candidates."""
    return search_fide_players(q)
