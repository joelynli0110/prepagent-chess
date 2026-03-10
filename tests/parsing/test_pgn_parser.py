from app.services.parsing.pgn_parser import parse_pgn_text


SAMPLE_PGN = """
[Event "Test"]
[Site "?"]
[Date "2025.01.01"]
[Round "1"]
[White "Alice"]
[Black "Bob"]
[Result "1-0"]
[Opening "Italian Game"]
[ECO "C50"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d4 exd4 6. cxd4 Bb4+ 7. Nc3 Nxe4 8. O-O 1-0
"""


def test_parse_pgn_text_extracts_one_game():
    games = parse_pgn_text(SAMPLE_PGN)
    assert len(games) == 1
    game = games[0]
    assert game["white_name"] == "Alice"
    assert game["black_name"] == "Bob"
    assert game["opening_name"] == "Italian Game"
    assert len(game["moves"]) > 0