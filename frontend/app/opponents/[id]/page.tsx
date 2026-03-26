import Link from "next/link";
import { apiGet } from "@/lib/api";
import {
  BlunderSummary,
  Game,
  OpeningStat,
  OpponentSpace,
} from "@/lib/types";
import { AnalyzeButton } from "./AnalyzeButton";
import { ChessbaseFetchForm } from "./ChessbaseFetchForm";
import { DeleteOpponentButton } from "./DeleteOpponentButton";
import { PlatformImportForm } from "./PlatformImportForm";
import { UploadPgnForm } from "./UploadPgnForm";

function winRate(row: OpeningStat) {
  if (!row.games_count) return null;
  return Math.round((row.wins / row.games_count) * 100);
}

export default async function OpponentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string; message?: string }>;
}) {
  const { id } = await params;
  const { status, message } = await searchParams;

  const [opponent, openings, blunders, games] = await Promise.all([
    apiGet<OpponentSpace>(`/opponents/${id}`),
    apiGet<OpeningStat[]>(`/opponents/${id}/openings`).catch(() => []),
    apiGet<BlunderSummary[]>(`/opponents/${id}/blunders`).catch(() => []),
    apiGet<Game[]>(`/opponents/${id}/games`).catch(() => []),
  ]);

  const analyzedGames = games.filter((g) => g.total_plies > 0);

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-8">
      {/* Back nav */}
      <Link
        href="/opponents"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
      >
        ← All opponents
      </Link>

      {/* Status banner */}
      {message ? (
        <div
          className={`rounded-2xl border p-4 text-sm ${
            status === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {message}
        </div>
      ) : null}

      {/* Header */}
      <section className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{opponent.display_name}</h1>
        </div>

        <div className="flex items-center gap-2">
          <AnalyzeButton opponentId={id} />
          <DeleteOpponentButton opponentId={id} opponentName={opponent.display_name} />
        </div>
      </section>

      {/* Stat cards */}
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border p-4">
          <div className="text-sm text-gray-500">Games</div>
          <div className="mt-1 text-2xl font-semibold">{games.length}</div>
        </div>
        <div className="rounded-2xl border p-4">
          <div className="text-sm text-gray-500">Opening buckets</div>
          <div className="mt-1 text-2xl font-semibold">{openings.length}</div>
        </div>
        <div className="rounded-2xl border p-4">
          <div className="text-sm text-gray-500">Blunder patterns</div>
          <div className="mt-1 text-2xl font-semibold">{blunders.length}</div>
        </div>
      </section>

      {/* Import */}
      <div className="grid gap-4 md:grid-cols-2">
        <UploadPgnForm opponentId={id} />
        <ChessbaseFetchForm opponentId={id} />
      </div>
      <PlatformImportForm opponentId={id} />

      {/* Top Openings */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Top Openings</h2>
        <div className="overflow-hidden rounded-2xl border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="p-3 text-left">Opening</th>
                <th className="p-3 text-left">Games</th>
                <th className="p-3 text-left">W-D-L</th>
                <th className="p-3 text-left">Win %</th>
                <th className="p-3 text-left">Avg CPL</th>
                <th className="p-3 text-left">Blunder rate</th>
              </tr>
            </thead>
            <tbody>
              {openings.length === 0 ? (
                <tr className="border-t">
                  <td className="p-3 text-gray-400" colSpan={6}>
                    No opening stats yet. Upload PGNs and run analysis.
                  </td>
                </tr>
              ) : (
                openings.slice(0, 12).map((row, idx) => {
                  const wr = winRate(row);
                  const fullName = row.opening_name ?? "";
                  const colonIdx = fullName.indexOf(":");
                  const openingMain = colonIdx >= 0 ? fullName.slice(0, colonIdx).trim() : fullName;
                  const variation = colonIdx >= 0 ? fullName.slice(colonIdx + 1).trim() : null;

                  return (
                    <tr
                      key={`${row.opening_name}-${row.color}-${idx}`}
                      className="border-t hover:bg-gray-50"
                    >
                      <td className="p-3 max-w-xs">
                        <div className="flex items-start gap-2">
                          {row.eco && (
                            <span className="mt-0.5 shrink-0 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-500">
                              {row.eco}
                            </span>
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">
                                {openingMain || "Unknown"}
                              </span>
                              <span
                                className={`inline-block h-2 w-2 rounded-full ${
                                  row.color === "white" ? "bg-gray-200 ring-1 ring-gray-400" : "bg-gray-800"
                                }`}
                                title={row.color}
                              />
                            </div>
                            {variation && (
                              <div className="mt-0.5 text-xs text-gray-400">{variation}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-3 tabular-nums">{row.games_count}</td>
                      <td className="p-3 tabular-nums">
                        <span className="text-green-600">{row.wins}</span>
                        <span className="text-gray-300 mx-0.5">/</span>
                        <span className="text-gray-500">{row.draws}</span>
                        <span className="text-gray-300 mx-0.5">/</span>
                        <span className="text-red-500">{row.losses}</span>
                      </td>
                      <td className="p-3 tabular-nums">
                        {wr != null ? (
                          <span
                            className={
                              wr >= 60
                                ? "text-green-600 font-medium"
                                : wr <= 35
                                  ? "text-red-600"
                                  : "text-gray-700"
                            }
                          >
                            {wr}%
                          </span>
                        ) : "—"}
                      </td>
                      <td className="p-3 tabular-nums text-gray-600">
                        {row.avg_centipawn_loss != null ? row.avg_centipawn_loss : "—"}
                      </td>
                      <td className="p-3 tabular-nums text-gray-600">
                        {(row.blunder_rate * 100).toFixed(1)}%
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Blunder Patterns */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Blunder Patterns</h2>
        <div className="overflow-hidden rounded-2xl border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="p-3 text-left">Opening</th>
                <th className="p-3 text-left">Phase</th>
                <th className="p-3 text-left">Count</th>
                <th className="p-3 text-left">Games</th>
                <th className="p-3 text-left">Sample</th>
              </tr>
            </thead>
            <tbody>
              {blunders.length === 0 ? (
                <tr className="border-t">
                  <td className="p-3 text-gray-400" colSpan={5}>
                    No blunder patterns yet.
                  </td>
                </tr>
              ) : (
                blunders.slice(0, 12).map((row, idx) => {
                  const fullName = row.opening_name ?? "";
                  const colonIdx = fullName.indexOf(":");
                  const openingMain = colonIdx >= 0 ? fullName.slice(0, colonIdx).trim() : fullName;
                  const variation = colonIdx >= 0 ? fullName.slice(colonIdx + 1).trim() : null;

                  return (
                    <tr
                      key={`${row.opening_name}-${row.phase}-${idx}`}
                      className="border-t hover:bg-gray-50"
                    >
                      <td className="p-3 max-w-xs">
                        <div className="flex items-start gap-2">
                          {row.eco && (
                            <span className="mt-0.5 shrink-0 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-500">
                              {row.eco}
                            </span>
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">
                                {openingMain || "Unknown"}
                              </span>
                              {row.side && (
                                <span
                                  className={`inline-block h-2 w-2 rounded-full ${
                                    row.side === "white" ? "bg-gray-200 ring-1 ring-gray-400" : "bg-gray-800"
                                  }`}
                                  title={row.side}
                                />
                              )}
                            </div>
                            {variation && (
                              <div className="mt-0.5 text-xs text-gray-400">{variation}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-3 capitalize text-gray-500">{row.phase ?? "—"}</td>
                      <td className="p-3 tabular-nums font-medium text-red-600">
                        {row.blunder_count}
                      </td>
                      <td className="p-3 tabular-nums">{row.game_count}</td>
                      <td className="p-3">
                        {row.sample_game_id ? (
                          <Link
                            href={`/opponents/${id}/games/${row.sample_game_id}`}
                            className="text-blue-600 underline hover:text-blue-800"
                          >
                            ply {row.sample_ply}
                          </Link>
                        ) : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Games list */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">
          Games{" "}
          {analyzedGames.length > 0 && analyzedGames.length < games.length && (
            <span className="text-sm font-normal text-gray-400">
              ({analyzedGames.length} analyzed)
            </span>
          )}
        </h2>
        <div className="space-y-2">
          {games.length === 0 ? (
            <div className="rounded-2xl border p-6 text-sm text-gray-500">
              No games yet. Upload a PGN above.
            </div>
          ) : (
            games.slice(0, 25).map((game) => (
              <Link
                key={game.id}
                href={`/opponents/${id}/games/${game.id}`}
                className="flex items-center justify-between rounded-xl border p-4 hover:bg-gray-50"
              >
                <div>
                  <div className="font-medium">
                    {game.white_name} vs {game.black_name}
                  </div>
                  <div className="mt-0.5 text-sm text-gray-500">
                    {game.opening_name ?? "Unknown opening"}
                    {game.date_played ? ` · ${game.date_played}` : ""}
                  </div>
                </div>
                <div className="ml-4 shrink-0 text-sm font-medium">
                  <span
                    className={
                      game.result === "1-0"
                        ? "text-green-700"
                        : game.result === "0-1"
                          ? "text-red-600"
                          : "text-gray-500"
                    }
                  >
                    {game.result}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
