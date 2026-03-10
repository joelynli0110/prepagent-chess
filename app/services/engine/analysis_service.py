from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.db.models import EngineAnalysis, Game, MoveFact
from app.services.engine.classifier import classify_by_cpl
from app.services.engine.stockfish_client import StockfishClient


class AnalysisService:
    def __init__(self, stockfish_client: StockfishClient | None = None):
        self.stockfish_client = stockfish_client or StockfishClient()

    def analyze_game(self, db: Session, game_id: str, depth: int = 12, max_plies: int | None = None) -> int:
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

        db.execute(delete(EngineAnalysis).where(EngineAnalysis.game_id == game_id))
        db.commit()

        analyzed_count = 0

        for move in moves:
            before = self.stockfish_client.analyze_position(move.fen_before, depth=depth)
            after = self.stockfish_client.analyze_position(move.fen_after, depth=depth)

            eval_before_cp = before["score_cp"]
            eval_after_cp = after["score_cp"]
            best_move_uci = before["best_move_uci"]

            # Normalize CPL by side to move.
            if move.side_to_move.value == "white":
                cpl = max(0, (eval_before_cp or 0) - (eval_after_cp or 0))
            else:
                cpl = max(0, (eval_after_cp or 0) - (eval_before_cp or 0))

            analysis = EngineAnalysis(
                game_id=game_id,
                ply=move.ply,
                fen_before=move.fen_before,
                move_uci=move.uci,
                eval_before_cp=eval_before_cp,
                eval_after_cp=eval_after_cp,
                best_move_uci=best_move_uci,
                centipawn_loss=cpl,
                classification=classify_by_cpl(cpl),
                principal_variation={"pv": before["pv"]},
                depth=depth,
            )
            db.add(analysis)
            analyzed_count += 1

        db.commit()
        return analyzed_count