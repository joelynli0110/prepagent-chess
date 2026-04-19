import Link from "next/link";
import { Game, OpeningStat, Report } from "@/lib/types";
import { FileTextIcon, SparkIcon, UploadIcon } from "./Icons";

function openingLabel(opening: OpeningStat | null): string {
  if (!opening) return "No clear target yet";
  return opening.opening_name ?? opening.eco ?? "Unknown opening";
}

function openingWinPct(opening: OpeningStat | null): number | null {
  if (!opening || opening.games_count === 0) return null;
  return Math.round(((opening.wins + opening.draws * 0.5) / opening.games_count) * 100);
}

function pickTargetOpening(openings: OpeningStat[]): OpeningStat | null {
  const candidates = openings.filter((opening) => opening.games_count >= 3);
  if (candidates.length === 0) return null;

  return [...candidates].sort((a, b) => {
    const aWinPct = a.games_count ? (a.wins + a.draws * 0.5) / a.games_count : 1;
    const bWinPct = b.games_count ? (b.wins + b.draws * 0.5) / b.games_count : 1;
    if (aWinPct !== bWinPct) return aWinPct - bWinPct;
    return b.games_count - a.games_count;
  })[0];
}

function confidenceText(openings: OpeningStat[], games: Game[]): string {
  if (games.length === 0) return "No game history yet.";
  return `${games.length} games · ${openings.length} openings`;
}

function actionConfig(games: Game[], latestReport: Report | null): { href: string; label: string } {
  if (games.length === 0) {
    return { href: "#import-section", label: "Upload PGN" };
  }

  if (latestReport?.status === "ready") {
    return {
      href: `/opponents/${latestReport.opponent_space_id}/reports/${latestReport.id}`,
      label: "Open report",
    };
  }

  return { href: "#reports-section", label: "Generate plan" };
}

export function PrepSnapshotCard({
  openings,
  games,
  latestReport,
}: {
  openings: OpeningStat[];
  games: Game[];
  latestReport: Report | null;
}) {
  const target = pickTargetOpening(openings);
  const winPct = openingWinPct(target);
  const action = actionConfig(games, latestReport);

  return (
    <section className="rounded-[30px] border border-stone-200/80 bg-[var(--surface)] p-6 shadow-[var(--shadow)]">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--foreground-muted)]">
            <SparkIcon className="h-4 w-4" />
            Prep Snapshot
          </div>
          <div className="space-y-1">
            <h2 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">{openingLabel(target)}</h2>
            <p className="text-sm text-[var(--foreground-soft)]">
              {target
                ? `Target this first. Opponent scores ${winPct}% over ${target.games_count} games.`
                : "Not enough opening history for a reliable target yet."}
            </p>
          </div>
          <p className="text-sm text-[var(--foreground-muted)]">{confidenceText(openings, games)}</p>
        </div>

        <div className="flex min-w-[240px] flex-col gap-3 rounded-2xl border border-stone-200 bg-[var(--surface-strong)] p-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--foreground-muted)]">Next</div>
            <div className="mt-1 text-sm font-medium text-[var(--foreground-soft)]">
              {games.length === 0
                ? "Bring in games to unlock prep."
                : latestReport?.status === "ready"
                ? "Latest report is ready."
                : "Turn the data into a plan."}
            </div>
          </div>
          <Link
            href={action.href}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:brightness-95"
          >
            {games.length === 0 ? <UploadIcon className="h-4 w-4" /> : <FileTextIcon className="h-4 w-4" />}
            {action.label}
          </Link>
        </div>
      </div>
    </section>
  );
}
