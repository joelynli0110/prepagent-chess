from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict


class ReportRequest(BaseModel):
    risk_mode: str = "balanced"  # "need_win" | "balanced" | "draw_ok"


class ResumeRequest(BaseModel):
    plan_adjustments: Optional[dict[str, Any]] = None  # None = approve as-is


class ChatRequest(BaseModel):
    message: str


class ReportRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    opponent_space_id: str
    title: str
    status: str  # draft | awaiting_review | running | ready | failed
    content: Optional[dict[str, Any]] = None
    created_at: datetime
