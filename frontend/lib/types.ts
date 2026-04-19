export type Side = "white" | "black";
export type Phase = "opening" | "middlegame" | "endgame";

export interface PlayerProfile {
  photo_url?: string | null;
  name?: string | null;
  nationality?: string | null;
  federation?: string | null;
  federation_iso2?: string | null;
  birth_year?: number | null;
  age?: number | null;
  gender?: string | null;
  title?: string | null;
  rating_std?: number | null;
  rating_rapid?: number | null;
  rating_blitz?: number | null;
  fide_id?: number | null;
  chessbase_id?: number | null;
  chessbase_url?: string | null;
  fide_url?: string | null;
}

export interface OpponentSpace {
  id: string;
  display_name: string;
  canonical_name: string;
  notes?: string | null;
  profile_data?: PlayerProfile | null;
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
  event?: string | null;
  opponent_side?: Side | null;
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
  eco?: string | null;
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

export interface StrategyPlan {
  focus_areas?: string[];
  target_openings?: string[];
  avoid_openings?: string[];
  phase_weakness?: string;
  risk_notes?: string;
  prep_priority?: string;
  raw?: string;
}

export interface ScoutingReport {
  preferred_time_control?: string;
  time_pressure_sensitivity?: "high" | "medium" | "low";
  time_pressure_insight?: string;
  strongest_bracket?: string;
  weakest_bracket?: string;
  rating_insight?: string;
  key_findings?: string[];
  raw?: string;
}

export interface PatternReport {
  structural_tendencies?: string[];
  book_deviation_habit?: string;
  dominant_phase_weakness?: string;
  recurring_error_patterns?: string[];
  exploit_positions?: string[];
  opening_depth_assessment?: string;
  raw?: string;
}

export interface PsychologyReport {
  color_preference?: string;
  color_insight?: string;
  psychological_profile?: string;
  comfort_zone_openings?: string[];
  discomfort_zone_openings?: string[];
  critical_move_range?: string;
  fatigue_pattern?: string | null;
  fatigue_insight?: string | null;
  exploit_strategy?: string;
  raw?: string;
}

export interface OpeningTreeStats {
  games: number;
  win_pct: number;
  avg_cpl?: number | null;
  blunder_rate?: number;
}

export interface OpeningTreeEntry {
  eco?: string;
  opening_name?: string;
  action?: "steer_toward" | "avoid" | "surprise_weapon";
  reason?: string;
  key_moment?: string | null;
  stats?: OpeningTreeStats;
  children?: OpeningTreeEntry[];
}

export type ReportStatus = "draft" | "awaiting_review" | "running" | "ready" | "failed";

export interface ReportContent {
  thread_id?: string;
  risk_mode?: string;
  plan?: StrategyPlan;
  // Per-agent progress (written after each node completes)
  current_agent?: string | null;
  current_agent_label?: string | null;
  scouting_done?: boolean;
  pattern_done?: boolean;
  psychology_done?: boolean;
  synthesis_done?: boolean;
  // Agent outputs
  scouting_report?: ScoutingReport;
  pattern_report?: PatternReport;
  psychology_report?: PsychologyReport;
  opening_tree?: OpeningTreeEntry[];
  opening_stats?: object[];
  critical_positions?: object[];
  narrative?: string;
  markdown?: string;
  error?: string;
}

export interface Report {
  id: string;
  opponent_space_id: string;
  title: string;
  status: ReportStatus;
  content?: ReportContent | null;
  created_at: string;
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
  best_move_san?: string | null;
  centipawn_loss?: number | null;
  classification?: string | null;
  principal_variation?: { pv?: string[] } | null;
  depth?: number | null;
}
