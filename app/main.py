from fastapi import FastAPI

from app.api.routes.games import router as games_router
from app.api.routes.health import router as health_router
from app.api.routes.imports import router as imports_router
from app.api.routes.jobs import router as jobs_router
from app.api.routes.opponents import router as opponents_router
from app.db.base import Base
from app.db.session import engine


def create_app() -> FastAPI:
    app = FastAPI(title="Chess Preparation Agent")
    app.include_router(health_router)
    app.include_router(opponents_router)
    app.include_router(imports_router)
    app.include_router(jobs_router)
    app.include_router(games_router)
    return app


app = create_app()
Base.metadata.create_all(bind=engine)