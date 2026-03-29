import Link from "next/link";
import { redirect } from "next/navigation";
import { apiGet } from "@/lib/api";
import { EngineAnalysis, Game, MoveFact } from "@/lib/types";

async function analyzeGame(gameId: string, opponentId: string) {
  "use server";
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";
  const res = await fetch(`${API_BASE}/games/${gameId}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ depth: 10, max_plies: 40 }),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Analyze game failed: ${res.status} ${text}`);
  }
  redirect(`/opponents/${opponentId}/games/${gameId}`);
}

type Classification = string | null | undefined;

function ClassBadge({ cls }: { cls: Classification }) {
  if (!cls) return <span className="text-gray-300">—</span>;
  const styles: Record<string, string> = {
    blunder:    "bg-rose-50 text-rose-700 border-rose-100",
    mistake:    "bg-amber-50 text-amber-700 border-amber-100",
    inaccuracy: "bg-yellow-50 text-yellow-700 border-yellow-100",
    good:       "bg-emerald-50 text-emerald-700 border-emerald-100",
    excellent:  "bg-emerald-50 text-emerald-700 border-emerald-100",
    book:       "bg-gray-50 text-gray-500 border-gray-200",
  };
  const style = styles[cls] ?? "bg-gray-50 text-gray-500 border-gray-200";
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${style}`}>
      {cls.charAt(0).toUpperCase() + cls.slice(1)}
    </span>
  );
}

function cplColor(cpl: number | null | undefined) {
  if (cpl == null) return "text-gray-400";
  if (cpl >= 200) return "text-rose-600 font-semibold";
  if (cpl >= 100) return "text-amber-600 font-medium";
  if (cpl >= 50)  return "text-yellow-600";
  return "text-gray-600";
}

function formatEvalDelta(before: number | null | undefined, after: number | null | undefined) {
  if (before == null || after == null) return null;
  const delta = (after - before) / 100;
  const abs = Math.abs(delta).toFixed(1);
  if (abs === "0.0") return { text: "0.0", colorClass: "text-gray-400" };
  return { text: `${delta > 0 ? "↑" : "↓"} ${abs}`, colorClass: delta > 0 ? "text-emerald-600" : "text-rose-600" };
}

function StatCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</div>
      <div className="mt-1.5 text-xl font-semibold text-gray-900">{children}</div>
    </div>
  );
}

export default async function GameDetailPage({
  params,
}: {
  params: Promise<{ id: string; gameId: string }>;
}) {
  const { id, gameId } = await params;

  const [game, moves, analysis] = await Promise.all([
    apiGet<Game>(`/games/${gameId}`),
    apiGet<MoveFact[]>(`/games/${gameId}/moves`).catch(() => []),
    apiGet<EngineAnalysis[]>(`/games/${gameId}/analysis`).catch(() => []),
  ]);

  const analysisByPly = new Map(analysis.map((row) => [row.ply, row]));
  const blunderCount = analysis.filter((a) => a.classification === "blunder").length;
  const mistakeCount = analysis.filter((a) => a.classification === "mistake").length;

  const resultLabel =
    game.result === "1-0" ? "1–0" :
    game.result === "0-1" ? "0–1" :
    game.result === "1/2-1/2" ? "½–½" : game.result;

  const resultColor =
    game.result === "1-0" ? "text-emerald-700" :
    game.result === "0-1" ? "text-rose-600" :
    "text-gray-500";

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 space-y-8">
      <Link href={`/opponents/${id}`} className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 transition-colors">
        ← Back to opponent
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {game.white_name} vs {game.black_name}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {game.opening_name ?? "Unknown opening"}
            {game.date_played ? ` · ${game.date_played}` : ""}
          </p>
        </div>
        <form action={analyzeGame.bind(null, gameId, id)}>
          <button type="submit" className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            {analysis.length > 0 ? "Re-analyze" : "Analyze game"}
          </button>
        </form>
      </div>

      {/* Stat cards */}
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        <StatCard label="Result">
          <span className={resultColor}>{resultLabel}</span>
        </StatCard>
        <StatCard label="Opening">
          <span className="truncate text-sm" title={game.opening_name ?? "-"}>
            {game.eco ? <span className="font-mono text-gray-500 mr-2 text-base">{game.eco}</span> : null}
            {game.opening_name ?? "—"}
          </span>
        </StatCard>
        <StatCard label="Moves">{Math.ceil(game.total_plies / 2)}</StatCard>
        <StatCard label="Blunders / Mistakes">
          <span className="text-rose-600">{blunderCount}</span>
          <span className="text-gray-300 text-base font-normal mx-1">/</span>
          <span className="text-amber-600">{mistakeCount}</span>
        </StatCard>
      </div>

      {/* Moves table */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Moves</h2>

        {moves.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-400 text-center">
            No moves found for this game.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide w-14">#</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Move</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Phase</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Eval Δ</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">CPL</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Quality</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Best move</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {moves.map((move) => {
                  const a = analysisByPly.get(move.ply);
                  const isBlunder = a?.classification === "blunder";
                  const isMistake = a?.classification === "mistake";
                  const rowBg = isBlunder ? "bg-rose-50/40" : isMistake ? "bg-amber-50/30" : "";

                  return (
                    <tr key={move.id} className={`${rowBg} hover:bg-gray-50/60 transition-colors`}>
                      <td className="px-4 py-3 text-xs text-gray-400 tabular-nums">
                        {move.side_to_move === "white" ? `${move.fullmove_number}.` : `${move.fullmove_number}…`}
                      </td>
                      <td className="px-4 py-3 font-medium font-mono text-gray-900">{move.san}</td>
                      <td className="px-4 py-3 capitalize text-xs text-gray-400">{move.phase}</td>
                      <td className="px-4 py-3 tabular-nums">
                        {(() => {
                          const delta = a ? formatEvalDelta(a.eval_before_cp, a.eval_after_cp) : null;
                          return delta ? (
                            <span className={`text-xs font-medium ${delta.colorClass}`}>{delta.text}</span>
                          ) : <span className="text-gray-300">—</span>;
                        })()}
                      </td>
                      <td className={`px-4 py-3 tabular-nums text-xs ${cplColor(a?.centipawn_loss)}`}>
                        {a?.centipawn_loss != null ? a.centipawn_loss : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <ClassBadge cls={a?.classification} />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">
                        {a?.best_move_san ?? a?.best_move_uci ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
