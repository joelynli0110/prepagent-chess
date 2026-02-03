import os
import streamlit as st
from dotenv import load_dotenv

from prep_agent.types import PrepConfig
from prep_agent.pipeline import run_prep

load_dotenv()

st.set_page_config(page_title="PrepAgent Chess - Opponent Prep", layout="wide")
st.title("PrepAgent Chess — Opponent Preparation Agent (Sprint 1)")

# ===== UI Inputs =====
opponent_name = st.text_input("Opponent name (optional, used to identify if opponent is White or Black in PGN)", value="")

default_stockfish = os.getenv("STOCKFISH_PATH", "stockfish")
stockfish_path = st.text_input(
    "Stockfish path (on Windows, provide full path to .exe)",
    value=default_stockfish,
)

engine_movetime = st.slider("Engine analysis time per move (ms)", 50, 1000, 150, step=50)
opening_plies = st.slider("Opening plies to analyze (first N half-moves)", 4, 16, 8, step=2)

uploaded = st.file_uploader("Upload opponent PGN files (multiple allowed)", type=["pgn"], accept_multiple_files=True)

run_btn = st.button("Run Opponent Preparation Analysis")

# ===== Run Analysis =====
if run_btn:
    if not uploaded:
        st.error("Please upload at least one PGN file first.")
        st.stop()

    # Read PGN text
    pgn_texts = []
    for f in uploaded:
        pgn_texts.append(f.read().decode("utf-8", errors="ignore"))

    cfg = PrepConfig(
        stockfish_path=stockfish_path,
        engine_movetime_ms=engine_movetime,
        opening_plies=opening_plies,
        # You can also adjust thresholds here:
        # mistake_drop_cp=80,
        # blunder_drop_cp=200,
        # turning_points_per_side=10,
    )

    with st.spinner("Analyzing: Importing PGN → Opening profile → Engine finding mistakes → Generating report..."):
        report = run_prep(pgn_texts, opponent_name=opponent_name.strip() or None, cfg=cfg)

    st.success(f"Done! Analyzed {report.games_ingested} games.")

    # ===== Display Results =====
    col1, col2 = st.columns([1, 1])

    with col1:
        st.subheader("Opening Profile (Opponent's Opening Preferences)")
        op = report.opening_profile

        st.markdown("### Opponent as White - Top Branches")
        for b in op.as_white_top[:10]:
            st.write(f"- {' '.join(b.moves_san)} | games={b.games} | score={b.score:.2f}")

        st.markdown("### Opponent as Black vs 1.e4 - Top Branches")
        for b in op.as_black_vs_e4_top[:10]:
            st.write(f"- {' '.join(b.moves_san)} | games={b.games} | score={b.score:.2f}")

        st.markdown("### Opponent as Black vs 1.d4 - Top Branches")
        for b in op.as_black_vs_d4_top[:10]:
            st.write(f"- {' '.join(b.moves_san)} | games={b.games} | score={b.score:.2f}")

    with col2:
        st.subheader("Top Blunders (Opponent's Biggest Mistakes)")
        for b in report.blunders[:15]:
            st.write(
                f"- [{b.opponent_side}] ply {b.ply} | {b.played_move_san} "
                f"| drop≈{b.drop_cp_equiv/100:.1f} | opening: {b.opening_key}"
            )

    st.subheader("Target Plans (Training Packs / Key Turning Points)")
    for t in report.targets:
        st.markdown(f"### {t.headline}")
        if t.likely_openings:
            st.markdown("**Likely branches:**")
            for br in t.likely_openings:
                st.write(f"- {' '.join(br.moves_san)} (games={br.games}, score={br.score:.2f})")
        if t.turning_points:
            st.markdown("**Turning points to drill:**")
            for i, tp in enumerate(t.turning_points[:10], 1):
                st.write(
                    f"{i}. {tp.title} | opponent played {tp.opponent_mistake_move_san} "
                    f"| drop≈{tp.drop_cp_equiv/100:.1f} | punish={tp.punish_move_uci}"
                )

    st.subheader("Markdown Report (Copy/Export)")
    st.markdown(report.markdown_report)
