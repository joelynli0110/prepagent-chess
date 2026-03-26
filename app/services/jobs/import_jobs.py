from sqlalchemy.orm import Session

from app.db.models import Game, Job, JobStatus, MoveFact
from app.services.opponents.identity import OpponentIdentityService
from app.services.parsing.pgn_parser import parse_pgn_text



def process_pgn_import_job(db: Session, job: Job, opponent_space_id: str, pgn_text: str, source: str = "upload") -> None:
    job.status = JobStatus.running
    db.commit()

    parsed_games = parse_pgn_text(pgn_text)
    imported_ids: list[str] = []

    opponent = job.opponent_space
    identity_service = OpponentIdentityService()

    for parsed in parsed_games:
        identity = identity_service.infer_side(
            canonical_name=opponent.canonical_name,
            white_name=parsed["white_name"],
            black_name=parsed["black_name"],
        )

        game = Game(
            opponent_space_id=opponent_space_id,
            source=source,
            source_game_id=parsed["source_game_id"],
            white_name=parsed["white_name"],
            black_name=parsed["black_name"],
            result=parsed["result"],
            date_played=parsed["date_played"],
            time_control=parsed["time_control"],
            eco=parsed["eco"],
            opening_name=parsed["opening_name"],
            pgn_text=parsed["pgn_text"],
            total_plies=len(parsed["moves"]),
            opponent_name_in_game=identity.matched_name,
            opponent_side=identity.opponent_side,
        )
        db.add(game)
        db.flush()

        for idx, mv in enumerate(parsed["moves"], start=1):
            db.add(
                MoveFact(
                    game_id=game.id,
                    ply=idx,
                    fullmove_number=mv["fullmove_number"],
                    side_to_move=mv["side_to_move"],
                    san=mv["san"],
                    uci=mv["uci"],
                    fen_before=mv["fen_before"],
                    fen_after=mv["fen_after"],
                    phase=mv["phase"],
                    is_book=mv["is_book"],
                )
            )

        imported_ids.append(game.id)

    job.status = JobStatus.completed
    job.result = {"imported_games": len(imported_ids), "game_ids": imported_ids}
    db.commit()