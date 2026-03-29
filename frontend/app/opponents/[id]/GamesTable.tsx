"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Game } from "@/lib/types";

const PAGE_SIZE = 10;

type SortKey = "white_name" | "black_name" | "result" | "eco" | "event" | "source" | "date_played";
type SortDir = "asc" | "desc";

const SOURCE_LABEL: Record<string, string> = {
  chessbase: "ChessBase",
  chesscom: "Chess.com",
  upload: "Upload",
};

function opponentResult(game: Game): "win" | "loss" | "draw" | null {
  if (!game.opponent_side) return null;
  const { result, opponent_side } = game;
  if (result === "1/2-1/2") return "draw";
  if (opponent_side === "white") return result === "1-0" ? "win" : "loss";
  return result === "0-1" ? "win" : "loss";
}

function ResultBadge({ game }: { game: Game }) {
  const r = opponentResult(game);
  const label =
    game.result === "1-0" ? "1–0" :
    game.result === "0-1" ? "0–1" :
    game.result === "1/2-1/2" ? "½–½" : game.result;
  const cls =
    r === "win"  ? "text-emerald-700 font-semibold" :
    r === "loss" ? "text-rose-600 font-semibold" :
                   "text-gray-500";
  return <span className={cls}>{label}</span>;
}

function SortHeader({ col, label, current, dir, onSort }: {
  col: SortKey; label: string; current: SortKey; dir: SortDir; onSort: (k: SortKey) => void;
}) {
  const active = current === col;
  return (
    <th
      className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide cursor-pointer select-none hover:text-gray-600 transition-colors"
      onClick={() => onSort(col)}
    >
      {label}
      <span className="ml-1 inline-block w-3 text-center">
        {active ? (dir === "asc" ? "↑" : "↓") : <span className="opacity-20">↕</span>}
      </span>
    </th>
  );
}

function getValue(game: Game, key: SortKey): string {
  switch (key) {
    case "white_name":  return game.white_name ?? "";
    case "black_name":  return game.black_name ?? "";
    case "result":      return game.result ?? "";
    case "eco":         return game.eco ?? "";
    case "event":       return game.event ?? "";
    case "source":      return game.source ?? "";
    case "date_played": return game.date_played ?? "";
  }
}

export function GamesTable({
  games,
  opponentId,
  filterEco,
  filterColor,
  filterLabel,
  onClearFilter,
}: {
  games: Game[];
  opponentId: string;
  filterEco?: string | null;
  filterColor?: string | null;
  filterLabel?: string | null;
  onClearFilter?: () => void;
}) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>("date_played");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(0);
  }

  const filtered = filterEco
    ? games.filter(g =>
        g.eco === filterEco &&
        (!filterColor || g.opponent_side === filterColor)
      )
    : games;

  const sorted = [...filtered].sort((a, b) => {
    const cmp = getValue(a, sortKey).localeCompare(getValue(b, sortKey), undefined, { numeric: true });
    return sortDir === "asc" ? cmp : -cmp;
  });

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const pageGames = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const paginationBar = totalPages > 1 && (
    <div className="flex items-center justify-between gap-4 px-1">
      <span className="text-xs text-gray-400">
        {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sorted.length)} of {sorted.length} games
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => setPage(p => p - 1)}
          disabled={page === 0}
          className="cursor-pointer rounded-lg border px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          ← Prev
        </button>
        {Array.from({ length: totalPages }, (_, i) => i)
          .filter(i => Math.abs(i - page) <= 2 || i === 0 || i === totalPages - 1)
          .reduce<(number | "…")[]>((acc, i, idx, arr) => {
            if (idx > 0 && i - (arr[idx - 1] as number) > 1) acc.push("…");
            acc.push(i);
            return acc;
          }, [])
          .map((item, idx) =>
            item === "…" ? (
              <span key={`el-${idx}`} className="px-1 text-xs text-gray-300">…</span>
            ) : (
              <button
                key={item}
                onClick={() => setPage(item as number)}
                className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                  item === page
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {(item as number) + 1}
              </button>
            )
          )}
        <button
          onClick={() => setPage(p => p + 1)}
          disabled={page === totalPages - 1}
          className="cursor-pointer rounded-lg border px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Next →
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {filterEco && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            Showing {sorted.length} game{sorted.length !== 1 ? "s" : ""} for{" "}
            <span className="font-medium text-gray-700">{filterLabel ?? filterEco}</span>
          </span>
          <button
            onClick={() => { onClearFilter?.(); setPage(0); }}
            className="cursor-pointer text-xs text-gray-400 hover:text-gray-700 underline underline-offset-2 transition-colors"
          >
            Clear filter
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <SortHeader col="white_name"  label="White"      current={sortKey} dir={sortDir} onSort={handleSort} />
              <SortHeader col="black_name"  label="Black"      current={sortKey} dir={sortDir} onSort={handleSort} />
              <SortHeader col="result"      label="Result"     current={sortKey} dir={sortDir} onSort={handleSort} />
              <SortHeader col="eco"         label="ECO"        current={sortKey} dir={sortDir} onSort={handleSort} />
              <SortHeader col="event"       label="Tournament" current={sortKey} dir={sortDir} onSort={handleSort} />
              <SortHeader col="source"      label="Source"     current={sortKey} dir={sortDir} onSort={handleSort} />
              <SortHeader col="date_played" label="Date"       current={sortKey} dir={sortDir} onSort={handleSort} />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {pageGames.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-sm text-gray-400" colSpan={7}>
                  {filterEco ? "No games found for this opening." : "No games yet. Import games or upload a PGN above."}
                </td>
              </tr>
            ) : (
              pageGames.map((game) => (
                <tr
                  key={game.id}
                  onClick={() => router.push(`/opponents/${opponentId}/games/${game.id}`)}
                  className="cursor-pointer hover:bg-gray-50/60 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-gray-900">{game.white_name}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{game.black_name}</td>
                  <td className="px-4 py-3"><ResultBadge game={game} /></td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-500">
                      {game.eco ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-[180px] truncate">{game.event ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
                      game.source === "chessbase" ? "bg-blue-50 text-blue-600" :
                      game.source === "chesscom"  ? "bg-green-50 text-green-700" :
                                                    "bg-gray-100 text-gray-500"
                    }`}>
                      {SOURCE_LABEL[game.source] ?? game.source}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 tabular-nums text-xs">{game.date_played ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {paginationBar}
    </div>
  );
}
