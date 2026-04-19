"use client";

import { useState } from "react";
import { Game, OpeningStat } from "@/lib/types";
import { GamesTable } from "./GamesTable";

function OpeningName({ name }: { name: string | null | undefined }) {
  const full = name ?? "";
  const colon = full.indexOf(":");
  const main = colon >= 0 ? full.slice(0, colon).trim() : full;
  const variation = colon >= 0 ? full.slice(colon + 1).trim() : null;

  return (
    <div>
      <span className="font-medium text-gray-900">{main || "Unknown"}</span>
      {variation && <div className="mt-0.5 text-xs text-gray-400">{variation}</div>}
    </div>
  );
}

function OpeningsTable({
  rows,
  filterEco,
  filterColor,
  onSelect,
}: {
  rows: OpeningStat[];
  filterEco: string | null;
  filterColor: string | null;
  onSelect: (eco: string | null | undefined, name: string | null | undefined, color: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white px-4 py-6 text-sm text-gray-400">
        No opening stats yet. Upload PGNs and run analysis.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-400">Opening</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-400">G</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-400">Win%</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((row, idx) => {
            const wr = row.games_count ? Math.round((row.wins / row.games_count) * 100) : null;
            const active = filterEco === row.eco && filterColor === row.color;

            return (
              <tr
                key={`${row.opening_name}-${row.color}-${idx}`}
                onClick={() => (row.eco ? onSelect(row.eco, row.opening_name, row.color) : undefined)}
                className={`transition-colors ${row.eco ? "cursor-pointer" : ""} ${
                  active ? "bg-gray-50" : "hover:bg-gray-50/60"
                }`}
              >
                <td className="max-w-xs px-4 py-3">
                  <div className="flex items-start gap-2">
                    {row.eco && (
                      <span
                        className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 font-mono text-xs ${
                          active ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-400"
                        }`}
                      >
                        {row.eco}
                      </span>
                    )}
                    <OpeningName name={row.opening_name} />
                  </div>
                </td>
                <td className="px-4 py-3 tabular-nums text-gray-600">{row.games_count}</td>
                <td className="px-4 py-3 tabular-nums">
                  {wr != null ? (
                    <span className={wr >= 60 ? "font-medium text-emerald-700" : wr <= 35 ? "text-rose-600" : "text-gray-600"}>
                      {wr}%
                    </span>
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function OpeningsAndGames({
  openings,
  games,
  opponentId,
}: {
  openings: OpeningStat[];
  games: Game[];
  opponentId: string;
}) {
  const [filterEco, setFilterEco] = useState<string | null>(null);
  const [filterColor, setFilterColor] = useState<string | null>(null);
  const [filterLabel, setFilterLabel] = useState<string | null>(null);

  function selectOpening(eco: string | null | undefined, name: string | null | undefined, color: string) {
    if (!eco) return;
    setFilterEco(eco);
    setFilterColor(color);
    setFilterLabel(name ?? eco);
    document.getElementById("games-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const white = openings.filter((o) => o.color === "white").slice(0, 10);
  const black = openings.filter((o) => o.color === "black").slice(0, 10);

  return (
    <>
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Top openings</h2>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full bg-gray-100 ring-1 ring-gray-400" />
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500">As White</span>
            </div>
            <OpeningsTable rows={white} filterEco={filterEco} filterColor={filterColor} onSelect={selectOpening} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full bg-gray-700" />
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500">As Black</span>
            </div>
            <OpeningsTable rows={black} filterEco={filterEco} filterColor={filterColor} onSelect={selectOpening} />
          </div>
        </div>
      </section>

      <section id="games-section" className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Games</h2>
        <GamesTable
          games={games}
          opponentId={opponentId}
          filterEco={filterEco}
          filterLabel={filterLabel}
          filterColor={filterColor}
          onClearFilter={() => {
            setFilterEco(null);
            setFilterColor(null);
            setFilterLabel(null);
          }}
        />
      </section>
    </>
  );
}
