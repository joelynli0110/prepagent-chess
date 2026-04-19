import { apiGet } from "@/lib/api";
import { EngineAnalysis, Game, MoveFact } from "@/lib/types";
import { GameReplay } from "./GameReplay";

export default async function GameDetailPage({
  params,
}: {
  params: Promise<{ id: string; gameId: string }>;
}) {
  const { id, gameId } = await params;

  const [game, moves] = await Promise.all([
    apiGet<Game>(`/games/${gameId}`),
    apiGet<MoveFact[]>(`/games/${gameId}/moves`).catch(() => []),
  ]);

  const analysis = await apiGet<EngineAnalysis[]>(`/games/${gameId}/analysis`).catch(() => []);

  return (
    <GameReplay opponentId={id} game={game} moves={moves} analysis={analysis} />
  );
}
