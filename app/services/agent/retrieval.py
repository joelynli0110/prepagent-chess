"""DB retrieval helpers for the LangGraph pipeline.

All functions take a SQLAlchemy Session and return plain dicts so the
graph nodes stay decoupled from ORM models.
"""
from __future__ import annotations

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.db.models import (
    EngineAnalysis,
    Game,
    MoveFact,
    OpeningStat,
    OpponentSpace,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _classify_tc(tc: str | None) -> str:
    """Map a PGN time-control string to a human category."""
    if not tc:
        return "unknown"
    try:
        base = int(tc.split("+")[0])
        if base < 180:
            return "bullet"
        if base < 600:
            return "blitz"
        if base < 1800:
            return "rapid"
        return "classical"
    except Exception:
        return "unknown"


def _result_for_side(result: str, side: str | None) -> str:
    if side == "white":
        if result == "1-0":
            return "win"
        if result == "0-1":
            return "loss"
    elif side == "black":
        if result == "0-1":
            return "win"
        if result == "1-0":
            return "loss"
    return "draw"


def _increment(stats: dict, outcome: str) -> None:
    """Increment wins/draws/losses counter safely."""
    key = outcome + "s"  # win→wins, draw→draws, loss→losses
    if key in stats:
        stats[key] += 1


# ---------------------------------------------------------------------------
# Orchestrator quick summary (unchanged)
# ---------------------------------------------------------------------------

def get_quick_summary(db: Session, space_id: str) -> dict:
    """Lightweight pull for the orchestrator node — profile + top openings."""
    opponent = db.get(OpponentSpace, space_id)
    game_count = db.scalar(
        select(func.count(Game.id)).where(Game.opponent_space_id == space_id)
    ) or 0

    top_openings = list(
        db.scalars(
            select(OpeningStat)
            .where(OpeningStat.opponent_space_id == space_id)
            .order_by(OpeningStat.games_count.desc())
            .limit(8)
        ).all()
    )

    profile = (opponent.profile_data or {}) if opponent else {}

    return {
        "name": opponent.display_name if opponent else "Unknown",
        "title": profile.get("title"),
        "rating_std": profile.get("rating_std"),
        "game_count": game_count,
        "top_openings": [
            {
                "eco": r.eco,
                "opening_name": r.opening_name,
                "color": r.color.value if r.color else None,
                "games_count": r.games_count,
                "wins": r.wins,
                "draws": r.draws,
                "losses": r.losses,
                "win_pct": (
                    round(r.wins / r.games_count * 100) if r.games_count else 0
                ),
                "blunder_rate": r.blunder_rate,
                "avg_cpl": r.avg_centipawn_loss,
            }
            for r in top_openings
        ],
    }


# ---------------------------------------------------------------------------
# Scouting Agent data
# ---------------------------------------------------------------------------

def get_scouting_data(db: Session, space_id: str) -> dict:
    """
    Game distribution by time control and opponent rating bracket.
    Identifies time-pressure collapses (blunders with low clock remaining).
    """
    games = list(
        db.scalars(select(Game).where(Game.opponent_space_id == space_id)).all()
    )

    # --- Time control breakdown ---
    tc_stats: dict[str, dict] = {}
    for g in games:
        cat = _classify_tc(g.time_control)
        if cat not in tc_stats:
            tc_stats[cat] = {"games": 0, "wins": 0, "draws": 0, "losses": 0}
        tc_stats[cat]["games"] += 1
        outcome = _result_for_side(g.result, g.opponent_side.value if g.opponent_side else None)
        _increment(tc_stats[cat], outcome)

    for cat, s in tc_stats.items():
        n = s["games"]
        s["win_pct"] = round(s["wins"] / n * 100) if n else 0

    # --- Rating bracket breakdown ---
    brackets = {
        "<1500": {"games": 0, "wins": 0, "losses": 0, "draws": 0},
        "1500-1800": {"games": 0, "wins": 0, "losses": 0, "draws": 0},
        "1800-2100": {"games": 0, "wins": 0, "losses": 0, "draws": 0},
        "2100+": {"games": 0, "wins": 0, "losses": 0, "draws": 0},
    }
    for g in games:
        side = g.opponent_side.value if g.opponent_side else None
        opp_rating = g.white_rating if side == "white" else g.black_rating
        if not opp_rating:
            continue
        if opp_rating < 1500:
            bk = "<1500"
        elif opp_rating < 1800:
            bk = "1500-1800"
        elif opp_rating < 2100:
            bk = "1800-2100"
        else:
            bk = "2100+"
        brackets[bk]["games"] += 1
        outcome = _result_for_side(g.result, side)
        _increment(brackets[bk], outcome)

    for bk, s in brackets.items():
        n = s["games"]
        s["win_pct"] = round(s["wins"] / n * 100) if n else 0

    # --- Time pressure collapses: worst blunders made with clock < 30 s ---
    TIME_THRESHOLD_MS = 30_000

    pressure_rows = db.execute(
        select(
            EngineAnalysis.centipawn_loss,
            EngineAnalysis.classification,
            MoveFact.phase,
            MoveFact.clock_after_ms,
            MoveFact.san,
            Game.eco,
            Game.id.label("game_id"),
        )
        .join(Game, Game.id == EngineAnalysis.game_id)
        .join(
            MoveFact,
            (MoveFact.game_id == EngineAnalysis.game_id)
            & (MoveFact.ply == EngineAnalysis.ply),
        )
        .where(Game.opponent_space_id == space_id)
        .where(EngineAnalysis.classification.in_(["blunder", "mistake"]))
        .where(MoveFact.side_to_move == Game.opponent_side)
        .where(MoveFact.clock_after_ms.isnot(None))
        .where(MoveFact.clock_after_ms < TIME_THRESHOLD_MS)
        .order_by(EngineAnalysis.centipawn_loss.desc())
        .limit(15)
    ).all()

    # Total blunder counts under pressure vs normal (for ratio)
    def _blunder_count(under_pressure: bool) -> int:
        q = (
            select(func.count(EngineAnalysis.id))
            .join(Game, Game.id == EngineAnalysis.game_id)
            .join(
                MoveFact,
                (MoveFact.game_id == EngineAnalysis.game_id)
                & (MoveFact.ply == EngineAnalysis.ply),
            )
            .where(Game.opponent_space_id == space_id)
            .where(EngineAnalysis.classification.in_(["blunder", "mistake"]))
            .where(MoveFact.side_to_move == Game.opponent_side)
            .where(MoveFact.clock_after_ms.isnot(None))
        )
        if under_pressure:
            q = q.where(MoveFact.clock_after_ms < TIME_THRESHOLD_MS)
        else:
            q = q.where(MoveFact.clock_after_ms >= TIME_THRESHOLD_MS)
        return db.scalar(q) or 0

    pressure_count = _blunder_count(True)
    normal_count = _blunder_count(False)

    # Total move counts for rate calculation
    def _move_count(under_pressure: bool) -> int:
        q = (
            select(func.count(MoveFact.id))
            .join(Game, Game.id == MoveFact.game_id)
            .where(Game.opponent_space_id == space_id)
            .where(MoveFact.side_to_move == Game.opponent_side)
            .where(MoveFact.clock_after_ms.isnot(None))
        )
        if under_pressure:
            q = q.where(MoveFact.clock_after_ms < TIME_THRESHOLD_MS)
        else:
            q = q.where(MoveFact.clock_after_ms >= TIME_THRESHOLD_MS)
        return db.scalar(q) or 1  # avoid div-by-zero

    pressure_moves = _move_count(True)
    normal_moves = _move_count(False)

    pressure_rate = round(pressure_count / pressure_moves * 100, 1) if pressure_moves else 0
    normal_rate = round(normal_count / normal_moves * 100, 1) if normal_moves else 0
    pressure_multiplier = round(pressure_rate / normal_rate, 1) if normal_rate else None

    return {
        "total_games": len(games),
        "time_control_breakdown": {k: v for k, v in tc_stats.items() if v["games"] > 0},
        "rating_bracket_breakdown": {k: v for k, v in brackets.items() if v["games"] > 0},
        "time_pressure_blunder_rate_pct": pressure_rate,
        "normal_blunder_rate_pct": normal_rate,
        "pressure_multiplier": pressure_multiplier,
        "time_pressure_sample": [
            {
                "game_id": str(r.game_id),
                "eco": r.eco,
                "phase": r.phase.value if r.phase else None,
                "move_san": r.san,
                "clock_remaining_s": round(r.clock_after_ms / 1000, 1) if r.clock_after_ms else None,
                "centipawn_loss": r.centipawn_loss,
                "classification": r.classification.value if r.classification else None,
            }
            for r in pressure_rows
        ],
    }


# ---------------------------------------------------------------------------
# Pattern Agent data
# ---------------------------------------------------------------------------

def get_pattern_data(db: Session, space_id: str) -> dict:
    """
    Structural and positional evidence: opening stats, book deviation,
    phase-wise error distribution, and critical positions with FEN.
    """
    # Full opening stats
    opening_rows = list(
        db.scalars(
            select(OpeningStat)
            .where(OpeningStat.opponent_space_id == space_id)
            .order_by(OpeningStat.games_count.desc())
            .limit(15)
        ).all()
    )
    opening_stats = [
        {
            "eco": r.eco,
            "opening_name": r.opening_name,
            "color": r.color.value if r.color else None,
            "games_count": r.games_count,
            "wins": r.wins,
            "draws": r.draws,
            "losses": r.losses,
            "win_pct": round(r.wins / r.games_count * 100) if r.games_count else 0,
            "blunder_rate": r.blunder_rate,
            "avg_cpl": r.avg_centipawn_loss,
            "last_seen": r.last_seen.isoformat() if r.last_seen else None,
        }
        for r in opening_rows
    ]

    # Phase error distribution
    phase_rows = db.execute(
        select(
            MoveFact.phase,
            func.count(EngineAnalysis.id).label("blunder_count"),
            func.avg(EngineAnalysis.centipawn_loss).label("avg_cpl"),
        )
        .join(Game, Game.id == EngineAnalysis.game_id)
        .join(
            MoveFact,
            (MoveFact.game_id == EngineAnalysis.game_id)
            & (MoveFact.ply == EngineAnalysis.ply),
        )
        .where(Game.opponent_space_id == space_id)
        .where(EngineAnalysis.classification.in_(["blunder", "mistake"]))
        .where(MoveFact.side_to_move == Game.opponent_side)
        .group_by(MoveFact.phase)
    ).all()

    phase_distribution = {
        r.phase.value if r.phase else "unknown": {
            "blunder_count": r.blunder_count,
            "avg_cpl": round(r.avg_cpl or 0),
        }
        for r in phase_rows
    }

    # Book deviation: average ply where opponent's first non-book move occurs
    # (proxy: first move where is_book=False per game, grouped by opening ECO)
    deviation_rows = db.execute(
        select(
            Game.eco,
            Game.opening_name,
            func.avg(MoveFact.ply).label("avg_deviation_ply"),
            func.count(func.distinct(Game.id)).label("games"),
        )
        .join(MoveFact, MoveFact.game_id == Game.id)
        .where(Game.opponent_space_id == space_id)
        .where(MoveFact.side_to_move == Game.opponent_side)
        .where(MoveFact.is_book.is_(False))
        .where(Game.eco.isnot(None))
        .group_by(Game.eco, Game.opening_name)
        .having(func.count(func.distinct(Game.id)) >= 3)
        .order_by(func.avg(MoveFact.ply).asc())
        .limit(10)
    ).all()

    book_deviations = [
        {
            "eco": r.eco,
            "opening_name": r.opening_name,
            "avg_deviation_ply": round(r.avg_deviation_ply or 0),
            "games": r.games,
        }
        for r in deviation_rows
    ]

    # Critical positions (highest CPL blunders with FEN)
    crit_rows = db.execute(
        select(
            EngineAnalysis.fen_before,
            EngineAnalysis.eval_before_cp,
            EngineAnalysis.eval_after_cp,
            EngineAnalysis.centipawn_loss,
            EngineAnalysis.best_move_san,
            EngineAnalysis.best_move_uci,
            MoveFact.san,
            MoveFact.phase,
            Game.eco,
            Game.opening_name,
            Game.id.label("game_id"),
            EngineAnalysis.ply,
        )
        .join(Game, Game.id == EngineAnalysis.game_id)
        .join(
            MoveFact,
            (MoveFact.game_id == EngineAnalysis.game_id)
            & (MoveFact.ply == EngineAnalysis.ply),
        )
        .where(Game.opponent_space_id == space_id)
        .where(EngineAnalysis.classification == "blunder")
        .where(MoveFact.side_to_move == Game.opponent_side)
        .order_by(EngineAnalysis.centipawn_loss.desc())
        .limit(6)
    ).all()

    critical_positions = [
        {
            "game_id": str(r.game_id),
            "ply": r.ply,
            "phase": r.phase.value if r.phase else None,
            "fen_before": r.fen_before,
            "move_san": r.san,
            "best_move_san": r.best_move_san,
            "best_move_uci": r.best_move_uci,
            "eval_before_cp": r.eval_before_cp,
            "eval_after_cp": r.eval_after_cp,
            "centipawn_loss": r.centipawn_loss,
            "eco": r.eco,
            "opening_name": r.opening_name,
        }
        for r in crit_rows
    ]

    return {
        "opening_stats": opening_stats,
        "phase_distribution": phase_distribution,
        "book_deviations": book_deviations,
        "critical_positions": critical_positions,
    }


# ---------------------------------------------------------------------------
# Psychology Agent data
# ---------------------------------------------------------------------------

def get_psychology_data(db: Session, space_id: str) -> dict:
    """
    Behavioral patterns: color preference, comfort vs discomfort openings,
    blunder timing, and performance under rating pressure.
    """
    # Color performance
    color_rows = db.execute(
        select(
            Game.opponent_side,
            func.count(Game.id).label("games"),
            func.sum(
                case(
                    (
                        (Game.opponent_side == "white") & (Game.result == "1-0"),
                        1,
                    ),
                    (
                        (Game.opponent_side == "black") & (Game.result == "0-1"),
                        1,
                    ),
                    else_=0,
                )
            ).label("wins"),
            func.sum(
                case((Game.result == "1/2-1/2", 1), else_=0)
            ).label("draws"),
        )
        .where(Game.opponent_space_id == space_id)
        .where(Game.opponent_side.isnot(None))
        .group_by(Game.opponent_side)
    ).all()

    color_stats: dict[str, dict] = {}
    for r in color_rows:
        side = r.opponent_side.value if hasattr(r.opponent_side, "value") else str(r.opponent_side)
        wins = r.wins or 0
        draws = r.draws or 0
        games = r.games or 0
        losses = games - wins - draws
        color_stats[side] = {
            "games": games,
            "wins": wins,
            "draws": draws,
            "losses": losses,
            "win_pct": round(wins / games * 100) if games else 0,
        }

    # Comfort openings: high win rate, low blunder rate, >= 5 games
    comfort_rows = list(
        db.scalars(
            select(OpeningStat)
            .where(OpeningStat.opponent_space_id == space_id)
            .where(OpeningStat.games_count >= 5)
            .order_by(
                (OpeningStat.wins * 1.0 / OpeningStat.games_count).desc()
            )
            .limit(5)
        ).all()
    )

    # Discomfort openings: low win rate, high blunder rate, >= 5 games
    discomfort_rows = list(
        db.scalars(
            select(OpeningStat)
            .where(OpeningStat.opponent_space_id == space_id)
            .where(OpeningStat.games_count >= 5)
            .order_by(
                OpeningStat.blunder_rate.desc(),
                (OpeningStat.wins * 1.0 / OpeningStat.games_count).asc(),
            )
            .limit(5)
        ).all()
    )

    def _stat(r: OpeningStat) -> dict:
        n = r.games_count
        return {
            "eco": r.eco,
            "opening_name": r.opening_name,
            "color": r.color.value if r.color else None,
            "games": n,
            "win_pct": round(r.wins / n * 100) if n else 0,
            "blunder_rate": round(r.blunder_rate * 100, 1),
            "avg_cpl": r.avg_centipawn_loss,
        }

    # Blunder distribution by fullmove number buckets
    move_bucket_rows = db.execute(
        select(
            case(
                (MoveFact.fullmove_number <= 10, "1-10"),
                (MoveFact.fullmove_number <= 20, "11-20"),
                (MoveFact.fullmove_number <= 30, "21-30"),
                else_="31+",
            ).label("bucket"),
            func.count(EngineAnalysis.id).label("blunders"),
            func.avg(EngineAnalysis.centipawn_loss).label("avg_cpl"),
        )
        .join(Game, Game.id == EngineAnalysis.game_id)
        .join(
            MoveFact,
            (MoveFact.game_id == EngineAnalysis.game_id)
            & (MoveFact.ply == EngineAnalysis.ply),
        )
        .where(Game.opponent_space_id == space_id)
        .where(EngineAnalysis.classification.in_(["blunder", "mistake"]))
        .where(MoveFact.side_to_move == Game.opponent_side)
        .group_by("bucket")
    ).all()

    blunder_by_move = {
        r.bucket: {"blunders": r.blunders, "avg_cpl": round(r.avg_cpl or 0)}
        for r in move_bucket_rows
    }

    # Round fatigue: blunder rate by round bucket (early / mid / late)
    # Only computed for games that have round data
    round_bucket_rows = db.execute(
        select(
            case(
                (Game.round <= 3, "early (1-3)"),
                (Game.round <= 6, "mid (4-6)"),
                else_="late (7+)",
            ).label("bucket"),
            func.count(EngineAnalysis.id).label("blunders"),
            func.count(func.distinct(Game.id)).label("games"),
            func.avg(EngineAnalysis.centipawn_loss).label("avg_cpl"),
        )
        .join(Game, Game.id == EngineAnalysis.game_id)
        .join(
            MoveFact,
            (MoveFact.game_id == EngineAnalysis.game_id)
            & (MoveFact.ply == EngineAnalysis.ply),
        )
        .where(Game.opponent_space_id == space_id)
        .where(EngineAnalysis.classification.in_(["blunder", "mistake"]))
        .where(MoveFact.side_to_move == Game.opponent_side)
        .where(Game.round.isnot(None))
        .group_by("bucket")
    ).all()

    blunder_by_round = {
        r.bucket: {
            "blunders": r.blunders,
            "games": r.games,
            "avg_cpl": round(r.avg_cpl or 0),
            "blunders_per_game": round(r.blunders / r.games, 2) if r.games else 0,
        }
        for r in round_bucket_rows
    }

    # Win rate by round bucket
    win_by_round_rows = db.execute(
        select(
            case(
                (Game.round <= 3, "early (1-3)"),
                (Game.round <= 6, "mid (4-6)"),
                else_="late (7+)",
            ).label("bucket"),
            func.count(Game.id).label("games"),
            func.sum(
                case(
                    ((Game.opponent_side == "white") & (Game.result == "1-0"), 1),
                    ((Game.opponent_side == "black") & (Game.result == "0-1"), 1),
                    else_=0,
                )
            ).label("wins"),
        )
        .where(Game.opponent_space_id == space_id)
        .where(Game.round.isnot(None))
        .group_by("bucket")
    ).all()

    win_by_round = {
        r.bucket: {
            "games": r.games,
            "win_pct": round((r.wins or 0) / r.games * 100) if r.games else 0,
        }
        for r in win_by_round_rows
    }

    return {
        "color_stats": color_stats,
        "comfort_openings": [_stat(r) for r in comfort_rows],
        "discomfort_openings": [_stat(r) for r in discomfort_rows],
        "blunder_by_move_number": blunder_by_move,
        "blunder_by_round": blunder_by_round,
        "win_by_round": win_by_round,
        "has_round_data": len(blunder_by_round) > 0,
    }
