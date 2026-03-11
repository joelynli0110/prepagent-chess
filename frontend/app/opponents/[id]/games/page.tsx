import { apiGet, apiPost } from "@/lib/api";
import { EngineAnalysis, Game, MoveFact } from "@/lib/types";

async function analyzeGame(gameId: string) {
  "use server";

  await apiPost(`/games/${gameId}/analyze`, {
    depth: 10,
    max_plies: 40,
  });
}

export default async function GameDetailPage({
  params,
}: {
  params: Promise<{ id: string; gameId: string }>;
}) {
  const { gameId } = await params;

  const [game, moves, analysis] = await Promise.all([
    apiGet<Game>(`/games/${gameId}`),
    apiGet<MoveFact[]>(`/games/${gameId}/moves`).catch(() => []),
    apiGet<EngineAnalysis[]>(`/games/${gameId}/analysis`).catch(() => []),
  ]);

  const analysisByPly = new Map(analysis.map((row) => [row.ply, row]));

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-6">
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

        <form action={analyzeGame.bind(null, gameId)}>
          <button
            type="submit"
            className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50"
          >
            Analyze game
          </button>
        </form>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border p-4">
          <div className="text-sm text-gray-500">Result</div>
          <div className="mt-1 text-xl font-semibold">{game.result}</div>
        </div>
        <div className="rounded-2xl border p-4">
          <div className="text-sm text-gray-500">Opening</div>
          <div className="mt-1 text-xl font-semibold">
            {game.opening_name ?? "-"}
          </div>
        </div>
        <div className="rounded-2xl border p-4">
          <div className="text-sm text-gray-500">Plies</div>
          <div className="mt-1 text-xl font-semibold">{game.total_plies}</div>
        </div>
        <div className="rounded-2xl border p-4">
          <div className="text-sm text-gray-500">Analyzed rows</div>
          <div className="mt-1 text-xl font-semibold">{analysis.length}</div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Moves</h2>
        <div className="overflow-hidden rounded-2xl border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left">Ply</th>
                <th className="p-3 text-left">Move</th>
                <th className="p-3 text-left">Side</th>
                <th className="p-3 text-left">Phase</th>
                <th className="p-3 text-left">CPL</th>
                <th className="p-3 text-left">Class</th>
                <th className="p-3 text-left">Best Move</th>
              </tr>
            </thead>
            <tbody>
              {moves.length === 0 ? (
                <tr className="border-t">
                  <td className="p-3 text-gray-500" colSpan={7}>
                    No moves found.
                  </td>
                </tr>
              ) : (
                moves.map((move) => {
                  const a = analysisByPly.get(move.ply);
                  const isBad =
                    a?.classification === "mistake" ||
                    a?.classification === "blunder";

                  return (
                    <tr
                      key={move.id}
                      className={`border-t ${isBad ? "bg-red-50" : ""}`}
                    >
                      <td className="p-3">{move.ply}</td>
                      <td className="p-3 font-medium">{move.san}</td>
                      <td className="p-3">{move.side_to_move}</td>
                      <td className="p-3">{move.phase}</td>
                      <td className="p-3">{a?.centipawn_loss ?? "-"}</td>
                      <td className="p-3">{a?.classification ?? "-"}</td>
                      <td className="p-3">{a?.best_move_uci ?? "-"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}