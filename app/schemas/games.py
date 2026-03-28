from datetime import date
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict

from app.db.models import MoveClassification, Phase, Side


class GameRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    source: str
    source_game_id: Optional[str]
    white_name: str
    black_name: str
    white_rating: Optional[int]
    black_rating: Optional[int]
    rated: Optional[bool]
    result: str
    date_played: Optional[date]
    time_control: Optional[str]
    eco: Optional[str]
    opening_name: Optional[str]
    total_plies: int


class MoveFactRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    game_id: str
    ply: int
    fullmove_number: int
    side_to_move: Side
    san: str
    uci: str
    fen_before: str
    fen_after: str
    phase: Phase
    is_book: bool
    clock_before_ms: Optional[int]
    clock_after_ms: Optional[int]
    movetime_ms: Optional[int]


class EngineAnalysisRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    game_id: str
    ply: int
    fen_before: str
    move_uci: str
    eval_before_cp: Optional[int]
    eval_after_cp: Optional[int]
    best_move_uci: Optional[str]
    best_move_san: Optional[str]
    centipawn_loss: Optional[int]
    classification: Optional[MoveClassification]
    principal_variation: Optional[dict[str, Any]]
    depth: Optional[int]
    engine_name: Optional[str]
    engine_version: Optional[str]


class AnalyzeGameRequest(BaseModel):
    depth: int = 12
    max_plies: Optional[int] = None


class AnalyzeGameResponse(BaseModel):
    game_id: str
    analyzed_positions: int
    depth: int