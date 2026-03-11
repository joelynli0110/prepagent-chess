from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from app.db.models import Side


@dataclass
class IdentityMatchResult:
    matched_name: Optional[str]
    opponent_side: Optional[Side]
    confidence: float


class OpponentIdentityService:
    def normalize_name(self, value: str | None) -> str:
        if not value:
            return ""
        return "".join(ch.lower() for ch in value.strip() if ch.isalnum())

    def infer_side(
        self,
        canonical_name: str,
        white_name: str,
        black_name: str,
    ) -> IdentityMatchResult:
        canon = self.normalize_name(canonical_name)
        white = self.normalize_name(white_name)
        black = self.normalize_name(black_name)

        if canon and white == canon:
            return IdentityMatchResult(matched_name=white_name, opponent_side=Side.white, confidence=1.0)
        if canon and black == canon:
            return IdentityMatchResult(matched_name=black_name, opponent_side=Side.black, confidence=1.0)

        # Soft contains-match for early prototypes.
        if canon and canon in white:
            return IdentityMatchResult(matched_name=white_name, opponent_side=Side.white, confidence=0.8)
        if canon and canon in black:
            return IdentityMatchResult(matched_name=black_name, opponent_side=Side.black, confidence=0.8)

        return IdentityMatchResult(matched_name=None, opponent_side=None, confidence=0.0)