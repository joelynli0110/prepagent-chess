from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Any, Optional
from uuid import uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    Enum as SAEnum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Platform(str, Enum):
    lichess = "lichess"
    chesscom = "chesscom"
    upload = "upload"


class JobType(str, Enum):
    import_pgn = "import_pgn"
    analyze_games = "analyze_games"
    generate_report = "generate_report"


class JobStatus(str, Enum):
    queued = "queued"
    running = "running"
    completed = "completed"
    failed = "failed"


class Side(str, Enum):
    white = "white"
    black = "black"


class Phase(str, Enum):
    opening = "opening"
    middlegame = "middlegame"
    endgame = "endgame"


class MoveClassification(str, Enum):
    best = "best"
    good = "good"
    inaccuracy = "inaccuracy"
    mistake = "mistake"
    blunder = "blunder"


class OpponentSpace(Base):
    __tablename__ = "opponent_spaces"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    display_name: Mapped[str] = mapped_column(String(255), index=True)
    canonical_name: Mapped[str] = mapped_column(String(255), index=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    profile_data: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    games: Mapped[list["Game"]] = relationship(
        back_populates="opponent_space",
        cascade="all, delete-orphan",
    )
    jobs: Mapped[list["Job"]] = relationship(
        back_populates="opponent_space",
        cascade="all, delete-orphan",
    )


class Game(Base):
    __tablename__ = "games"
    __table_args__ = (
        UniqueConstraint("source", "source_game_id", name="uq_games_source_source_game_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    opponent_space_id: Mapped[str] = mapped_column(ForeignKey("opponent_spaces.id"), index=True)
    source: Mapped[str] = mapped_column(String(50), index=True)
    source_game_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    white_name: Mapped[str] = mapped_column(String(255))
    black_name: Mapped[str] = mapped_column(String(255))
    white_rating: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    black_rating: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    rated: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    result: Mapped[str] = mapped_column(String(20))
    date_played: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    time_control: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    eco: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    opening_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    event: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    pgn_text: Mapped[str] = mapped_column(Text)
    total_plies: Mapped[int] = mapped_column(Integer, default=0)

    round: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    opponent_name_in_game: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    opponent_side: Mapped[Optional[Side]] = mapped_column(SAEnum(Side), nullable=True, index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    opponent_space: Mapped["OpponentSpace"] = relationship(back_populates="games")
    moves: Mapped[list["MoveFact"]] = relationship(
        back_populates="game",
        cascade="all, delete-orphan",
    )
    engine_analyses: Mapped[list["EngineAnalysis"]] = relationship(
        back_populates="game",
        cascade="all, delete-orphan",
    )


class MoveFact(Base):
    __tablename__ = "moves"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    game_id: Mapped[str] = mapped_column(ForeignKey("games.id"), index=True)
    ply: Mapped[int] = mapped_column(Integer, index=True)
    fullmove_number: Mapped[int] = mapped_column(Integer)
    side_to_move: Mapped[Side] = mapped_column(SAEnum(Side))
    san: Mapped[str] = mapped_column(String(50))
    uci: Mapped[str] = mapped_column(String(20))
    fen_before: Mapped[str] = mapped_column(Text)
    fen_after: Mapped[str] = mapped_column(Text)
    phase: Mapped[Phase] = mapped_column(SAEnum(Phase), default=Phase.opening)
    is_book: Mapped[bool] = mapped_column(Boolean, default=False)
    clock_before_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    clock_after_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    movetime_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    game: Mapped["Game"] = relationship(back_populates="moves")


class EngineAnalysis(Base):
    __tablename__ = "engine_analyses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    game_id: Mapped[str] = mapped_column(ForeignKey("games.id"), index=True)
    ply: Mapped[int] = mapped_column(Integer, index=True)
    fen_before: Mapped[str] = mapped_column(Text)
    move_uci: Mapped[str] = mapped_column(String(20))
    eval_before_cp: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    eval_after_cp: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    best_move_uci: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    best_move_san: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    centipawn_loss: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    classification: Mapped[Optional[MoveClassification]] = mapped_column(
        SAEnum(MoveClassification),
        nullable=True,
    )
    principal_variation: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    depth: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    engine_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    engine_version: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    game: Mapped["Game"] = relationship(back_populates="engine_analyses")


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    opponent_space_id: Mapped[str] = mapped_column(ForeignKey("opponent_spaces.id"), index=True)
    job_type: Mapped[JobType] = mapped_column(SAEnum(JobType), index=True)
    status: Mapped[JobStatus] = mapped_column(SAEnum(JobStatus), default=JobStatus.queued)
    payload: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    result: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    opponent_space: Mapped["OpponentSpace"] = relationship(back_populates="jobs")


class OpeningStat(Base):
    """Materialized per-opponent opening aggregate, refreshed after each analysis run."""
    __tablename__ = "opening_stats"
    __table_args__ = (
        UniqueConstraint("opponent_space_id", "eco", "opening_name", "color", name="uq_opening_stats_key"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    opponent_space_id: Mapped[str] = mapped_column(ForeignKey("opponent_spaces.id"), index=True)
    eco: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    opening_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    color: Mapped[Side] = mapped_column(SAEnum(Side))
    games_count: Mapped[int] = mapped_column(Integer, default=0)
    wins: Mapped[int] = mapped_column(Integer, default=0)
    draws: Mapped[int] = mapped_column(Integer, default=0)
    losses: Mapped[int] = mapped_column(Integer, default=0)
    avg_centipawn_loss: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    blunder_rate: Mapped[float] = mapped_column(Float, default=0.0)
    last_seen: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    opponent_space: Mapped["OpponentSpace"] = relationship()


class BlunderEvent(Base):
    """One row per blunder move observed in a game."""
    __tablename__ = "blunder_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    game_id: Mapped[str] = mapped_column(ForeignKey("games.id"), index=True)
    opponent_space_id: Mapped[str] = mapped_column(ForeignKey("opponent_spaces.id"), index=True)
    ply: Mapped[int] = mapped_column(Integer)
    phase: Mapped[Optional[Phase]] = mapped_column(SAEnum(Phase), nullable=True)
    eco: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    opening_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    side: Mapped[Optional[Side]] = mapped_column(SAEnum(Side), nullable=True)
    centipawn_loss: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    move_san: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    move_uci: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    best_move_san: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    best_move_uci: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    fen_before: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    game: Mapped["Game"] = relationship()
    opponent_space: Mapped["OpponentSpace"] = relationship()


class Report(Base):
    """Generated preparation report for an opponent."""
    __tablename__ = "reports"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    opponent_space_id: Mapped[str] = mapped_column(ForeignKey("opponent_spaces.id"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    content: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="draft")  # draft | ready | failed
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    opponent_space: Mapped["OpponentSpace"] = relationship()


class ExternalAccount(Base):
    """A platform account (lichess/chess.com) linked to an opponent space."""
    __tablename__ = "external_accounts"
    __table_args__ = (
        UniqueConstraint("opponent_space_id", "platform", "username", name="uq_external_accounts_key"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    opponent_space_id: Mapped[str] = mapped_column(ForeignKey("opponent_spaces.id"), index=True)
    platform: Mapped[Platform] = mapped_column(SAEnum(Platform))
    username: Mapped[str] = mapped_column(String(255))
    last_synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    meta: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    opponent_space: Mapped["OpponentSpace"] = relationship()