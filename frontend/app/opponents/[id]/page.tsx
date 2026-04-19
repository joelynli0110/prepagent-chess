import Link from "next/link";
import { apiGet } from "@/lib/api";
import { Game, OpeningStat, OpponentSpace } from "@/lib/types";
import { T } from "@/components/T";
import { DeleteOpponentButton } from "./DeleteOpponentButton";
import { ImportSection } from "./ImportSection";
import { OpeningsAndGames } from "./OpeningsAndGames";
import { PlayerProfileCard } from "./PlayerProfileCard";
import { ReportSection } from "./ReportSection";

function Section({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      {children}
    </section>
  );
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

  const [opponent, openings, games] = await Promise.all([
    apiGet<OpponentSpace>(`/opponents/${id}`),
    apiGet<OpeningStat[]>(`/opponents/${id}/openings`).catch(() => []),
    apiGet<Game[]>(`/opponents/${id}/games`).catch(() => []),
  ]);

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">
      <Link
        href="/opponents"
        className="inline-flex items-center gap-1 text-sm text-gray-400 transition-colors hover:text-gray-700"
      >
        <T k="all_opponents" />
      </Link>

      {message && (
        <div
          className={`rounded-xl border p-4 text-sm ${
            status === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {message}
        </div>
      )}

      <h1 className="text-2xl font-semibold text-gray-900">{opponent.display_name}</h1>

      <PlayerProfileCard profile={opponent.profile_data} />

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-gray-400">
            <T k="games" />
          </div>
          <div className="mt-1.5 text-2xl font-semibold text-gray-900">{games.length}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-gray-400">
            <T k="openings" />
          </div>
          <div className="mt-1.5 text-2xl font-semibold text-gray-900">{openings.length}</div>
        </div>
      </div>

      <Section title={<T k="import_games" />}>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <ImportSection opponentId={id} />
        </div>
      </Section>

      <OpeningsAndGames openings={openings} games={games} opponentId={id} />

      <ReportSection opponentId={id} />

      <div className="border-t border-gray-100 pt-6">
        <DeleteOpponentButton opponentId={id} opponentName={opponent.display_name} />
      </div>
    </main>
  );
}
