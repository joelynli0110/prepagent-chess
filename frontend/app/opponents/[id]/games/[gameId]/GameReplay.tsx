"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { apiGet, apiPost } from "@/lib/api";
import { EngineAnalysis, Game, MoveFact, Side } from "@/lib/types";

const autoAnalysisInFlight = new Set<string>();

function validateFen(fen: string | undefined): string {
  if (!fen) return "start";
  try {
    new Chess(fen);
    return fen;
  } catch {
    return "start";
  }
}

function classStyle(cls: string | null | undefined): string {
  if (!cls) return "border-gray-200 bg-gray-50 text-gray-500";
  const styles: Record<string, string> = {
    blunder: "border-rose-200 bg-rose-50 text-rose-700",
    mistake: "border-amber-200 bg-amber-50 text-amber-700",
    inaccuracy: "border-yellow-200 bg-yellow-50 text-yellow-700",
    good: "border-emerald-200 bg-emerald-50 text-emerald-700",
    excellent: "border-emerald-200 bg-emerald-50 text-emerald-700",
    book: "border-gray-200 bg-gray-50 text-gray-500",
  };
  return styles[cls] ?? "border-gray-200 bg-gray-50 text-gray-500";
}

function resultLabel(result: string): string {
  if (result === "1/2-1/2") return "1/2";
  return result;
}

function evalText(cp: number | null | undefined): string {
  if (cp == null) return "-";
  const pawns = cp / 100;
  return `${pawns > 0 ? "+" : ""}${pawns.toFixed(1)}`;
}

function moveIndexFromPly(ply: number): number {
  return Math.max(0, ply - 1);
}

function moveLabel(move: MoveFact | undefined): string {
  if (!move) return "-";
  const moveNumber = Math.ceil(move.ply / 2);
  return `${moveNumber}${move.side_to_move === "black" ? "..." : "."} ${move.san}`;
}

function moveTone(classification: string | null | undefined): string {
  if (classification === "blunder") return "text-rose-600";
  if (classification === "mistake") return "text-amber-600";
  return "";
}

function squareCenter(square: string, orientation: Side): { x: number; y: number } | null {
  if (!/^[a-h][1-8]$/.test(square)) return null;
  const file = square.charCodeAt(0) - "a".charCodeAt(0);
  const rank = Number(square[1]) - 1;

  const boardFile = orientation === "white" ? file : 7 - file;
  const boardRankFromTop = orientation === "white" ? 7 - rank : rank;

  return {
    x: (boardFile + 0.5) * 12.5,
    y: (boardRankFromTop + 0.5) * 12.5,
  };
}

function StraightArrowOverlay({
  uci,
  orientation,
}: {
  uci: string | undefined;
  orientation: Side;
}) {
  if (!uci || uci.length < 4) return null;

  const from = squareCenter(uci.slice(0, 2), orientation);
  const to = squareCenter(uci.slice(2, 4), orientation);
  if (!from || !to) return null;

  return (
    <svg
      viewBox="0 0 100 100"
      className="pointer-events-none absolute inset-0 z-10"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <marker
          id="replay-arrowhead"
          markerWidth="3.2"
          markerHeight="3.2"
          refX="2.55"
          refY="1.6"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L3.2,1.6 L0,3.2 z" fill="rgba(60, 72, 52, 0.58)" />
        </marker>
      </defs>
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke="rgba(60, 72, 52, 0.58)"
        strokeWidth="0.82"
        strokeLinecap="round"
        markerEnd="url(#replay-arrowhead)"
      />
    </svg>
  );
}

function squareHighlights(uci: string | undefined): Record<string, CSSProperties> {
  if (!uci || uci.length < 4) return {};
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  return {
    [from]: {
      background:
        "radial-gradient(circle, rgba(245, 196, 0, 0.35) 0%, rgba(245, 196, 0, 0.22) 55%, rgba(245, 196, 0, 0.12) 100%)",
    },
    [to]: {
      background:
        "radial-gradient(circle, rgba(255, 166, 0, 0.48) 0%, rgba(255, 166, 0, 0.28) 58%, rgba(255, 166, 0, 0.14) 100%)",
      boxShadow: "inset 0 0 0 2px rgba(17,17,16,0.18)",
    },
  };
}

function CurrentMoveCard({
  move,
  analysis,
}: {
  move: MoveFact | null;
  analysis: EngineAnalysis | null;
}) {
  if (!move) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-400 shadow-sm">
        Start position
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-gray-400">Current move</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="font-mono text-lg font-semibold text-gray-900">{move.san}</span>
            <span className="text-xs text-gray-400">
              {move.side_to_move === "white" ? `${Math.ceil(move.ply / 2)}.` : `${Math.ceil(move.ply / 2)}...`}
            </span>
          </div>
        </div>
        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${classStyle(analysis?.classification)}`}>
          {analysis?.classification ?? "raw"}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-gray-50 px-3 py-2">
          <div className="text-[11px] uppercase tracking-wide text-gray-400">Phase</div>
          <div className="mt-1 text-sm font-medium capitalize text-gray-700">{move.phase}</div>
        </div>
        <div className="rounded-xl bg-gray-50 px-3 py-2">
          <div className="text-[11px] uppercase tracking-wide text-gray-400">Eval</div>
          <div className="mt-1 text-sm font-medium text-gray-700">{evalText(analysis?.eval_after_cp)}</div>
        </div>
        <div className="rounded-xl bg-gray-50 px-3 py-2">
          <div className="text-[11px] uppercase tracking-wide text-gray-400">CPL</div>
          <div className="mt-1 text-sm font-medium text-gray-700">{analysis?.centipawn_loss ?? "-"}</div>
        </div>
      </div>

      {(analysis?.best_move_san || analysis?.best_move_uci) && (
        <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-600">
          Best move: <span className="font-mono font-medium text-gray-900">{analysis?.best_move_san ?? analysis?.best_move_uci}</span>
        </div>
      )}
    </div>
  );
}

function MoveList({
  moves,
  analysisByPly,
  currentPly,
  onSelect,
}: {
  moves: MoveFact[];
  analysisByPly: Map<number, EngineAnalysis>;
  currentPly: number;
  onSelect: (ply: number) => void;
}) {
  const rows = useMemo(() => {
    const grouped = new Map<number, { white?: MoveFact; black?: MoveFact }>();
    for (const move of moves) {
      const moveNumber = Math.ceil(move.ply / 2);
      const row = grouped.get(moveNumber) ?? {};
      if (move.side_to_move === "white") row.white = move;
      else row.black = move;
      grouped.set(moveNumber, row);
    }
    return [...grouped.entries()];
  }, [moves]);

  useEffect(() => {
    if (currentPly <= 0) return;
    const active = document.querySelector<HTMLElement>(`[data-ply="${currentPly}"]`);
    active?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [currentPly]);

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-400">Moves</div>
      <div className="max-h-[520px] overflow-y-auto">
        <div className="grid grid-cols-[56px_1fr_1fr] gap-x-2 px-3 py-2 text-[11px] uppercase tracking-wide text-gray-400">
          <div>#</div>
          <div>White</div>
          <div>Black</div>
        </div>
        {rows.map(([moveNumber, pair]) => (
          <div key={moveNumber} className="grid grid-cols-[56px_1fr_1fr] gap-x-2 border-t border-gray-100 px-3 py-2">
            <div className="pt-2 text-xs text-gray-400">{moveNumber}</div>
            <button
              type="button"
              onClick={() => pair.white && onSelect(pair.white.ply)}
              data-ply={pair.white?.ply}
              className={`rounded-lg px-2 py-2 text-left text-sm transition-colors ${
                pair.white?.ply === currentPly ? "bg-gray-900 text-white" : "hover:bg-gray-50"
              } ${
                pair.white
                  ? pair.white?.ply === currentPly
                    ? "text-white"
                    : `text-gray-700 ${moveTone(analysisByPly.get(pair.white.ply)?.classification)}`
                  : "text-gray-300"
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                {pair.white?.san ?? "-"}
                {pair.white && analysisByPly.get(pair.white.ply)?.classification === "blunder" && (
                  <span className="text-[10px] font-medium uppercase tracking-wide opacity-80">B</span>
                )}
                {pair.white && analysisByPly.get(pair.white.ply)?.classification === "mistake" && (
                  <span className="text-[10px] font-medium uppercase tracking-wide opacity-80">M</span>
                )}
              </span>
            </button>
            <button
              type="button"
              onClick={() => pair.black && onSelect(pair.black.ply)}
              data-ply={pair.black?.ply}
              className={`rounded-lg px-2 py-2 text-left text-sm transition-colors ${
                pair.black?.ply === currentPly ? "bg-gray-900 text-white" : "hover:bg-gray-50"
              } ${
                pair.black
                  ? pair.black?.ply === currentPly
                    ? "text-white"
                    : `text-gray-700 ${moveTone(analysisByPly.get(pair.black.ply)?.classification)}`
                  : "text-gray-300"
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                {pair.black?.san ?? "-"}
                {pair.black && analysisByPly.get(pair.black.ply)?.classification === "blunder" && (
                  <span className="text-[10px] font-medium uppercase tracking-wide opacity-80">B</span>
                )}
                {pair.black && analysisByPly.get(pair.black.ply)?.classification === "mistake" && (
                  <span className="text-[10px] font-medium uppercase tracking-wide opacity-80">M</span>
                )}
              </span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ErrorJumpList({
  title,
  tone,
  entries,
  movesByPly,
  onSelect,
}: {
  title: string;
  tone: "rose" | "amber";
  entries: EngineAnalysis[];
  movesByPly: Map<number, MoveFact>;
  onSelect: (ply: number) => void;
}) {
  const styles =
    tone === "rose"
      ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
      : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100";

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-400">{title}</div>
      {entries.length === 0 ? (
        <div className="text-sm text-gray-400">None</div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {entries.map((entry) => {
            const move = movesByPly.get(entry.ply);
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => onSelect(entry.ply)}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${styles}`}
                title={`Jump to ${moveLabel(move)}`}
              >
                {moveLabel(move)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function GameReplay({
  opponentId,
  game,
  moves,
  analysis,
}: {
  opponentId: string;
  game: Game;
  moves: MoveFact[];
  analysis: EngineAnalysis[];
}) {
  const [currentPly, setCurrentPly] = useState(0);
  const [analysisRows, setAnalysisRows] = useState(analysis);
  const [analysisStatus, setAnalysisStatus] = useState<"idle" | "running" | "failed">("idle");
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const hasAutoAnalyzeAttemptedRef = useRef(false);

  const analysisByPly = useMemo(() => new Map(analysisRows.map((row) => [row.ply, row])), [analysisRows]);
  const movesByPly = useMemo(() => new Map(moves.map((move) => [move.ply, move])), [moves]);
  const currentMove = currentPly > 0 ? moves[moveIndexFromPly(currentPly)] ?? null : null;
  const currentAnalysis = currentMove ? analysisByPly.get(currentMove.ply) ?? null : null;
  const boardFen = currentPly === 0 ? validateFen(moves[0]?.fen_before) : validateFen(moves[moveIndexFromPly(currentPly)]?.fen_after);
  const orientation: Side = game.opponent_side ?? "white";
  const highlightedSquares = squareHighlights(currentMove?.uci);
  const blunders = analysisRows.filter((a) => a.classification === "blunder");
  const mistakes = analysisRows.filter((a) => a.classification === "mistake");

  useEffect(() => {
    setAnalysisRows(analysis);
    setAnalysisStatus("idle");
    setAnalysisError(null);
    hasAutoAnalyzeAttemptedRef.current = analysis.length > 0;
  }, [analysis, game.id]);

  async function analyzeNow(trigger: "auto" | "manual" = "manual") {
    if (autoAnalysisInFlight.has(game.id)) return;

    autoAnalysisInFlight.add(game.id);
    setAnalysisStatus("running");
    setAnalysisError(null);
    try {
      await apiPost(`/games/${game.id}/analyze`, { depth: 10, max_plies: 40 });
      const refreshed = await apiGet<EngineAnalysis[]>(`/games/${game.id}/analysis`);
      setAnalysisRows(refreshed);
      setAnalysisStatus("idle");
      if (trigger === "auto") {
        hasAutoAnalyzeAttemptedRef.current = true;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Analysis failed";
      setAnalysisError(message);
      setAnalysisStatus("failed");
      if (trigger === "auto") {
        hasAutoAnalyzeAttemptedRef.current = true;
      }
    } finally {
      autoAnalysisInFlight.delete(game.id);
    }
  }

  useEffect(() => {
    if (moves.length === 0 || analysisRows.length > 0 || hasAutoAnalyzeAttemptedRef.current) return;
    void analyzeNow("auto");
  }, [analysisRows.length, moves.length, game.id]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setCurrentPly((p) => Math.max(0, p - 1));
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        setCurrentPly((p) => Math.min(moves.length, p + 1));
      } else if (event.key === "Home") {
        event.preventDefault();
        setCurrentPly(0);
      } else if (event.key === "End") {
        event.preventDefault();
        setCurrentPly(moves.length);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [moves.length]);

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <Link href={`/opponents/${opponentId}`} className="text-sm text-gray-400 transition-colors hover:text-gray-700">
            ← Opponent
          </Link>
          <h1 className="text-2xl font-semibold text-gray-900">
            {game.white_name} vs {game.black_name}
          </h1>
          <div className="text-sm text-gray-500">
            {game.event ?? "Unknown event"}
            {game.date_played ? ` · ${game.date_played}` : ""}
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
          {analysisStatus === "running" && <div className="text-sm text-gray-400">Analyzing...</div>}
          {analysisStatus === "failed" && <div className="text-sm text-rose-600">Analysis failed</div>}
          <div className="text-sm text-gray-500">Result</div>
          <div className="font-semibold text-gray-900">{resultLabel(game.result)}</div>
          <button
            type="button"
            onClick={() => void analyzeNow()}
            disabled={analysisStatus === "running"}
            className="ml-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {analysisRows.length > 0 ? "Re-analyze" : analysisStatus === "running" ? "Analyzing..." : "Analyze"}
          </button>
        </div>
      </div>

      {analysisError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {analysisError}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_420px]">
        <section className="space-y-4">
          <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="relative">
              <StraightArrowOverlay uci={currentMove?.uci} orientation={orientation} />
              <Chessboard
                key={`${game.id}-${currentPly}-${boardFen}`}
                options={{
                  position: boardFen,
                  boardOrientation: orientation,
                  allowDragging: false,
                  showNotation: true,
                  boardStyle: { borderRadius: 20 },
                  customDarkSquareStyle: { backgroundColor: "#b7c0aa" },
                  customLightSquareStyle: { backgroundColor: "#f1efe7" },
                  customSquareStyles: highlightedSquares,
                }}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPly(0)}
              className="rounded-full border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 shadow-sm transition-colors hover:bg-gray-50"
            >
              |‹
            </button>
            <button
              type="button"
              onClick={() => setCurrentPly((p) => Math.max(0, p - 1))}
              className="rounded-full border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 shadow-sm transition-colors hover:bg-gray-50"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => setCurrentPly((p) => Math.min(moves.length, p + 1))}
              className="rounded-full border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 shadow-sm transition-colors hover:bg-gray-50"
            >
              ›
            </button>
            <button
              type="button"
              onClick={() => setCurrentPly(moves.length)}
              className="rounded-full border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 shadow-sm transition-colors hover:bg-gray-50"
            >
              ›|
            </button>
            <div className="ml-2 text-sm text-gray-400">
              {currentPly === 0 ? "Start" : `${Math.ceil((currentMove?.ply ?? 0) / 2)}${currentMove?.side_to_move === "black" ? "..." : "."} ${currentMove?.san ?? ""}`}
            </div>
            <div className="ml-auto text-xs text-gray-300">
              ← → Home End
            </div>
          </div>

          <CurrentMoveCard move={currentMove} analysis={currentAnalysis} />

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="text-xs uppercase tracking-wide text-gray-400">Moves</div>
              <div className="mt-1 text-xl font-semibold text-gray-900">{Math.ceil(game.total_plies / 2)}</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="text-xs uppercase tracking-wide text-gray-400">Blunders</div>
              <div className="mt-1 text-xl font-semibold text-rose-600">{blunders.length}</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="text-xs uppercase tracking-wide text-gray-400">Mistakes</div>
              <div className="mt-1 text-xl font-semibold text-amber-600">{mistakes.length}</div>
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-gray-400">Key errors</div>
            <ErrorJumpList title="Blunders" tone="rose" entries={blunders} movesByPly={movesByPly} onSelect={setCurrentPly} />
            <ErrorJumpList title="Mistakes" tone="amber" entries={mistakes} movesByPly={movesByPly} onSelect={setCurrentPly} />
          </div>
        </section>

        <aside className="space-y-4">
          <MoveList moves={moves} analysisByPly={analysisByPly} currentPly={currentPly} onSelect={setCurrentPly} />
        </aside>
      </div>
    </main>
  );
}
