"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

interface PlatformAccount {
  platform: "lichess" | "chesscom";
  username: string;
  real_name?: string | null;
  title?: string | null;
  country?: string | null;
  birth_year?: number | null;
  fide_url?: string | null;
  url: string;
}

interface ImportState {
  [key: string]: "idle" | "loading" | "done" | "error";
}

export function PlatformImportForm({ opponentId }: { opponentId: string }) {
  const router = useRouter();
  const [searching, setSearching] = useState(false);
  const [accounts, setAccounts] = useState<PlatformAccount[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [importStates, setImportStates] = useState<ImportState>({});
  const [importMessages, setImportMessages] = useState<Record<string, string>>({});

  async function onSearch() {
    setSearching(true);
    setSearchError(null);
    setAccounts(null);

    try {
      const res = await fetch(
        `${API_BASE}/opponents/${opponentId}/imports/search-platforms`
      );
      if (!res.ok) throw new Error(`Search failed: ${res.status}`);
      const data: PlatformAccount[] = await res.json();
      setAccounts(data);
      if (data.length === 0) setSearchError("No accounts found on Lichess or Chess.com.");
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setSearching(false);
    }
  }

  async function onImport(account: PlatformAccount) {
    const key = `${account.platform}:${account.username}`;
    setImportStates((s) => ({ ...s, [key]: "loading" }));

    const endpoint =
      account.platform === "lichess"
        ? `${API_BASE}/opponents/${opponentId}/imports/lichess`
        : `${API_BASE}/opponents/${opponentId}/imports/chesscom`;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: account.username, max_games: 100 }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail ?? `Failed: ${res.status}`);
      }

      setImportStates((s) => ({ ...s, [key]: "done" }));
      setImportMessages((m) => ({
        ...m,
        [key]: "Import started — games will appear shortly.",
      }));
      router.refresh();
    } catch (err) {
      setImportStates((s) => ({ ...s, [key]: "error" }));
      setImportMessages((m) => ({
        ...m,
        [key]: err instanceof Error ? err.message : "Import failed.",
      }));
    }
  }

  return (
    <div className="rounded-2xl border p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Import from Online Platforms</h2>
          <p className="text-sm text-gray-500">
            Find this player on Lichess or Chess.com and import their games.
          </p>
        </div>
        <button
          onClick={onSearch}
          disabled={searching}
          className="shrink-0 rounded-xl border px-4 py-2 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {searching ? "Searching…" : "Search by name"}
        </button>
      </div>

      {searchError && (
        <p className="text-sm text-gray-400">{searchError}</p>
      )}

      {accounts && accounts.length > 0 && (
        <div className="space-y-2">
          {accounts.map((acc) => {
            const key = `${acc.platform}:${acc.username}`;
            const state = importStates[key] ?? "idle";
            const msg = importMessages[key];

            return (
              <div
                key={key}
                className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${
                      acc.platform === "lichess"
                        ? "bg-orange-100 text-orange-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {acc.platform === "lichess" ? "Lichess" : "Chess.com"}
                  </span>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      {acc.title && (
                        <span className="text-xs font-semibold text-amber-600">
                          {acc.title}
                        </span>
                      )}
                      <a
                        href={acc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-gray-900 hover:underline"
                      >
                        {acc.username}
                      </a>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      {acc.real_name && (
                        <span className="text-xs text-gray-500">{acc.real_name}</span>
                      )}
                      {acc.country && (
                        <span className="text-xs text-gray-400">{acc.country}</span>
                      )}
                      {acc.birth_year && (
                        <span className="text-xs text-gray-400">
                          b. {acc.birth_year}
                        </span>
                      )}
                      {acc.fide_url && (
                        <a
                          href={acc.fide_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-500 hover:underline"
                        >
                          FIDE
                        </a>
                      )}
                    </div>
                    {msg && (
                      <div
                        className={`text-xs mt-0.5 ${
                          state === "error" ? "text-red-500" : "text-gray-400"
                        }`}
                      >
                        {msg}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => onImport(acc)}
                  disabled={state === "loading" || state === "done"}
                  className="shrink-0 rounded-xl bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {state === "loading"
                    ? "Importing…"
                    : state === "done"
                    ? "Imported"
                    : "Import"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
