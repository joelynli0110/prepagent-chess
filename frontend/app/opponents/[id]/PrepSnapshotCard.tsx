import Link from "next/link";
import { Game, OpeningStat, Report } from "@/lib/types";
import { FileTextIcon, SparkIcon, UploadIcon } from "./Icons";

function openingLabel(opening: OpeningStat | null): string {
  if (!opening) return "No clear target yet";
  return opening.opening_name ?? opening.eco ?? "Unknown opening";
}

function openingWinPct(opening: OpeningStat | null): number | null {
  if (!opening || opening.games_count === 0) return null;
  return Math.round((opening.wins / opening.games_count) * 100);
}

function pickTargetOpening(openings: OpeningStat[]): OpeningStat | null {
  const candidates = openings.filter((opening) => opening.games_count >= 3);
  if (candidates.length === 0) return null;

  return [...candidates].sort((a, b) => {
    const aWinPct = a.games_count ? a.wins / a.games_count : 1;
    const bWinPct = b.games_count ? b.wins / b.games_count : 1;
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
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
            <SparkIcon className="h-4 w-4" />
            Prep Snapshot
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold text-gray-900">{openingLabel(target)}</h2>
            <p className="text-sm text-gray-500">
              {target
                ? `Target this first. Opponent scores ${winPct}% over ${target.games_count} games.`
                : "Not enough opening history for a reliable target yet."}
            </p>
          </div>
          <p className="text-sm text-gray-400">{confidenceText(openings, games)}</p>
        </div>

        <div className="flex min-w-[220px] flex-col gap-3 rounded-xl bg-gray-50 p-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-gray-400">Next</div>
            <div className="mt-1 text-sm font-medium text-gray-700">
              {games.length === 0
                ? "Bring in games to unlock prep."
                : latestReport?.status === "ready"
                ? "Latest report is ready."
                : "Turn the data into a plan."}
            </div>
          </div>
          <Link
            href={action.href}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
          >
            {games.length === 0 ? <UploadIcon className="h-4 w-4" /> : <FileTextIcon className="h-4 w-4" />}
            {action.label}
          </Link>
        </div>
      </div>
    </section>
  );
}
