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

    def _name_tokens(self, value: str | None) -> set[str]:
        """Split a name into lowercase word tokens, ignoring commas.
        Tokens shorter than 3 chars are excluded to avoid spurious matches."""
        if not value:
            return set()
        return {t.lower() for t in value.replace(",", " ").split() if len(t) >= 3}

    def infer_side(
        self,
        canonical_name: str,
        white_name: str,
        black_name: str,
    ) -> IdentityMatchResult:
        canon = self.normalize_name(canonical_name)
        white = self.normalize_name(white_name)
        black = self.normalize_name(black_name)

        # Exact normalized match
        if canon and white == canon:
            return IdentityMatchResult(matched_name=white_name, opponent_side=Side.white, confidence=1.0)
        if canon and black == canon:
            return IdentityMatchResult(matched_name=black_name, opponent_side=Side.black, confidence=1.0)

        # Substring match (handles "carlsen" in "carlsenmagnus")
        if canon and canon in white:
            return IdentityMatchResult(matched_name=white_name, opponent_side=Side.white, confidence=0.8)
        if canon and canon in black:
            return IdentityMatchResult(matched_name=black_name, opponent_side=Side.black, confidence=0.8)

        # Token overlap: handles "Magnus Carlsen" vs "Carlsen, Magnus" name-order differences.
        # Any significant token (≥3 chars) from the canonical name matching a token in the
        # player name is treated as a match.
        canon_tokens = self._name_tokens(canonical_name)
        white_tokens = self._name_tokens(white_name)
        black_tokens = self._name_tokens(black_name)

        if canon_tokens and canon_tokens & white_tokens:
            return IdentityMatchResult(matched_name=white_name, opponent_side=Side.white, confidence=0.6)
        if canon_tokens and canon_tokens & black_tokens:
            return IdentityMatchResult(matched_name=black_name, opponent_side=Side.black, confidence=0.6)

        # Reverse substring: check if any token from the player name appears inside
        # the canonical string. Handles canonical stored without spaces ("magnuscarlsen")
        # vs PGN name in "Carlsen, Magnus" format whose tokens are {"carlsen", "magnus"}.
        if canon and any(t in canon for t in white_tokens):
            return IdentityMatchResult(matched_name=white_name, opponent_side=Side.white, confidence=0.5)
        if canon and any(t in canon for t in black_tokens):
            return IdentityMatchResult(matched_name=black_name, opponent_side=Side.black, confidence=0.5)

        return IdentityMatchResult(matched_name=None, opponent_side=None, confidence=0.0)