from __future__ import annotations

from collections import defaultdict
from datetime import date
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import EngineAnalysis, Game


class OpeningStatsService:
    def compute(self, db: Session, opponent_id: str) -> list[dict]:
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

            if game.date_played and (bucket["last_seen"] is None or game.date_played > bucket["last_seen"]):
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

        game_ids = [g.id for g in games]
        analyses = []
        if game_ids:
            analyses = list(
                db.scalars(
                    select(EngineAnalysis)
                    .where(EngineAnalysis.game_id.in_(game_ids))
                ).all()
            )

        cpl_map: dict[str, list[int]] = defaultdict(list)
        blunder_map: dict[str, int] = defaultdict(int)
        move_count_map: dict[str, int] = defaultdict(int)

        for analysis in analyses:
            cpl = analysis.centipawn_loss
            if cpl is not None:
                cpl_map[analysis.game_id].append(cpl)
            move_count_map[analysis.game_id] += 1
            if analysis.classification and analysis.classification.value == "blunder":
                blunder_map[analysis.game_id] += 1

        results = []
        for bucket in buckets.values():
            avg_cpls: list[float] = []
            total_blunders = 0
            total_analyzed_moves = 0
            for game_id in bucket["_game_ids"]:
                if cpl_map.get(game_id):
                    avg_cpls.append(sum(cpl_map[game_id]) / len(cpl_map[game_id]))
                total_blunders += blunder_map.get(game_id, 0)
                total_analyzed_moves += move_count_map.get(game_id, 0)

            avg_centipawn_loss = sum(avg_cpls) / len(avg_cpls) if avg_cpls else None
            blunder_rate = (total_blunders / total_analyzed_moves) if total_analyzed_moves else 0.0

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
                    "avg_centipawn_loss": round(avg_centipawn_loss, 2) if avg_centipawn_loss is not None else None,
                    "blunder_rate": round(blunder_rate, 4),
                }
            )

        results.sort(key=lambda x: (x["games_count"], x["last_seen"] or date.min), reverse=True)
        return results