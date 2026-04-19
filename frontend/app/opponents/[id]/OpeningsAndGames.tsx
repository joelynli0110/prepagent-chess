"use client";

import { useMemo, useState } from "react";
import { Game, OpeningStat } from "@/lib/types";
import { GamesTable } from "./GamesTable";
import { FileTextIcon } from "./Icons";

type OpeningSortKey = "games_count" | "win_pct";
type SortDir = "asc" | "desc";

function openingScorePct(row: OpeningStat): number {
  if (!row.games_count) return -1;
  return (row.wins + row.draws * 0.5) / row.games_count;
}

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
  filterName,
  filterColor,
  onSelect,
}: {
  rows: OpeningStat[];
  filterEco: string | null;
  filterName: string | null;
  filterColor: string | null;
  onSelect: (eco: string | null | undefined, name: string | null | undefined, color: string) => void;
}) {
  const [sortKey, setSortKey] = useState<OpeningSortKey>("win_pct");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(nextKey: OpeningSortKey) {
    if (sortKey === nextKey) {
      setSortDir((current) => (current === "desc" ? "asc" : "desc"));
      return;
    }
    setSortKey(nextKey);
    setSortDir("desc");
  }

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const aWinPct = openingScorePct(a);
      const bWinPct = openingScorePct(b);

      const primary =
        sortKey === "games_count"
          ? a.games_count - b.games_count
          : aWinPct - bWinPct;

      if (primary !== 0) {
        return sortDir === "desc" ? -primary : primary;
      }

      return b.games_count - a.games_count;
    });
  }, [rows, sortDir, sortKey]);

  if (rows.length === 0) {
    return <div className="rounded-2xl border border-gray-200 bg-white px-4 py-5 text-sm text-gray-400 shadow-sm">No opening data yet.</div>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-400">Opening</th>
            <th
              className="cursor-pointer px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-400 transition-colors hover:text-gray-600"
              onClick={() => handleSort("games_count")}
            >
              G
              <span className="ml-1 inline-block w-3 text-center">
                {sortKey === "games_count" ? (sortDir === "desc" ? "▼" : "▲") : "·"}
              </span>
            </th>
            <th
              className="cursor-pointer px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-400 transition-colors hover:text-gray-600"
              onClick={() => handleSort("win_pct")}
            >
              Win%
              <span className="ml-1 inline-block w-3 text-center">
                {sortKey === "win_pct" ? (sortDir === "desc" ? "▼" : "▲") : "·"}
              </span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {sortedRows.map((row, idx) => {
            const wr = row.games_count ? Math.round(openingScorePct(row) * 100) : null;
            const active = filterEco === row.eco && filterName === (row.opening_name ?? null) && filterColor === row.color;

            return (
              <tr
                key={`${row.opening_name}-${row.color}-${idx}`}
                onClick={() => (row.eco ? onSelect(row.eco, row.opening_name, row.color) : undefined)}
                className={`transition-colors ${row.eco ? "cursor-pointer" : ""} ${active ? "bg-gray-50" : "hover:bg-gray-50/60"}`}
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
                    <span className={wr >= 60 ? "font-medium text-emerald-700" : wr <= 35 ? "text-rose-600" : "text-gray-600"}>{wr}%</span>
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
  const [filterName, setFilterName] = useState<string | null>(null);
  const [filterColor, setFilterColor] = useState<string | null>(null);
  const [filterLabel, setFilterLabel] = useState<string | null>(null);

  function selectOpening(eco: string | null | undefined, name: string | null | undefined, color: string) {
    if (!eco) return;
    setFilterEco(eco);
    setFilterName(name ?? null);
    setFilterColor(color);
    setFilterLabel(name ?? eco);
    document.getElementById("games-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const white = openings.filter((o) => o.color === "white").slice(0, 10);
  const black = openings.filter((o) => o.color === "black").slice(0, 10);

  return (
    <>
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Openings</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full bg-gray-100 ring-1 ring-gray-400" />
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500">As White</span>
            </div>
            <OpeningsTable rows={white} filterEco={filterEco} filterName={filterName} filterColor={filterColor} onSelect={selectOpening} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full bg-gray-700" />
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500">As Black</span>
            </div>
            <OpeningsTable rows={black} filterEco={filterEco} filterName={filterName} filterColor={filterColor} onSelect={selectOpening} />
          </div>
        </div>
      </section>

      <section id="games-section" className="space-y-3">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900">
          <FileTextIcon className="h-4 w-4 text-gray-400" />
          Games
        </h2>
        <GamesTable
          games={games}
          opponentId={opponentId}
          filterEco={filterEco}
          filterName={filterName}
          filterLabel={filterLabel}
          filterColor={filterColor}
          onClearFilter={() => {
            setFilterEco(null);
            setFilterName(null);
            setFilterColor(null);
            setFilterLabel(null);
          }}
        />
      </section>
    </>
  );
}
