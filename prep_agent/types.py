from __future__ import annotations

from dataclasses import dataclass, field, asdict
from enum import Enum
from datetime import datetime
from typing import Any, Dict, List, Optional, Union

from attrs import has


class Side(str, Enum):
    WHITE = 'white'
    BLACK = 'black'

class Severity(str, Enum):
    INACCURACY = 'inaccuracy'
    MISTAKE = 'mistake'
    BLUNDER = 'blunder'

@dataclass
class PrepConfig:
    # Engine
    stockfish_path: str = 'Stockfish'
    engine_movetime_ms: int = 150
    engine_threads: int = 2
    engine_hash_mb: int = 128
    
    # Analysis scope
    max_games: Optional[int] = None
    max_lies_per_game: Optional[int] = None
    opening_plies: int = 8 # build opening tree for first N slies

    # Blunder thresholds (centipawns equiv)
    mistake_drop_cp: int = 80 # Centipawn drop to qualify as mistake
    blunder_drop_cp: int = 200 

    # Turning points
    turning_point_per_side: int = 10 # Maximum turning points to track per side
    dedupe_by_pos_key: bool = True # Whether to dedulication positions by their unique key

    # Filters (optional later)
    only_time_controls: Optional[List[str]] = None # e.g. ['rapid', 'classical']
    since_date: Optional[str] = None # e.g. 'YYYY-MM-DD'


@dataclass
class GameMeta:
    game_id: str
    event: Optional[str] = None
    site: Optional[str] = None
    date: Optional[str] = None
    white: Optional[str] = None
    black: Optional[str] = None
    result: Optional[str] = None
    time_control: Optional[str] = None
    white_elo: Optional[int] = None
    black_elo: Optional[int] = None

    # Determined relative to the opponent you are scouting (filled by ingest)
    opponent_name: Optional[str] = None
    opponent_side: Optional[Side] = None

@dataclass
class PlyRecord:
    """
    A single half-move (ply) in a game
    """
    game_id: str
    ply: int
    side_who_moved: Side
    fen_before: str
    fen_after: str
    move_uci: str
    move_san: str
    pos_key: str
    opening_key: str # e.g. ECO code or similar

@dataclass
class OpeningBranchStat:
    """
    Simple: represent a branch by its move sequence (SAN) for first N plies.
    """
    side: Side # opponent as white as black
    moves_san: List[str] # e.g. ['e4', 'e5', 'Nf3', ...]
    games: int
    score: float # e.g. opponent points per game in this branch (0...1)
    

@dataclass
class OpeningProfile:
    opening_plies: int  # Depth of opening analysis in half-moves (must come first - no default)
    opponent_name: Optional[str] = None
    as_white_top: List[OpeningBranchStat] = field(default_factory=list)
    as_black_vs_e4_top: List[OpeningBranchStat] = field(default_factory=list)
    as_black_vs_d4_top: List[OpeningBranchStat] = field(default_factory=list)


@dataclass
class BlunderEvent:
    game_id: str
    ply: int
    opponent_side: Side
    fen_before: str
    pos_key: str
    opening_key: str
    playing_move_uci: str
    playing_move_san: str

    # Engine-backed
    drop_cp_equiv: int
    severity: Severity

    # Optional evidence for "punish it"
    refutation_pv_uci: List[str] = field(default_factory=list)
    refutation_first_uci: Optional[str] = None


@dataclass
class TurningPoint:
    """
    A curated item used for training the prep.
    """
    title: str
    fen: str
    pos_key: str
    opening_key: str
    opoonent_mistake_move_san: str
    opoonent_mistake_move_uci: str
    severity: Severity
    drop_cp_equiv: int
    punish_move_uci: Optional[str] = None # may hide later
    refutation_line_uci: List[str] = field(default_factory=list)
    note: str = '' # template/LLM text later


@dataclass
class TargetPlan:
    """
    Minimal v1 plan: "expect these openings here are key turning points."
    """
    opponent_side: Side
    headline: str
    likely_openings: List[OpeningBranchStat]
    turning_points: List[TurningPoint]


@dataclass
class PrepReport:
    created_at: str
    games_ingested: int
    opening_profile: OpeningProfile
    blunders: List[BlunderEvent]
    targets: List[TargetPlan]
    markdown_report: str  # A printable summary artifact

    opponent_name: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)