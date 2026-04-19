"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Game } from "@/lib/types";
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "./Icons";

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
  const label = game.result === "1/2-1/2" ? "1/2" : game.result;
  const cls = r === "win" ? "font-semibold text-emerald-700" : r === "loss" ? "font-semibold text-rose-600" : "text-gray-500";
  return <span className={cls}>{label}</span>;
}

function SortHeader({
  col,
  label,
  current,
  dir,
  onSort,
}: {
  col: SortKey;
  label: string;
  current: SortKey;
  dir: SortDir;
  onSort: (k: SortKey) => void;
}) {
  const active = current === col;
  return (
    <th
      className="cursor-pointer select-none px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-400 transition-colors hover:text-gray-600"
      onClick={() => onSort(col)}
    >
      {label}
      <span className="ml-1 inline-block w-3 text-center">{active ? (dir === "asc" ? "↑" : "↓") : <span className="opacity-20">↕</span>}</span>
    </th>
  );
}

function getValue(game: Game, key: SortKey): string {
  switch (key) {
    case "white_name":
      return game.white_name ?? "";
    case "black_name":
      return game.black_name ?? "";
    case "result":
      return game.result ?? "";
    case "eco":
      return game.eco ?? "";
    case "event":
      return game.event ?? "";
    case "source":
      return game.source ?? "";
    case "date_played":
      return game.date_played ?? "";
  }
}

function lineVariation(game: Game): string {
  const opening = game.opening_name ?? "";
  const colon = opening.indexOf(":");
  if (colon < 0) return "-";
  const variation = opening.slice(colon + 1).trim();
  return variation || "-";
}

export function GamesTable({
  games,
  opponentId,
  filterEco,
  filterName,
  filterColor,
  filterLabel,
  onClearFilter,
}: {
  games: Game[];
  opponentId: string;
  filterEco?: string | null;
  filterName?: string | null;
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
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(0);
  }

  const filtered = filterEco
    ? games.filter(
        (g) =>
          g.eco === filterEco &&
          (!filterName || (g.opening_name ?? null) === filterName) &&
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
        {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, sorted.length)} / {sorted.length}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => setPage((p) => p - 1)}
          disabled={page === 0}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30"
          title="Previous"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </button>
        {Array.from({ length: totalPages }, (_, i) => i)
          .filter((i) => Math.abs(i - page) <= 2 || i === 0 || i === totalPages - 1)
          .reduce<(number | "...")[]>((acc, i, idx, arr) => {
            if (idx > 0 && i - (arr[idx - 1] as number) > 1) acc.push("...");
            acc.push(i);
            return acc;
          }, [])
          .map((item, idx) =>
            item === "..." ? (
              <span key={`el-${idx}`} className="px-1 text-xs text-gray-300">
                ...
              </span>
            ) : (
              <button
                key={item}
                onClick={() => setPage(item as number)}
                className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                  item === page ? "border-gray-900 bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {(item as number) + 1}
              </button>
            )
          )}
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={page === totalPages - 1}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30"
          title="Next"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {filterEco && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            <span className="font-medium text-gray-700">{filterLabel ?? filterEco}</span>
            <span className="ml-1 text-gray-400">· {sorted.length}</span>
          </span>
          <button
            onClick={() => {
              onClearFilter?.();
              setPage(0);
            }}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 text-gray-400 transition-colors hover:text-gray-700"
            title="Clear filter"
          >
            <XIcon className="h-3.5 w-3.5" />
            <span className="sr-only">Clear filter</span>
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <SortHeader col="white_name" label="White" current={sortKey} dir={sortDir} onSort={handleSort} />
              <SortHeader col="black_name" label="Black" current={sortKey} dir={sortDir} onSort={handleSort} />
              <SortHeader col="result" label="Result" current={sortKey} dir={sortDir} onSort={handleSort} />
              <SortHeader col="eco" label="ECO" current={sortKey} dir={sortDir} onSort={handleSort} />
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-400">Line</th>
              <SortHeader col="event" label="Event" current={sortKey} dir={sortDir} onSort={handleSort} />
              <SortHeader col="source" label="Src" current={sortKey} dir={sortDir} onSort={handleSort} />
              <SortHeader col="date_played" label="Date" current={sortKey} dir={sortDir} onSort={handleSort} />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {pageGames.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-sm text-gray-400" colSpan={8}>
                  {filterEco ? "No games found." : "No games yet."}
                </td>
              </tr>
            ) : (
              pageGames.map((game) => (
                <tr
                  key={game.id}
                  onClick={() => router.push(`/opponents/${opponentId}/games/${game.id}`)}
                  className="cursor-pointer transition-colors hover:bg-gray-50/60"
                >
                  <td className="px-4 py-3 font-medium text-gray-900">{game.white_name}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{game.black_name}</td>
                  <td className="px-4 py-3">
                    <ResultBadge game={game} />
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-500">{game.eco ?? "-"}</span>
                  </td>
                  <td className="max-w-[240px] truncate px-4 py-3 text-xs text-gray-500" title={lineVariation(game)}>
                    {lineVariation(game)}
                  </td>
                  <td className="max-w-[180px] truncate px-4 py-3 text-xs text-gray-500">{game.event ?? "-"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
                        game.source === "chessbase"
                          ? "bg-blue-50 text-blue-600"
                          : game.source === "chesscom"
                          ? "bg-green-50 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {SOURCE_LABEL[game.source] ?? game.source}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums text-gray-400">{game.date_played ?? "-"}</td>
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
