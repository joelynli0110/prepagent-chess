import Link from "next/link";
import { apiGet } from "@/lib/api";
import { Game, OpeningStat, OpponentSpace, Report } from "@/lib/types";
import { ArrowLeftIcon } from "./Icons";
import { DeleteOpponentButton } from "./DeleteOpponentButton";
import { ImportSection } from "./ImportSection";
import { OpponentTabs } from "./OpponentTabs";
import { OpponentAutoRefresh } from "./OpponentAutoRefresh";
import { PlayerProfileCard } from "./PlayerProfileCard";
import { PrepSnapshotCard } from "./PrepSnapshotCard";

export default async function OpponentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string; message?: string }>;
}) {
  const { id } = await params;
  const { status, message } = await searchParams;

  const [opponent, openings, games, reports] = await Promise.all([
    apiGet<OpponentSpace>(`/opponents/${id}`),
    apiGet<OpeningStat[]>(`/opponents/${id}/openings`).catch(() => []),
    apiGet<Game[]>(`/opponents/${id}/games`).catch(() => []),
    apiGet<Report[]>(`/opponents/${id}/reports`).catch(() => []),
  ]);

  const latestReport = reports[0] ?? null;
  const shouldAutoRefresh = !opponent.profile_data?.photo_url || games.length === 0;

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <OpponentAutoRefresh opponentId={id} shouldStart={shouldAutoRefresh} />

      <div className="flex items-center justify-between gap-3 rounded-[28px] border border-stone-200/80 bg-[var(--surface)] px-5 py-4 shadow-[var(--shadow)]">
        <div className="flex items-center gap-3">
          <Link
            href="/opponents"
            title="Back"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 bg-[var(--surface-strong)] text-[var(--foreground-soft)] transition-colors hover:bg-white hover:text-[var(--foreground)]"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            <span className="sr-only">Back</span>
          </Link>
          <div className="space-y-0.5">
            <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-[var(--foreground-muted)]">Opponent</div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">{opponent.display_name}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div id="import-section">
            <ImportSection opponentId={id} />
          </div>
          <DeleteOpponentButton opponentId={id} opponentName={opponent.display_name} />
        </div>
      </div>

      {message && (
        <div
          className={`rounded-2xl border p-4 text-sm shadow-[var(--shadow)] ${
            status === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {message}
        </div>
      )}

      <PrepSnapshotCard openings={openings} games={games} latestReport={latestReport} />

      <PlayerProfileCard profile={opponent.profile_data} gamesCount={games.length} openingsCount={openings.length} />

      <OpponentTabs openings={openings} games={games} opponentId={id} />
    </main>
  );
}
