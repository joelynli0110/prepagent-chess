import io
from datetime import date, datetime
from typing import Any, Optional

import chess
import chess.pgn

from app.db.models import Phase, Side



def infer_phase(board: chess.Board, ply: int) -> Phase:
    queens = len(board.pieces(chess.QUEEN, chess.WHITE)) + len(board.pieces(chess.QUEEN, chess.BLACK))
    minor_and_rooks = sum(
        len(board.pieces(piece, chess.WHITE)) + len(board.pieces(piece, chess.BLACK))
        for piece in [chess.ROOK, chess.BISHOP, chess.KNIGHT]
    )
    if ply <= 20:
        return Phase.OPENING
    if queens == 0 and minor_and_rooks <= 4:
        return Phase.ENDGAME
    return Phase.MIDDLEGAME



def safe_int(value: Optional[str]) -> Optional[int]:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None



def parse_game_date(date_str: Optional[str]) -> Optional[date]:
    if not date_str or "?" in date_str:
        return None
    try:
        return datetime.strptime(date_str, "%Y.%m.%d").date()
    except ValueError:
        return None



def parse_single_game(game: chess.pgn.Game, raw_pgn_text: str) -> dict[str, Any]:
    headers = game.headers
    board = game.board()
    moves: list[dict[str, Any]] = []

    ply = 0
    node = game
    while node.variations:
        next_node = node.variation(0)
        move = next_node.move
        fen_before = board.fen()
        san = board.san(move)
        side_to_move = Side.WHITE if board.turn == chess.WHITE else Side.BLACK
        board.push(move)
        ply += 1
        fen_after = board.fen()

        moves.append(
            {
                "fullmove_number": board.fullmove_number if side_to_move == Side.BLACK else board.fullmove_number - 1,
                "side_to_move": side_to_move,
                "san": san,
                "uci": move.uci(),
                "fen_before": fen_before,
                "fen_after": fen_after,
                "phase": infer_phase(board, ply),
                "is_book": ply <= 16,
            }
        )
        node = next_node

    return {
        "source": "upload",
        "source_game_id": None,
        "white_name": headers.get("White", "Unknown White"),
        "black_name": headers.get("Black", "Unknown Black"),
        "result": headers.get("Result", "*"),
        "date_played": parse_game_date(headers.get("Date")),
        "time_control": headers.get("TimeControl") if headers.get("TimeControl") not in {None, "?"} else None,
        "eco": headers.get("ECO") if headers.get("ECO") not in {None, "?"} else None,
        "opening_name": headers.get("Opening") if headers.get("Opening") not in {None, "?"} else None,
        "pgn_text": raw_pgn_text,
        "moves": moves,
    }



def parse_pgn_text(pgn_text: str) -> list[dict[str, Any]]:
    games: list[dict[str, Any]] = []
    stream = io.StringIO(pgn_text)

    while True:
        start_pos = stream.tell()
        game = chess.pgn.read_game(stream)
        if game is None:
            break
        end_pos = stream.tell()
        raw_game_text = pgn_text[start_pos:end_pos].strip()
        games.append(parse_single_game(game, raw_game_text))

    return games