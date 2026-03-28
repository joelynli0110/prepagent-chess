import { OpeningTree } from "@/app/opponents/[id]/reports/[reportId]/OpeningTree";

const MOCK_TREE = [
  {
    eco: "B12",
    opening_name: "Caro-Kann Defense",
    action: "steer_toward" as const,
    reason: "Opponent blunders frequently after move 15 in tactical complications.",
    key_moment: "Push e5 after Nf3 to reach sharp middlegame",
    stats: { games: 42, win_pct: 33, avg_cpl: 58, blunder_rate: 12.4 },
    children: [
      {
        eco: "B12",
        opening_name: "Advance Variation",
        action: "steer_toward" as const,
        reason: "Opponent mishandles the queenside counterplay — 28% win rate here.",
        key_moment: "After 3.e5 Bf5, play c4 immediately",
        stats: { games: 18, win_pct: 28, avg_cpl: 72, blunder_rate: 18.1 },
        children: [],
      },
      {
        eco: "B13",
        opening_name: "Exchange Variation",
        action: "avoid" as const,
        reason: "Opponent scores 67% in symmetrical endgames.",
        key_moment: null,
        stats: { games: 14, win_pct: 67, avg_cpl: 22, blunder_rate: 3.2 },
        children: [],
      },
    ],
  },
  {
    eco: "C50",
    opening_name: "Italian Game",
    action: "surprise_weapon" as const,
    reason: "Only 4 games in database — opponent has no preparation.",
    key_moment: "Reach the Giuoco Piano: bishop pair with open center",
    stats: { games: 4, win_pct: 50, avg_cpl: 44, blunder_rate: 8.0 },
    children: [],
  },
  {
    eco: "D35",
    opening_name: "Queen's Gambit Declined",
    action: "avoid" as const,
    reason: "Opponent's highest win rate opening — very comfortable here.",
    key_moment: null,
    stats: { games: 38, win_pct: 71, avg_cpl: 18, blunder_rate: 2.1 },
    children: [
      {
        eco: "D37",
        opening_name: "Classical Variation",
        action: "avoid" as const,
        reason: "Scores 75% — deeply prepared.",
        key_moment: null,
        stats: { games: 22, win_pct: 75, avg_cpl: 14, blunder_rate: 1.8 },
        children: [],
      },
    ],
  },
];

export default function TestTreePage() {
  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="text-2xl font-semibold mb-6">Opening Tree Test</h1>
      <OpeningTree tree={MOCK_TREE} />
    </main>
  );
}
