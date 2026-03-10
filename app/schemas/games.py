from datetime import date
from typing import Optional

from pydantic import BaseModel, ConfigDict


class GameRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    source: str
    source_game_id: Optional[str]
    white_name: str
    black_name: str
    result: str
    date_played: Optional[date]
    time_control: Optional[str]
    eco: Optional[str]
    opening_name: Optional[str]
    total_plies: int