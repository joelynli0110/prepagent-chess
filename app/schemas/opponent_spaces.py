from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class OpponentSpaceCreate(BaseModel):
    display_name: str
    canonical_name: str
    notes: Optional[str] = None


class OpponentSpaceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    display_name: str
    canonical_name: str
    notes: Optional[str]
    created_at: datetime