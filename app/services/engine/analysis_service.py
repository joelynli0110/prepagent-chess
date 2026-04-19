import logging
from typing import Optional

import chess
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import EngineAnalysis, Game, Job, MoveFact
from app.services.engine.classifier import classify_by_cpl
from app.services.engine.stockfish_client import StockfishClient

logger = logging.getLogger(__name__)


def _eval_loss_for_side(side: str, played_eval_cp: Optional[int], best_eval_cp: Optional[int]) -> int:
    """Return CPL from the moving side's perspective.

    Engine scores are stored from White's perspective, so we compare the
    position after the played move against the position after the engine's
    best move, then flip the sign for Black.
    """
    played = played_eval_cp or 0
    best = best_eval_cp or 0

    if side == "white":
        return max(0, best - played)
    return max(0, played - best)


class AnalysisService:
    def __init__(self, stockfish_client: StockfishClient | None = None):
        self.stockfish_client = stockfish_client or StockfishClient()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _seed_fen_cache(self, db: Session, depth: int) -> int:
        """Pre-populate the in-memory FEN cache from all previously stored
        engine analyses at *depth* or deeper.

        Each EngineAnalysis row stores the evaluation of fen_before, which is
        exactly what analyze_position(fen_before) would return.  By seeding the
        cache here we avoid re-running Stockfish on any position that has already
        been evaluated — across all games and opponents.
        """
        rows = db.execute(
            select(
                EngineAnalysis.fen_before,
                EngineAnalysis.eval_before_cp,
                EngineAnalysis.best_move_uci,
                EngineAnalysis.principal_variation,
                EngineAnalysis.depth,
            ).where(EngineAnalysis.depth >= depth)
        ).all()

        seeded = 0
        for row in rows:
            key = (row.fen_before, depth)
            if key not in self.stockfish_client._cache:
                pv = (row.principal_variation or {}).get("pv", [])
                self.stockfish_client._cache[key] = {
                    "score_cp": row.eval_before_cp,
                    "best_move_uci": row.best_move_uci,
                    "pv": pv,
                }
                seeded += 1

        logger.info("FEN cache seeded with %d positions (depth >= %d)", seeded, depth)
        return seeded

    # ------------------------------------------------------------------
    # Single-game analysis
    # ------------------------------------------------------------------

    def analyze_game(
        self,
        db: Session,
        game_id: str,
        depth: int = 12,
        max_plies: Optional[int] = None,
    ) -> int:
        """Analyze every move in *game_id* and (re-)write EngineAnalysis rows.

        Returns the number of positions analyzed.  Positions already in the
        in-memory cache (from previous games or a seeding step) are not sent
        to Stockfish again.
        """
        game = db.get(Game, game_id)
        if not game:
            raise ValueError(f"Game {game_id} not found")

        moves = list(
            db.scalars(
                select(MoveFact)
                .where(MoveFact.game_id == game_id)
                .order_by(MoveFact.ply.asc())
            ).all()
        )

        if max_plies is not None:
            moves = moves[:max_plies]

        # Drop stale analysis rows for this game before writing fresh ones
        db.execute(
            select(EngineAnalysis).where(EngineAnalysis.game_id == game_id)
        )
        db.query(EngineAnalysis).filter(EngineAnalysis.game_id == game_id).delete()
        db.flush()

        analyzed_count = 0

        for move in moves:
            before = self.stockfish_client.analyze_position(move.fen_before, depth=depth)
            after = self.stockfish_client.analyze_position(move.fen_after, depth=depth)

            eval_before_cp = before["score_cp"]
            eval_after_cp = after["score_cp"]
            best_move_uci = before["best_move_uci"]

            best_move_san: Optional[str] = None
            best_eval_after_cp = eval_after_cp
            if best_move_uci:
                try:
                    board = chess.Board(move.fen_before)
                    best_move_obj = chess.Move.from_uci(best_move_uci)
                    if best_move_obj in board.legal_moves:
                        best_move_san = board.san(best_move_obj)
                        if best_move_uci != move.uci:
                            board.push(best_move_obj)
                            best_after = self.stockfish_client.analyze_position(board.fen(), depth=depth)
                            best_eval_after_cp = best_after["score_cp"]
                except Exception:
                    pass

            cpl = _eval_loss_for_side(move.side_to_move.value, eval_after_cp, best_eval_after_cp)

            db.add(
                EngineAnalysis(
                    game_id=game_id,
                    ply=move.ply,
                    fen_before=move.fen_before,
                    move_uci=move.uci,
                    eval_before_cp=eval_before_cp,
                    eval_after_cp=eval_after_cp,
                    best_move_uci=best_move_uci,
                    best_move_san=best_move_san,
                    centipawn_loss=cpl,
                    classification=classify_by_cpl(cpl),
                    principal_variation={"pv": before["pv"]},
                    depth=depth,
                )
            )
            analyzed_count += 1

        db.commit()
        return analyzed_count

    # ------------------------------------------------------------------
    # Bulk opponent analysis
    # ------------------------------------------------------------------

    def analyze_opponent(
        self,
        db: Session,
        opponent_id: str,
        depth: int = 10,
        only_missing: bool = True,
        job: Optional[Job] = None,
    ) -> tuple[int, int]:
        """Analyze all games for *opponent_id*.

        Steps:
        1. Seed the FEN cache from every existing EngineAnalysis row so opening
           positions shared across games are never sent to Stockfish twice.
        2. Open one persistent Stockfish process for the entire run.
        3. Iterate over all games; skip games that already have analysis when
           *only_missing* is True.
        4. After each game, persist progress to *job* so the UI can reflect it.
        """
        games = list(
            db.scalars(
                select(Game)
                .where(Game.opponent_space_id == opponent_id)
                .order_by(Game.date_played.desc().nullslast(), Game.created_at.desc())
            ).all()
        )

        total = len(games)
        analyzed_games = 0
        analyzed_positions = 0

        self._seed_fen_cache(db, depth)

        with self.stockfish_client:
            for game in games:
                if only_missing:
                    existing = db.scalar(
                        select(EngineAnalysis.id)
                        .where(EngineAnalysis.game_id == game.id)
                        .limit(1)
                    )
                    if existing is not None:
                        continue

                count = self.analyze_game(db=db, game_id=game.id, depth=depth)
                analyzed_games += 1
                analyzed_positions += count

                # Update job progress after each game so the UI stays current
                if job is not None:
                    job.result = {
                        "analyzed_games": analyzed_games,
                        "total_games": total,
                        "analyzed_positions": analyzed_positions,
                    }
                    db.commit()

                logger.info(
                    "Analyzed game %s (%d/%d) — %d positions",
                    game.id, analyzed_games, total, count,
                )

        return analyzed_games, analyzed_positions
