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
      <div className="inline-flex rounded-full border border-gray-200 bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setActiveTab("games")}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors ${
            activeTab === "games" ? "bg-gray-900 text-white" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <FileTextIcon className="h-4 w-4" />
          Games
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("reports")}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors ${
            activeTab === "reports" ? "bg-gray-900 text-white" : "text-gray-500 hover:text-gray-700"
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
