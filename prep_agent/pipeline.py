from __future__ import annotations

from typing import List, Optional, Tuple
from datetime import datetime

from .types import (
    PrepConfig, PrepReport, OpeningProfile, BlunderEvent,
    TargetPlan, TurningPoint, OpeningBranchStat, GameMeta
)
from .ingest import ingest_pgns
from .openings import build_opening_profile
from .blunders import extract_opponent_blunders
from .select import build_targets
from .report import render_markdown_report


def run_prep(
    pgn_texts: List[str],
    opponent_name: Optional[str],
    cfg: PrepConfig
) -> PrepReport:
    """
    Main pipeline: ingest PGNs, build opening profile, find blunders,
    build targets, and generate a report.
    """
    # Step 1: Ingest PGN files
    games, plies = ingest_pgns(pgn_texts, opponent_name, cfg)

    # Step 2: Build opening profile
    opening_profile = build_opening_profile(games, plies, cfg)

    # Step 3: Extract opponent blunders (engine analysis)
    blunders = extract_opponent_blunders(games, plies, cfg)

    # Step 4: Build target plans
    targets = build_targets(opening_profile, blunders, cfg)

    # Step 5: Render markdown report
    markdown = render_markdown_report(
        opponent_name=opponent_name,
        games=games,
        opening_profile=opening_profile,
        blunders=blunders,
        targets=targets,
        cfg=cfg
    )

    return PrepReport(
        created_at=datetime.now().isoformat(),
        games_ingested=len(games),
        opening_profile=opening_profile,
        blunders=blunders,
        targets=targets,
        markdown_report=markdown,
        opponent_name=opponent_name
    )