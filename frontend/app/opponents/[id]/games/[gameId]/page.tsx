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
    body: JSON.stringify({
      depth: 10,
      max_plies: 40,
    }),
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
  if (!cls) return <span className="text-gray-400">—</span>;

  const styles: Record<string, string> = {
    blunder: "bg-red-100 text-red-700 border-red-200",
    mistake: "bg-orange-100 text-orange-700 border-orange-200",
    inaccuracy: "bg-yellow-100 text-yellow-700 border-yellow-200",
    good: "bg-green-100 text-green-700 border-green-200",
    excellent: "bg-emerald-100 text-emerald-700 border-emerald-200",
    book: "bg-gray-100 text-gray-600 border-gray-200",
  };

  const style = styles[cls] ?? "bg-gray-100 text-gray-600 border-gray-200";
  const label = cls.charAt(0).toUpperCase() + cls.slice(1);

  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${style}`}>
      {label}
    </span>
  );
}

function cplColor(cpl: number | null | undefined) {
  if (cpl == null) return "text-gray-400";
  if (cpl >= 200) return "text-red-600 font-semibold";
  if (cpl >= 100) return "text-orange-600 font-medium";
  if (cpl >= 50) return "text-yellow-600";
  return "text-gray-700";
}

function formatEvalDelta(before: number | null | undefined, after: number | null | undefined) {
  if (before == null || after == null) return null;
  const delta = (after - before) / 100;
  const abs = Math.abs(delta).toFixed(1);
  if (abs === "0.0") return { text: "0.0", colorClass: "text-gray-400" };
  const arrow = delta > 0 ? "↑" : "↓";
  const colorClass = delta > 0 ? "text-green-600" : "text-red-600";
  return { text: `${arrow} ${abs}`, colorClass };
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

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-6">
      {/* Back nav */}
      <Link
        href={`/opponents/${id}`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
      >
        ← Back to opponent
      </Link>

      {/* Header */}
      <section className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            {game.white_name} vs {game.black_name}
          </h1>
          <p className="text-sm text-gray-500">
            {game.opening_name ?? "Unknown opening"} · {game.result}
            {game.date_played ? ` · ${game.date_played}` : ""}
          </p>
        </div>

        <form action={analyzeGame.bind(null, gameId, id)}>
          <button
            type="submit"
            className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50"
          >
            {analysis.length > 0 ? "Re-analyze" : "Analyze game"}
          </button>
        </form>
      </section>

      {/* Stat cards */}
      <section className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        <div className="rounded-2xl border p-4">
          <div className="text-sm text-gray-500">Result</div>
          <div className="mt-1 text-xl font-semibold">{game.result}</div>
        </div>
        <div className="rounded-2xl border p-4">
          <div className="text-sm text-gray-500">Opening</div>
          <div className="mt-1 text-xl font-semibold truncate" title={game.opening_name ?? "-"}>
            {game.opening_name ?? "-"}
          </div>
        </div>
        <div className="rounded-2xl border p-4">
          <div className="text-sm text-gray-500">Plies</div>
          <div className="mt-1 text-xl font-semibold">{game.total_plies}</div>
        </div>
        <div className="rounded-2xl border p-4">
          <div className="text-sm text-gray-500">Blunders / Mistakes</div>
          <div className="mt-1 text-xl font-semibold">
            <span className="text-red-600">{blunderCount}</span>
            <span className="text-gray-400 text-base font-normal"> / </span>
            <span className="text-orange-500">{mistakeCount}</span>
          </div>
        </div>
      </section>

      {/* Moves table */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Moves</h2>

        {moves.length === 0 ? (
          <div className="rounded-2xl border p-6 text-sm text-gray-500">
            No moves found for this game.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="p-3 text-left">Move</th>
                  <th className="p-3 text-left">SAN</th>
                  <th className="p-3 text-left">Phase</th>
                  <th className="p-3 text-left">Eval</th>
                  <th className="p-3 text-left">CPL</th>
                  <th className="p-3 text-left">Classification</th>
                  <th className="p-3 text-left">Best move</th>
                </tr>
              </thead>
              <tbody>
                {moves.map((move) => {
                  const a = analysisByPly.get(move.ply);
                  const isBad =
                    a?.classification === "blunder" || a?.classification === "mistake";

                  const moveLabel =
                    move.side_to_move === "white"
                      ? `${move.fullmove_number}.`
                      : `${move.fullmove_number}…`;

                  return (
                    <tr
                      key={move.id}
                      className={`border-t ${
                        isBad
                          ? a?.classification === "blunder"
                            ? "bg-red-50"
                            : "bg-orange-50"
                          : ""
                      }`}
                    >
                      <td className="p-3 text-gray-400 tabular-nums">{moveLabel}</td>
                      <td className="p-3 font-medium font-mono">{move.san}</td>
                      <td className="p-3 capitalize text-gray-500">{move.phase}</td>
                      <td className="p-3 tabular-nums">
                        {(() => {
                          const delta = a ? formatEvalDelta(a.eval_before_cp, a.eval_after_cp) : null;
                          return delta ? (
                            <span className={`font-medium ${delta.colorClass}`}>{delta.text}</span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          );
                        })()}
                      </td>
                      <td className={`p-3 tabular-nums ${cplColor(a?.centipawn_loss)}`}>
                        {a?.centipawn_loss != null ? a.centipawn_loss : "—"}
                      </td>
                      <td className="p-3">
                        <ClassBadge cls={a?.classification} />
                      </td>
                      <td className="p-3 font-mono text-gray-600">
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
