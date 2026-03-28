import io
import re
from datetime import date, datetime
from typing import Any, Optional

import chess
import chess.pgn

from app.db.models import Phase, Side
from app.services.parsing.opening_utils import detect_opening_from_moves

_CLK_RE = re.compile(r'\[%clk\s+(\d+):(\d+):(\d+(?:\.\d+)?)\]')



def infer_phase(board: chess.Board, ply: int) -> Phase:
    queens = len(board.pieces(chess.QUEEN, chess.WHITE)) + len(board.pieces(chess.QUEEN, chess.BLACK))
    minor_and_rooks = sum(
        len(board.pieces(piece, chess.WHITE)) + len(board.pieces(piece, chess.BLACK))
        for piece in [chess.ROOK, chess.BISHOP, chess.KNIGHT]
    )
    if ply <= 20:
        return Phase.opening
    if queens == 0 and minor_and_rooks <= 4:
        return Phase.endgame
    return Phase.middlegame



def safe_int(value: Optional[str]) -> Optional[int]:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _parse_clock_ms(comment: str) -> Optional[int]:
    """Extract remaining clock in milliseconds from a '%clk' PGN comment."""
    m = _CLK_RE.search(comment)
    if not m:
        return None
    h, mn, s = int(m.group(1)), int(m.group(2)), float(m.group(3))
    return int((h * 3600 + mn * 60 + s) * 1000)


def _extract_source_game_id(headers: chess.pgn.Headers) -> Optional[str]:
    """Derive a platform game ID from the PGN Site header."""
    site = headers.get("Site", "")
    if not site:
        return None
    # Strip query string / fragment, split on '/', drop empty segments
    path = site.split("?")[0].split("#")[0].rstrip("/")
    parts = [p for p in path.split("/") if p]
    if not parts:
        return None
    last = parts[-1]
    # Lichess appends '/white' or '/black' to the game URL — skip those
    if last.lower() in {"white", "black"} and len(parts) >= 2:
        return parts[-2]
    return last



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
    san_moves: list[str] = []

    # Track remaining clock per side to compute movetime
    side_clock_ms: dict[Side, Optional[int]] = {Side.white: None, Side.black: None}

    ply = 0
    node = game
    while node.variations:
        next_node = node.variation(0)
        move = next_node.move
        fen_before = board.fen()
        san = board.san(move)
        side_to_move = Side.white if board.turn == chess.WHITE else Side.black
        board.push(move)
        ply += 1
        fen_after = board.fen()

        clock_before = side_clock_ms[side_to_move]
        clock_after = _parse_clock_ms(next_node.comment or "")
        movetime: Optional[int] = None
        if clock_before is not None and clock_after is not None:
            diff = clock_before - clock_after
            if diff >= 0:
                movetime = diff
        side_clock_ms[side_to_move] = clock_after

        moves.append(
            {
                "fullmove_number": board.fullmove_number if side_to_move == Side.black else board.fullmove_number - 1,
                "side_to_move": side_to_move,
                "san": san,
                "uci": move.uci(),
                "fen_before": fen_before,
                "fen_after": fen_after,
                "phase": infer_phase(board, ply),
                "is_book": ply <= 16,
                "clock_before_ms": clock_before,
                "clock_after_ms": clock_after,
                "movetime_ms": movetime,
            }
        )
        san_moves.append(san)
        node = next_node

    eco = headers.get("ECO") if headers.get("ECO") not in {None, "?"} else None
    opening_name = headers.get("Opening") if headers.get("Opening") not in {None, "?"} else None

    # Always run the position-based book lookup — it gives exact variation names
    # (e.g. "Sicilian Defense: Najdorf Variation") which are more specific than
    # generic PGN Opening headers.
    book_eco, book_name = detect_opening_from_moves(san_moves)
    if book_eco:
        eco = book_eco
    if book_name:
        opening_name = book_name

    # Determine if the game was rated from the Event header
    # Lichess:  "Rated Blitz game", "Casual Bullet game"
    # Chess.com: events don't mark rated/casual; presence of ELO implies rated
    event = headers.get("Event", "")
    if "Rated" in event:
        rated: Optional[bool] = True
    elif "Casual" in event:
        rated = False
    else:
        white_elo = safe_int(headers.get("WhiteElo"))
        black_elo = safe_int(headers.get("BlackElo"))
        rated = True if (white_elo or black_elo) else None

    # Round: handle "5", "5.1", "-", "?" — extract leading integer only
    round_raw = headers.get("Round", "")
    round_num: Optional[int] = None
    if round_raw and round_raw not in {"?", "-", ""}:
        try:
            round_num = int(round_raw.split(".")[0])
        except (ValueError, AttributeError):
            pass

    return {
        "source": "upload",
        "source_game_id": _extract_source_game_id(headers),
        "white_name": headers.get("White", "Unknown White"),
        "black_name": headers.get("Black", "Unknown Black"),
        "white_rating": safe_int(headers.get("WhiteElo")),
        "black_rating": safe_int(headers.get("BlackElo")),
        "rated": rated,
        "result": headers.get("Result", "*"),
        "date_played": parse_game_date(headers.get("Date")),
        "time_control": headers.get("TimeControl") if headers.get("TimeControl") not in {None, "?"} else None,
        "eco": eco,
        "opening_name": opening_name,
        "round": round_num,
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