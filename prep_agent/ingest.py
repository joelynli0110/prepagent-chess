from __future__ import annotations

from typing import List, Tuple, Optional
import io
import hashlib

import chess
import chess.pgn

from .types import PrepConfig, GameMeta, PlyRecord, Side

def pos_key_from_board(board: chess.Board) -> str:
    # normalized FEN: remove move clocks to avoid false mismatches
    parts = board.fen().split(' ')
    return ' '.join(parts[:4]) # piece placement, turn, castling, ep

def ingest_pgns(
    pgn_texts: List[str],
    opponent_name: Optional[str],
    cfg: PrepConfig
) -> Tuple[List[GameMeta], List[PlyRecord]]:
    """
    Parse PGN texts and extract game metadata and move records.
    """

    games: List[GameMeta] = []
    plies: List[PlyRecord] = []

    for idx, pgn_text in enumerate(pgn_texts):
        pgn_io = io.StringIO(pgn_text)
        while True:
            game = chess.pgn.read_game(pgn_io)
            if game is None:
                break

            headers = game.headers
            game_id = headers.get("Site") or f"game_{idx}_{len(games)}"
            game_id = hashlib.md5(game_id.encode("utf-8")).hexdigest()[:12]

            meta = GameMeta(
                game_id=game_id,
                event=headers.get("Event"),
                site=headers.get("Site"),
                date=headers.get("Date"),
                white=headers.get("White"),
                black=headers.get("Black"),
                result=headers.get("Result"),
                time_control=headers.get("TimeControl"),
                white_elo=int(headers["WhiteElo"]) if "WhiteElo" in headers else None,
                black_elo=int(headers["BlackElo"]) if "BlackElo" in headers else None
            )

            # Determine opponent side if opponent_name is given
            if opponent_name:
                if meta.white and opponent_name.lower() in meta.white.lower():
                    meta.opponent_name = meta.white
                    meta.opponent_side = Side.WHITE
                elif meta.black and opponent_name.lower() in meta.black.lower():
                    meta.opponent_name = meta.black
                    meta.opponent_side = Side.BLACK

            games.append(meta)

            board = game.board()
            node = game

            opening_moves_san = []
            ply = 0

            while node.variations:
                node = node.variations[0]
                move = node.move
                fen_before = board.fen()
                side_who_moved = Side.WHITE if board.turn == chess.WHITE else Side.BLACK

                san = board.san(move) # Standard algebraic notation (e.g. Nf3   )
                uci = move.uci()  # UCI notation (e.g. g1f3)

                board.push(move)
                fen_after = board.fen()
                pos_key = pos_key_from_board(chess.Board(fen_before)) # key for fen_before
                ply += 1

                if ply <= cfg.opening_plies:
                    opening_moves_san.append(san)

                opening_key = " ".join(opening_moves_san)
                
                plies.append(PlyRecord(
                    game_id=game_id,
                    ply=ply,
                    side_who_moved=side_who_moved,
                    fen_before=fen_before,
                    fen_after=fen_after,
                    move_uci=uci,
                    move_san=san,
                    pos_key=pos_key,
                    opening_key=opening_key
                ))

                if cfg.max_lies_per_game and ply >= cfg.max_lies_per_game:
                    break

            if cfg.max_games and len(games) >= cfg.max_games:
                return games, plies

    return games, plies