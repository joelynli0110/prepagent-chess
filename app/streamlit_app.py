import streamlit as st
from prep_agent.prefs import PrepPrefs, RiskProfile, TimeBudget
from prep_agent.planner_v1 import build_simple_plan
from prep_agent.session_service import SessionService
from prep_agent.storage_sqlite import SQLiteStore

svc = SessionService(SQLiteStore("data/prep.db"))

def prefs_form(default: PrepPrefs) -> PrepPrefs:
    st.subheader("Prep Preferences")

    focus = st.selectbox("Focus", ["both", "opp_as_white", "opp_as_black"], index=["both","opp_as_white","opp_as_black"].index(default.focus))
    risk = st.selectbox("Risk profile", [r.value for r in RiskProfile], index=[r.value for r in RiskProfile].index(default.risk.value))
    budget = st.selectbox("Time budget", [t.value for t in TimeBudget], index=[t.value for t in TimeBudget].index(default.time_budget.value))

    as_white = st.text_input("As White first moves (comma-separated)", value=", ".join(default.as_white_first_moves))
    vs_e4 = st.text_input("As Black vs e4 (comma-separated)", value=", ".join(default.as_black_vs_e4))
    vs_d4 = st.text_input("As Black vs d4 (comma-separated)", value=", ".join(default.as_black_vs_d4))

    banned = st.text_input("Banned branch keywords (comma-separated)", value=", ".join(default.banned_branch_keywords))

    max_targets = st.slider("Max targets per side", 1, 5, int(default.max_targets_per_side))
    max_tp = st.slider("Max turning points per target", 1, 20, int(default.max_turning_points_per_side))

    notes = st.text_area("Notes", value=default.notes, height=80)

    prefs = PrepPrefs(
        focus=focus,
        risk=RiskProfile(risk),
        time_budget=TimeBudget(budget),
        as_white_first_moves=[x.strip() for x in as_white.split(",") if x.strip()],
        as_black_vs_e4=[x.strip() for x in vs_e4.split(",") if x.strip()],
        as_black_vs_d4=[x.strip() for x in vs_d4.split(",") if x.strip()],
        banned_branch_keywords=[x.strip() for x in banned.split(",") if x.strip()],
        max_targets_per_side=max_targets,
        max_turning_points_per_side=max_tp,
        notes=notes,
    ).normalize()

    ok, errors = prefs.validate()
    if not ok:
        for e in errors:
            st.error(e)

    return prefs

# Session selector in sidebar
st.sidebar.header("Session")
sessions = svc.list_sessions(limit=20)

if not sessions:
    st.sidebar.warning("No sessions found. Create one using the prep agent first.")
    st.stop()

session_ids = [s["session_id"] for s in sessions]
session_options = {s["session_id"]: f"{s.get('opponent_name', 'Unknown')} ({s['session_id'][:8]})" for s in sessions}

# Clear stale session_id if it no longer exists
if st.session_state.get("session_id") not in session_ids:
    st.session_state["session_id"] = session_ids[0]

selected = st.sidebar.selectbox(
    "Select session",
    options=session_ids,
    format_func=lambda x: session_options[x],
    index=session_ids.index(st.session_state["session_id"])
)
st.session_state["session_id"] = selected

session = svc.load_session(st.session_state["session_id"])
if not session or not session.report:
    st.warning("Load a session with a report first (run Sprint 1 ingest).")
else:
    prefs = prefs_form(session.prefs)

    colA, colB = st.columns(2)

    with colA:
        if st.button("Save preferences"):
            svc.update_prefs(session.session_id, prefs)
            st.success("Preferences saved.")

    with colB:
        if st.button("Build plan (v1)"):
            plan = build_simple_plan(session.report, prefs)
            # optionally store as artifact
            # svc.save_planned(session.session_id, plan)  # only if you decide plan is a dataclass JSON-friendly
            st.session_state["current_plan"] = plan
            st.success("Plan built.")

    plan = st.session_state.get("current_plan", None)
    if plan:
        st.subheader("Targets")
        for t in plan.targets:
            st.markdown(f"### {t.opponent_side} — {' '.join(t.branch.moves_san)}  (games={t.branch.games}, score={t.branch.score:.2f})")
            if not t.turning_points:
                st.write("_No turning points found in this branch yet._")
            for tp in t.turning_points[:10]:
                st.write(f"- {tp.title}: opponent played {tp.opponent_mistake_move_san} (drop≈{tp.drop_cp_equiv/100:.1f}) punish={tp.punish_move_uci}")
