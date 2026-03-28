import os

from fastapi import FastAPI
from sqlalchemy import inspect, text

from app.api.routes.analytics import router as analytics_router
from app.api.routes.games import router as games_router
from app.api.routes.health import router as health_router
from app.api.routes.imports import router as imports_router
from app.api.routes.jobs import router as jobs_router
from app.api.routes.opponents import router as opponents_router
from app.api.routes.players import router as players_router
from app.api.routes.reports import router as reports_router
from app.db.base import Base
from app.db.session import engine
from fastapi.middleware.cors import CORSMiddleware


def create_app() -> FastAPI:
    app = FastAPI(title="Chess Preparation Agent")
    app.include_router(health_router)
    app.include_router(opponents_router)
    app.include_router(imports_router)
    app.include_router(jobs_router)
    app.include_router(games_router)
    app.include_router(analytics_router)
    app.include_router(players_router)
    app.include_router(reports_router)
    return app


app = create_app()
Base.metadata.create_all(bind=engine)

# Lightweight column migrations for SQLite (create_all won't alter existing tables)
with engine.connect() as _conn:
    _insp = inspect(engine)

    # opponent_spaces
    _cols = {c["name"] for c in _insp.get_columns("opponent_spaces")}
    if "profile_data" not in _cols:
        _conn.execute(text("ALTER TABLE opponent_spaces ADD COLUMN profile_data JSON"))
        _conn.commit()

    # games
    _cols = {c["name"] for c in _insp.get_columns("games")}
    for _col, _ddl in [
        ("white_rating", "INTEGER"),
        ("black_rating", "INTEGER"),
        ("rated", "BOOLEAN"),
        ("round", "INTEGER"),
    ]:
        if _col not in _cols:
            _conn.execute(text(f"ALTER TABLE games ADD COLUMN {_col} {_ddl}"))
    _conn.commit()

    # moves
    _cols = {c["name"] for c in _insp.get_columns("moves")}
    for _col, _ddl in [
        ("clock_before_ms", "INTEGER"),
        ("clock_after_ms", "INTEGER"),
        ("movetime_ms", "INTEGER"),
    ]:
        if _col not in _cols:
            _conn.execute(text(f"ALTER TABLE moves ADD COLUMN {_col} {_ddl}"))
    _conn.commit()

    # engine_analyses
    _cols = {c["name"] for c in _insp.get_columns("engine_analyses")}
    for _col, _ddl in [
        ("engine_name", "VARCHAR(100)"),
        ("engine_version", "VARCHAR(50)"),
    ]:
        if _col not in _cols:
            _conn.execute(text(f"ALTER TABLE engine_analyses ADD COLUMN {_col} {_ddl}"))
    _conn.commit()

_allow_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
# Allow additional origins from env (comma-separated), e.g. your Vercel URL
_extra = os.getenv("CORS_ORIGINS", "")
if _extra:
    _allow_origins += [o.strip() for o in _extra.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)