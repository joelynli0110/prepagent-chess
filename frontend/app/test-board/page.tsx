import { CriticalPositions } from "@/app/opponents/[id]/reports/[reportId]/CriticalPositions";

const MOCK_POSITIONS = [
  {
    game_id: "test-game-1",
    ply: 34,
    phase: "middlegame",
    fen_before: "r1bq1rk1/pp2bppp/2n1pn2/3p4/3P1B2/2NB1N2/PPP2PPP/R2QR1K1 b - - 4 10",
    move_san: "Nxd4",
    best_move_san: "e5",
    best_move_uci: "e6e5",
    eval_before_cp: 15,
    eval_after_cp: -180,
    centipawn_loss: 195,
    eco: "D35",
    opening_name: "Queen's Gambit Declined",
    date_played: "2024-11-15",
  },
  {
    game_id: "test-game-2",
    ply: 51,
    phase: "endgame",
    fen_before: "8/5pk1/6p1/7p/7P/6P1/5PK1/8 w - - 0 42",
    move_san: "f4",
    best_move_san: "Kf3",
    best_move_uci: "g2f3",
    eval_before_cp: 120,
    eval_after_cp: -40,
    centipawn_loss: 160,
    eco: "C50",
    opening_name: "Italian Game",
    date_played: "2024-10-03",
  },
  {
    game_id: "test-game-3",
    ply: 22,
    phase: "opening",
    fen_before: "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 4 6",
    move_san: "Bxf7+",
    best_move_san: "O-O",
    best_move_uci: "e1g1",
    eval_before_cp: 30,
    eval_after_cp: -320,
    centipawn_loss: 350,
    eco: "C54",
    opening_name: "Italian Game: Giuoco Piano",
    date_played: "2024-09-20",
  },
];

export default function TestBoardPage() {
  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-semibold mb-6">Board Component Test</h1>
      <CriticalPositions positions={MOCK_POSITIONS} opponentId="test-opponent" />
    </main>
  );
}
