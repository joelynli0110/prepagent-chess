from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Game, Job, JobStatus, MoveFact
from app.services.opponents.identity import OpponentIdentityService
from app.services.parsing.pgn_parser import parse_pgn_text


def process_pgn_import_job(db: Session, job: Job, opponent_space_id: str, pgn_text: str, source: str = "upload") -> None:
    job.status = JobStatus.running
    db.commit()

    parsed_games = parse_pgn_text(pgn_text)
    imported_ids: list[str] = []
    skipped = 0

    opponent = job.opponent_space
    identity_service = OpponentIdentityService()

    for parsed in parsed_games:
        # Skip games already in the database (same platform game ID)
        sgid = parsed.get("source_game_id")
        if sgid:
            exists = db.execute(
                select(Game.id).where(Game.source == source, Game.source_game_id == sgid).limit(1)
            ).scalar_one_or_none()
            if exists:
                skipped += 1
                continue

        identity = identity_service.infer_side(
            canonical_name=opponent.canonical_name,
            white_name=parsed["white_name"],
            black_name=parsed["black_name"],
        )

        game = Game(
            opponent_space_id=opponent_space_id,
            source=source,
            source_game_id=sgid,
            white_name=parsed["white_name"],
            black_name=parsed["black_name"],
            white_rating=parsed.get("white_rating"),
            black_rating=parsed.get("black_rating"),
            rated=parsed.get("rated"),
            result=parsed["result"],
            date_played=parsed["date_played"],
            time_control=parsed["time_control"],
            eco=parsed["eco"],
            opening_name=parsed["opening_name"],
            round=parsed.get("round"),
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
                    clock_before_ms=mv.get("clock_before_ms"),
                    clock_after_ms=mv.get("clock_after_ms"),
                    movetime_ms=mv.get("movetime_ms"),
                )
            )

        imported_ids.append(game.id)

    job.status = JobStatus.completed
    job.result = {
        "imported_games": len(imported_ids),
        "skipped_duplicates": skipped,
        "game_ids": imported_ids,
    }
    db.commit()
