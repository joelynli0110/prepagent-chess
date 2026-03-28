from __future__ import annotations

import logging
from collections import defaultdict
from datetime import date
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import EngineAnalysis, Game, OpeningStat

logger = logging.getLogger(__name__)


class OpeningStatsService:
    # ------------------------------------------------------------------
    # Core aggregation (pure computation — no DB writes)
    # ------------------------------------------------------------------

    def _compute(self, db: Session, opponent_id: str) -> list[dict]:
        """Aggregate opening stats from the games and engine_analyses tables."""
        games = list(
            db.scalars(
                select(Game)
                .where(Game.opponent_space_id == opponent_id)
                .where(Game.opponent_side.is_not(None))
                .order_by(Game.date_played.desc().nullslast(), Game.created_at.desc())
            ).all()
        )

        buckets: dict[tuple, dict] = {}

        for game in games:
            key = (game.opening_name, game.eco, game.opponent_side)
            if key not in buckets:
                buckets[key] = {
                    "opening_name": game.opening_name,
                    "eco": game.eco,
                    "color": game.opponent_side,
                    "games_count": 0,
                    "wins": 0,
                    "draws": 0,
                    "losses": 0,
                    "last_seen": None,
                    "_game_ids": [],
                }

            bucket = buckets[key]
            bucket["games_count"] += 1
            bucket["_game_ids"].append(game.id)

            if game.date_played and (
                bucket["last_seen"] is None or game.date_played > bucket["last_seen"]
            ):
                bucket["last_seen"] = game.date_played

            if game.result == "1/2-1/2":
                bucket["draws"] += 1
            elif game.result == "1-0":
                if game.opponent_side.value == "white":
                    bucket["wins"] += 1
                else:
                    bucket["losses"] += 1
            elif game.result == "0-1":
                if game.opponent_side.value == "black":
                    bucket["wins"] += 1
                else:
                    bucket["losses"] += 1

        # Pull engine analysis for CPL and blunder rate
        game_ids = [g.id for g in games]
        cpl_map: dict[str, list[int]] = defaultdict(list)
        blunder_map: dict[str, int] = defaultdict(int)
        move_count_map: dict[str, int] = defaultdict(int)

        if game_ids:
            for analysis in db.scalars(
                select(EngineAnalysis).where(EngineAnalysis.game_id.in_(game_ids))
            ).all():
                if analysis.centipawn_loss is not None:
                    cpl_map[analysis.game_id].append(analysis.centipawn_loss)
                move_count_map[analysis.game_id] += 1
                if analysis.classification and analysis.classification.value == "blunder":
                    blunder_map[analysis.game_id] += 1

        results = []
        for bucket in buckets.values():
            avg_cpls: list[float] = []
            total_blunders = 0
            total_analyzed_moves = 0
            for gid in bucket["_game_ids"]:
                if cpl_map.get(gid):
                    avg_cpls.append(sum(cpl_map[gid]) / len(cpl_map[gid]))
                total_blunders += blunder_map.get(gid, 0)
                total_analyzed_moves += move_count_map.get(gid, 0)

            avg_cpl = sum(avg_cpls) / len(avg_cpls) if avg_cpls else None
            blunder_rate = (
                total_blunders / total_analyzed_moves if total_analyzed_moves else 0.0
            )

            results.append(
                {
                    "opening_name": bucket["opening_name"],
                    "eco": bucket["eco"],
                    "color": bucket["color"],
                    "games_count": bucket["games_count"],
                    "wins": bucket["wins"],
                    "draws": bucket["draws"],
                    "losses": bucket["losses"],
                    "last_seen": bucket["last_seen"],
                    "avg_centipawn_loss": (
                        round(avg_cpl, 2) if avg_cpl is not None else None
                    ),
                    "blunder_rate": round(blunder_rate, 4),
                }
            )

        results.sort(
            key=lambda x: (x["games_count"], x["last_seen"] or date.min),
            reverse=True,
        )
        return results

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------

    def refresh(self, db: Session, opponent_id: str) -> list[dict]:
        """Recompute opening stats and persist them to the opening_stats table.

        Wipes and replaces all rows for this opponent so the table always
        reflects the current state of the games and engine_analyses data.
        """
        results = self._compute(db, opponent_id)

        db.query(OpeningStat).filter(
            OpeningStat.opponent_space_id == opponent_id
        ).delete(synchronize_session=False)

        for r in results:
            db.add(
                OpeningStat(
                    opponent_space_id=opponent_id,
                    eco=r["eco"],
                    opening_name=r["opening_name"],
                    color=r["color"],
                    games_count=r["games_count"],
                    wins=r["wins"],
                    draws=r["draws"],
                    losses=r["losses"],
                    avg_centipawn_loss=r["avg_centipawn_loss"],
                    blunder_rate=r["blunder_rate"],
                    last_seen=r["last_seen"],
                )
            )

        db.commit()
        logger.info(
            "opening_stats refreshed for opponent %s — %d buckets", opponent_id, len(results)
        )
        return results

    # ------------------------------------------------------------------
    # Read path
    # ------------------------------------------------------------------

    def get(self, db: Session, opponent_id: str) -> list[dict]:
        """Return opening stats from the persisted table.

        If the table has no rows for this opponent (first call after import,
        or before any analysis has run) fall back to a live refresh so the
        caller always gets a result.
        """
        rows = list(
            db.scalars(
                select(OpeningStat)
                .where(OpeningStat.opponent_space_id == opponent_id)
                .order_by(
                    OpeningStat.games_count.desc(),
                    OpeningStat.last_seen.desc().nullslast(),
                )
            ).all()
        )

        if not rows:
            return self.refresh(db, opponent_id)

        return [
            {
                "opening_name": row.opening_name,
                "eco": row.eco,
                "color": row.color,
                "games_count": row.games_count,
                "wins": row.wins,
                "draws": row.draws,
                "losses": row.losses,
                "last_seen": row.last_seen,
                "avg_centipawn_loss": row.avg_centipawn_loss,
                "blunder_rate": row.blunder_rate,
            }
            for row in rows
        ]

    # Backwards-compatible shim — existing callers that use .compute() keep working
    def compute(self, db: Session, opponent_id: str) -> list[dict]:
        return self.get(db, opponent_id)
