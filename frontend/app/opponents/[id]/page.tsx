import Link from "next/link";
import { apiGet, apiPost } from "@/lib/api";
import {
  BlunderSummary,
  Game,
  OpeningStat,
  OpponentSpace,
} from "@/lib/types";

async function analyzeOpponent(opponentId: string) {
  "use server";

  await apiPost(`/opponents/${opponentId}/analyze`, {
    depth: 10,
    max_games: 20,
    max_plies: 40,
    only_missing: true,
  });
}

export default async function OpponentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [opponent, openings, blunders, games] = await Promise.all([
    apiGet<OpponentSpace>(`/opponents/${id}`),
    apiGet<OpeningStat[]>(`/opponents/${id}/openings`).catch(() => []),
    apiGet<BlunderSummary[]>(`/opponents/${id}/blunders`).catch(() => []),
    apiGet<Game[]>(`/opponents/${id}/games`).catch(() => []),
  ]);

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-8">
      <section className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{opponent.display_name}</h1>
          <p className="text-sm text-gray-500">
            canonical: {opponent.canonical_name}
          </p>
          {opponent.notes ? (
            <p className="mt-2 text-sm text-gray-700">{opponent.notes}</p>
          ) : null}
        </div>

        <form action={analyzeOpponent.bind(null, id)}>
          <button
            type="submit"
            className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50"
          >
            Analyze opponent
          </button>
        </form>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
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

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Top Openings</h2>
        <div className="overflow-hidden rounded-2xl border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left">Opening</th>
                <th className="p-3 text-left">ECO</th>
                <th className="p-3 text-left">Color</th>
                <th className="p-3 text-left">Games</th>
                <th className="p-3 text-left">W-D-L</th>
                <th className="p-3 text-left">Avg CPL</th>
                <th className="p-3 text-left">Blunder Rate</th>
              </tr>
            </thead>
            <tbody>
              {openings.length === 0 ? (
                <tr className="border-t">
                  <td className="p-3 text-gray-500" colSpan={7}>
                    No opening stats yet.
                  </td>
                </tr>
              ) : (
                openings.slice(0, 12).map((row, idx) => (
                  <tr key={`${row.opening_name}-${row.color}-${idx}`} className="border-t">
                    <td className="p-3">{row.opening_name ?? "Unknown"}</td>
                    <td className="p-3">{row.eco ?? "-"}</td>
                    <td className="p-3">{row.color}</td>
                    <td className="p-3">{row.games_count}</td>
                    <td className="p-3">
                      {row.wins}-{row.draws}-{row.losses}
                    </td>
                    <td className="p-3">{row.avg_centipawn_loss ?? "-"}</td>
                    <td className="p-3">{row.blunder_rate}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Blunder Patterns</h2>
        <div className="overflow-hidden rounded-2xl border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left">Opening</th>
                <th className="p-3 text-left">Phase</th>
                <th className="p-3 text-left">Side</th>
                <th className="p-3 text-left">Count</th>
                <th className="p-3 text-left">Games</th>
                <th className="p-3 text-left">Sample</th>
              </tr>
            </thead>
            <tbody>
              {blunders.length === 0 ? (
                <tr className="border-t">
                  <td className="p-3 text-gray-500" colSpan={6}>
                    No blunder patterns yet.
                  </td>
                </tr>
              ) : (
                blunders.slice(0, 12).map((row, idx) => (
                  <tr key={`${row.opening_name}-${row.phase}-${idx}`} className="border-t">
                    <td className="p-3">{row.opening_name ?? "Unknown"}</td>
                    <td className="p-3">{row.phase ?? "-"}</td>
                    <td className="p-3">{row.side ?? "-"}</td>
                    <td className="p-3">{row.blunder_count}</td>
                    <td className="p-3">{row.game_count}</td>
                    <td className="p-3">
                      {row.sample_game_id ? (
                        <Link
                          href={`/opponents/${id}/games/${row.sample_game_id}`}
                          className="underline"
                        >
                          ply {row.sample_ply}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Games</h2>
        <div className="space-y-2">
          {games.length === 0 ? (
            <div className="rounded-2xl border p-4 text-sm text-gray-500">
              No games yet. Import a PGN from the backend first.
            </div>
          ) : (
            games.slice(0, 25).map((game) => (
              <Link
                key={game.id}
                href={`/opponents/${id}/games/${game.id}`}
                className="block rounded-xl border p-4 hover:bg-gray-50"
              >
                <div className="font-medium">
                  {game.white_name} vs {game.black_name}
                </div>
                <div className="mt-1 text-sm text-gray-500">
                  {game.opening_name ?? "Unknown opening"} · {game.result}
                  {game.date_played ? ` · ${game.date_played}` : ""}
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </main>
  );
}