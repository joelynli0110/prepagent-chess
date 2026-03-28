from datetime import date
from typing import Optional

from pydantic import BaseModel

from app.db.models import Phase, Side


class OpeningStatRead(BaseModel):
    opening_name: Optional[str]
    eco: Optional[str]
    color: Side
    games_count: int
    wins: int
    draws: int
    losses: int
    last_seen: Optional[date]
    avg_centipawn_loss: Optional[float]
    blunder_rate: float


class BlunderSummaryRead(BaseModel):
    opening_name: Optional[str]
    eco: Optional[str]
    phase: Optional[Phase]
    side: Optional[Side]
    blunder_count: int
    game_count: int
    sample_game_id: Optional[str]
    sample_ply: Optional[int]
    sample_move_uci: Optional[str]
    avg_centipawn_loss: Optional[float]


class OpponentAnalyzeRequest(BaseModel):
    depth: int = 10
    only_missing: bool = True


class OpponentAnalyzeResponse(BaseModel):
    opponent_id: str
    requested_games: int
    analyzed_games: int
    analyzed_positions: int
    depth: int