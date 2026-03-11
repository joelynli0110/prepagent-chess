export type Side = "white" | "black";
export type Phase = "opening" | "middlegame" | "endgame";

export interface OpponentSpace {
  id: string;
  display_name: string;
  canonical_name: string;
  notes?: string | null;
  created_at: string;
}

export interface Game {
  id: string;
  source: string;
  source_game_id?: string | null;
  white_name: string;
  black_name: string;
  result: string;
  date_played?: string | null;
  time_control?: string | null;
  eco?: string | null;
  opening_name?: string | null;
  total_plies: number;
}

export interface OpeningStat {
  opening_name?: string | null;
  eco?: string | null;
  color: Side;
  games_count: number;
  wins: number;
  draws: number;
  losses: number;
  last_seen?: string | null;
  avg_centipawn_loss?: number | null;
  blunder_rate: number;
}

export interface BlunderSummary {
  opening_name?: string | null;
  phase?: Phase | null;
  side?: Side | null;
  blunder_count: number;
  game_count: number;
  sample_game_id?: string | null;
  sample_ply?: number | null;
  sample_move_uci?: string | null;
  avg_centipawn_loss?: number | null;
}

export interface MoveFact {
  id: string;
  game_id: string;
  ply: number;
  fullmove_number: number;
  side_to_move: Side;
  san: string;
  uci: string;
  fen_before: string;
  fen_after: string;
  phase: Phase;
  is_book: boolean;
}

export interface EngineAnalysis {
  id: string;
  game_id: string;
  ply: number;
  fen_before: string;
  move_uci: string;
  eval_before_cp?: number | null;
  eval_after_cp?: number | null;
  best_move_uci?: string | null;
  centipawn_loss?: number | null;
  classification?: string | null;
  principal_variation?: { pv?: string[] } | null;
  depth?: number | null;
}