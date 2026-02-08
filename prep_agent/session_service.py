# prep_agent/session_service.py
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any

from .storage_sqlite import SQLiteStore
from .types import (
    PrepConfig, PrepReport, OpeningProfile, OpeningBranchStat,
    BlunderEvent, TargetPlan, TurningPoint, Side, Severity
)
from .session_types import PrepSession, PlannedPrep, DrillPack, CoachingAdvice
from .prefs import PrepPrefs

def _utc_now() -> str:
    return datetime.utcnow().isoformat(timespec="seconds") + "Z"


def _ensure_dataclass(cls, payload: Optional[Dict[str, Any]]):
    if payload is None:
        return None
    return cls(**payload)


def _deserialize_report(data: Optional[Dict[str, Any]]) -> Optional[PrepReport]:
    """Deserialize a PrepReport from a dict, handling nested dataclasses."""
    if data is None:
        return None

    # Deserialize OpeningProfile
    op_data = data.get("opening_profile")
    if op_data:
        opening_profile = OpeningProfile(
            opening_plies=op_data["opening_plies"],
            opponent_name=op_data.get("opponent_name"),
            as_white_top=[OpeningBranchStat(side=Side(b["side"]), **{k: v for k, v in b.items() if k != "side"}) for b in op_data.get("as_white_top", [])],
            as_black_vs_e4_top=[OpeningBranchStat(side=Side(b["side"]), **{k: v for k, v in b.items() if k != "side"}) for b in op_data.get("as_black_vs_e4_top", [])],
            as_black_vs_d4_top=[OpeningBranchStat(side=Side(b["side"]), **{k: v for k, v in b.items() if k != "side"}) for b in op_data.get("as_black_vs_d4_top", [])],
        )
    else:
        opening_profile = OpeningProfile(opening_plies=8)

    # Deserialize blunders
    blunders = []
    for b in data.get("blunders", []):
        blunders.append(BlunderEvent(
            opponent_side=Side(b["opponent_side"]),
            severity=Severity(b["severity"]),
            **{k: v for k, v in b.items() if k not in ("opponent_side", "severity")}
        ))

    # Deserialize targets
    targets = []
    for t in data.get("targets", []):
        likely_openings = [
            OpeningBranchStat(side=Side(o["side"]), **{k: v for k, v in o.items() if k != "side"})
            for o in t.get("likely_openings", [])
        ]
        turning_points = [
            TurningPoint(severity=Severity(tp["severity"]), **{k: v for k, v in tp.items() if k != "severity"})
            for tp in t.get("turning_points", [])
        ]
        targets.append(TargetPlan(
            opponent_side=Side(t["opponent_side"]),
            headline=t["headline"],
            likely_openings=likely_openings,
            turning_points=turning_points,
        ))

    return PrepReport(
        created_at=data["created_at"],
        games_ingested=data["games_ingested"],
        opening_profile=opening_profile,
        blunders=blunders,
        targets=targets,
        markdown_report=data.get("markdown_report", ""),
        opponent_name=data.get("opponent_name"),
    )


class SessionService:
    """
    Create/load/update PrepSession.
    Store persists:
      - session meta: cfg, prefs, activity log
      - artifacts: report/planned/drills
    """

    def __init__(self, store: SQLiteStore):
        self.store = store

    # ---------- create ----------
    def create_session(self, opponent_name: Optional[str], cfg: PrepConfig, prefs: Optional[PrepPrefs] = None) -> PrepSession:
        session_id = uuid.uuid4().hex[:12]
        created_at = _utc_now()
        prefs = prefs or PrepPrefs()
        activity = [f"{created_at} created session"]

        self.store.upsert_session_meta(
            session_id=session_id,
            created_at=created_at,
            opponent_name=opponent_name,
            cfg_obj=cfg,
            prefs_obj=prefs,
            activity_log=activity,
        )

        return PrepSession(
            session_id=session_id,
            created_at=created_at,
            opponent_name=opponent_name,
            cfg=cfg,
            prefs=prefs,
            report=None,
            planned=None,
            drills=None,
            activity_log=activity,
        )

    # ---------- load ----------
    def load_session(self, session_id: str) -> Optional[PrepSession]:
        meta = self.store.get_session_meta(session_id)
        if not meta:
            return None

        cfg = PrepConfig(**meta["cfg"])
        prefs = PrepPrefs(**meta["prefs"])
        artifacts = self.store.get_all_artifacts(session_id)

        report = _deserialize_report(artifacts["report"])
        planned = _ensure_dataclass(PlannedPrep, artifacts["planned"])
        drills = _ensure_dataclass(DrillPack, artifacts["drills"])
        coaching = _ensure_dataclass(CoachingAdvice, artifacts["coaching"])

        return PrepSession(
            session_id=meta["session_id"],
            created_at=meta["created_at"],
            opponent_name=meta["opponent_name"],
            cfg=cfg,
            prefs=prefs,
            report=report,
            planned=planned,
            drills=drills,
            coaching=coaching,
            activity_log=meta["activity_log"],
        )

    def list_sessions(self, limit: int = 50) -> List[Dict[str, Any]]:
        return self.store.list_sessions(limit=limit)

    # ---------- update meta ----------
    def update_prefs(self, session_id: str, prefs: PrepPrefs) -> None:
        meta = self.store.get_session_meta(session_id)
        if not meta:
            raise ValueError("Session not found")

        activity = meta["activity_log"] or []
        activity.append(f"{_utc_now()} updated prefs")

        self.store.upsert_session_meta(
            session_id=session_id,
            created_at=meta["created_at"],
            opponent_name=meta["opponent_name"],
            cfg_obj=meta["cfg"],
            prefs_obj=prefs,
            activity_log=activity,
        )

    def update_cfg(self, session_id: str, cfg: PrepConfig) -> None:
        meta = self.store.get_session_meta(session_id)
        if not meta:
            raise ValueError("Session not found")

        activity = meta["activity_log"] or []
        activity.append(f"{_utc_now()} updated cfg")

        self.store.upsert_session_meta(
            session_id=session_id,
            created_at=meta["created_at"],
            opponent_name=meta["opponent_name"],
            cfg_obj=cfg,
            prefs_obj=meta["prefs"],
            activity_log=activity,
        )

    # ---------- update artifacts ----------
    def save_report(self, session_id: str, report: PrepReport) -> None:
        self.store.upsert_artifact(session_id, "report", report)
        self._log(session_id, "saved report")

    def save_planned(self, session_id: str, planned: PlannedPrep) -> None:
        self.store.upsert_artifact(session_id, "planned", planned)
        self._log(session_id, "saved planned prep")

    def save_drills(self, session_id: str, drills: DrillPack) -> None:
        self.store.upsert_artifact(session_id, "drills", drills)
        self._log(session_id, "saved drills")

    def save_coaching(self, session_id: str, coaching: CoachingAdvice) -> None:
        self.store.upsert_artifact(session_id, "coaching", coaching)
        self._log(session_id, "saved coaching advice")

    # ---------- utility ----------
    def _log(self, session_id: str, message: str) -> None:
        meta = self.store.get_session_meta(session_id)
        if not meta:
            return
        activity = meta["activity_log"] or []
        activity.append(f"{_utc_now()} {message}")

        # re-upsert meta with updated activity
        self.store.upsert_session_meta(
            session_id=session_id,
            created_at=meta["created_at"],
            opponent_name=meta["opponent_name"],
            cfg_obj=meta["cfg"],
            prefs_obj=meta["prefs"],
            activity_log=activity,
        )

    def delete_session(self, session_id: str) -> None:
        self.store.delete_session(session_id)
