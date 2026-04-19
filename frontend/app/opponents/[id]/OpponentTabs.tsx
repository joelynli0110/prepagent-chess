"use client";

import { useState } from "react";
import { Game, OpeningStat } from "@/lib/types";
import { OpeningsAndGames } from "./OpeningsAndGames";
import { ReportSection } from "./ReportSection";
import { FileTextIcon, SparkIcon } from "./Icons";

type TabKey = "games" | "reports";

export function OpponentTabs({
  openings,
  games,
  opponentId,
}: {
  openings: OpeningStat[];
  games: Game[];
  opponentId: string;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("games");

  return (
    <section className="space-y-4">
      <div className="inline-flex rounded-full border border-stone-200 bg-[var(--surface)] p-1 shadow-[var(--shadow)]">
        <button
          type="button"
          onClick={() => setActiveTab("games")}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors ${
            activeTab === "games" ? "bg-[var(--accent)] text-white" : "text-[var(--foreground-soft)] hover:text-[var(--foreground)]"
          }`}
        >
          <FileTextIcon className="h-4 w-4" />
          Games
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("reports")}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors ${
            activeTab === "reports" ? "bg-[var(--accent)] text-white" : "text-[var(--foreground-soft)] hover:text-[var(--foreground)]"
          }`}
        >
          <SparkIcon className="h-4 w-4" />
          Reports
        </button>
      </div>

      {activeTab === "games" ? (
        <OpeningsAndGames openings={openings} games={games} opponentId={opponentId} />
      ) : (
        <div id="reports-section">
          <ReportSection opponentId={opponentId} />
        </div>
      )}
    </section>
  );
}
