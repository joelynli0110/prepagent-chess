# prep_agent/storage_sqlite.py
from __future__ import annotations

import json
import sqlite3
from dataclasses import asdict, is_dataclass
from typing import Any, Dict, List, Optional, Tuple
from pathlib import Path
from datetime import datetime


def _json_dumps(obj: Any) -> str:
    if is_dataclass(obj):
        obj = asdict(obj)
    return json.dumps(obj, ensure_ascii=False)


def _json_loads(s: Optional[str]) -> Optional[Dict[str, Any]]:
    if not s:
        return None
    return json.loads(s)


class SQLiteStore:
    """
    Minimal SQLite store.
    - Use one DB file.
    - Store artifacts as JSON blobs.
    """

    def __init__(self, db_path: str):
        self.db_path = str(db_path)
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        # Streamlit can rerun scripts; per-call connections are simplest.
        # check_same_thread=False helps if Streamlit uses threads.
        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS sessions (
                  session_id TEXT PRIMARY KEY,
                  created_at TEXT NOT NULL,
                  opponent_name TEXT,
                  cfg_json TEXT NOT NULL,
                  prefs_json TEXT NOT NULL,
                  activity_log_json TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS artifacts (
                  session_id TEXT NOT NULL,
                  kind TEXT NOT NULL,            -- 'report' | 'planned' | 'drills'
                  created_at TEXT NOT NULL,
                  payload_json TEXT NOT NULL,
                  PRIMARY KEY (session_id, kind),
                  FOREIGN KEY (session_id) REFERENCES sessions(session_id)
                )
                """
            )
            conn.execute("CREATE INDEX IF NOT EXISTS idx_artifacts_session ON artifacts(session_id)")
            conn.commit()

    # ---------- sessions ----------
    def upsert_session_meta(
        self,
        session_id: str,
        created_at: str,
        opponent_name: Optional[str],
        cfg_obj: Any,
        prefs_obj: Any,
        activity_log: List[str],
    ) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO sessions(session_id, created_at, opponent_name, cfg_json, prefs_json, activity_log_json)
                VALUES(?, ?, ?, ?, ?, ?)
                ON CONFLICT(session_id) DO UPDATE SET
                  opponent_name=excluded.opponent_name,
                  cfg_json=excluded.cfg_json,
                  prefs_json=excluded.prefs_json,
                  activity_log_json=excluded.activity_log_json
                """,
                (
                    session_id,
                    created_at,
                    opponent_name,
                    _json_dumps(cfg_obj),
                    _json_dumps(prefs_obj),
                    _json_dumps(activity_log),
                ),
            )
            conn.commit()

    def get_session_meta(self, session_id: str) -> Optional[Dict[str, Any]]:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM sessions WHERE session_id=?",
                (session_id,),
            ).fetchone()
            if not row:
                return None
            return {
                "session_id": row["session_id"],
                "created_at": row["created_at"],
                "opponent_name": row["opponent_name"],
                "cfg": _json_loads(row["cfg_json"]),
                "prefs": _json_loads(row["prefs_json"]),
                "activity_log": _json_loads(row["activity_log_json"]) or [],
            }

    def list_sessions(self, limit: int = 50) -> List[Dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT session_id, created_at, opponent_name
                FROM sessions
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
            return [
                {
                    "session_id": r["session_id"],
                    "created_at": r["created_at"],
                    "opponent_name": r["opponent_name"],
                }
                for r in rows
            ]

    def delete_session(self, session_id: str) -> None:
        with self._connect() as conn:
            conn.execute("DELETE FROM artifacts WHERE session_id=?", (session_id,))
            conn.execute("DELETE FROM sessions WHERE session_id=?", (session_id,))
            conn.commit()

    # ---------- artifacts ----------
    def upsert_artifact(self, session_id: str, kind: str, payload_obj: Any) -> None:
        created_at = datetime.utcnow().isoformat(timespec="seconds") + "Z"
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO artifacts(session_id, kind, created_at, payload_json)
                VALUES(?, ?, ?, ?)
                ON CONFLICT(session_id, kind) DO UPDATE SET
                  created_at=excluded.created_at,
                  payload_json=excluded.payload_json
                """,
                (session_id, kind, created_at, _json_dumps(payload_obj)),
            )
            conn.commit()

    def get_artifact(self, session_id: str, kind: str) -> Optional[Dict[str, Any]]:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT payload_json FROM artifacts WHERE session_id=? AND kind=?",
                (session_id, kind),
            ).fetchone()
            if not row:
                return None
            return _json_loads(row["payload_json"])

    def get_all_artifacts(self, session_id: str) -> Dict[str, Optional[Dict[str, Any]]]:
        return {
            "report": self.get_artifact(session_id, "report"),
            "planned": self.get_artifact(session_id, "planned"),
            "drills": self.get_artifact(session_id, "drills"),
            "coaching": self.get_artifact(session_id, "coaching"),
        }
