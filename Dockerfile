FROM python:3.11-slim

# Install Stockfish and build tools
RUN apt-get update && apt-get install -y \
    stockfish \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY pyproject.toml ./
RUN pip install --no-cache-dir ".[all]" 2>/dev/null || \
    pip install --no-cache-dir \
        fastapi uvicorn[standard] sqlalchemy python-dotenv \
        python-chess langchain langchain-core langchain-anthropic \
        langgraph langchain-community pydantic

COPY app/ ./app/

# Data directory for SQLite
RUN mkdir -p /data

ENV DATABASE_URL=sqlite:////data/chess_prep.db
ENV STOCKFISH_PATH=/usr/games/stockfish

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
