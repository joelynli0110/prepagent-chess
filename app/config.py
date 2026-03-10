from pydantic import BaseModel
import os

class Settings(BaseModel):
   app_env: str = os.getenv("APP_ENV", "dev")
   database_url: str = os.getenv("DATABASE_URL", "sqlite:///./chess_prep.db")
   stockfish_path: str = os.getenv("STOCKFISH_PATH", "stockfish/stockfish_15_x64_avx2.exe")

settings = Settings()