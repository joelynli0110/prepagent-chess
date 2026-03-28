import os

from dotenv import load_dotenv
from pydantic import BaseModel

load_dotenv()


class Settings(BaseModel):
    app_env: str = os.getenv("APP_ENV", "dev")
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./chess_prep.db")
    stockfish_path: str = os.getenv("STOCKFISH_PATH", "stockfish/stockfish_15_x64_avx2.exe")

    # LLM provider: "anthropic" | "ollama"
    llm_provider: str = os.getenv("LLM_PROVIDER", "ollama")

    # Anthropic (Claude API)
    anthropic_api_key: str = os.getenv("ANTHROPIC_API_KEY", "")
    chat_model: str = os.getenv("CHAT_MODEL", "claude-haiku-4-5-20251001")
    tagger_model: str = os.getenv("TAGGER_MODEL", "claude-haiku-4-5-20251001")
    report_model: str = os.getenv("REPORT_MODEL", "claude-sonnet-4-6")

    # Ollama (local fallback)
    ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    ollama_chat_model: str = os.getenv("OLLAMA_CHAT_MODEL", "qwen3:8b")
    ollama_tagger_model: str = os.getenv("OLLAMA_TAGGER_MODEL", "qwen3:8b")
    ollama_report_model: str = os.getenv("OLLAMA_REPORT_MODEL", "qwen3:8b")


settings = Settings()
