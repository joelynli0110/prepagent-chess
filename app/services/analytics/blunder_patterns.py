from __future__ import annotations

from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import EngineAnalysis, Game, MoveFact


class BlunderPatternsService:
    def compute(self, db: Session, opponent_id: str) -> list[dict]:
        games = list(
            db.scalars(
                select(Game)
                .where(Game.opponent_space_id == opponent_id)
            ).all()
        )
        if not games:
            return []

        game_ids = [g.id for g in games]
        game_by_id = {g.id: g for g in games}

        analyses = list(
            db.scalars(
                select(EngineAnalysis)
                .where(EngineAnalysis.game_id.in_(game_ids))
                .where(EngineAnalysis.classification == "blunder")
                .order_by(EngineAnalysis.game_id.asc(), EngineAnalysis.ply.asc())
            ).all()
        )
        if not analyses:
            return []

        move_rows = list(
            db.scalars(
                select(MoveFact)
                .where(MoveFact.game_id.in_(game_ids))
            ).all()
        )
        move_by_key = {(m.game_id, m.ply): m for m in move_rows}

        buckets: dict[tuple, dict] = defaultdict(lambda: {
            "opening_name": None,
            "phase": None,
            "side": None,
            "blunder_count": 0,
            "game_ids": set(),
            "sample_game_id": None,
            "sample_ply": None,
            "sample_move_uci": None,
            "cpls": [],
        })

        for analysis in analyses:
            game = game_by_id[analysis.game_id]
            move = move_by_key.get((analysis.game_id, analysis.ply))
            phase = move.phase if move else None
            side = move.side_to_move if move else None
            key = (game.opening_name, phase, side)

            bucket = buckets[key]
            bucket["opening_name"] = game.opening_name
            bucket["phase"] = phase
            bucket["side"] = side
            bucket["blunder_count"] += 1
            bucket["game_ids"].add(game.id)
            if bucket["sample_game_id"] is None:
                bucket["sample_game_id"] = game.id
                bucket["sample_ply"] = analysis.ply
                bucket["sample_move_uci"] = analysis.move_uci
            if analysis.centipawn_loss is not None:
                bucket["cpls"].append(analysis.centipawn_loss)

        results = []
        for bucket in buckets.values():
            avg_cpl = None
            if bucket["cpls"]:
                avg_cpl = sum(bucket["cpls"]) / len(bucket["cpls"])
            results.append(
                {
                    "opening_name": bucket["opening_name"],
                    "phase": bucket["phase"],
                    "side": bucket["side"],
                    "blunder_count": bucket["blunder_count"],
                    "game_count": len(bucket["game_ids"]),
                    "sample_game_id": bucket["sample_game_id"],
                    "sample_ply": bucket["sample_ply"],
                    "sample_move_uci": bucket["sample_move_uci"],
                    "avg_centipawn_loss": round(avg_cpl, 2) if avg_cpl is not None else None,
                }
            )

        results.sort(key=lambda x: (x["blunder_count"], x["game_count"]), reverse=True)
        return results