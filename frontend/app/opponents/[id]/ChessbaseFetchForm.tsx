"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

export function ChessbaseFetchForm({ opponentId }: { opponentId: string }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!url.trim()) return;

    setIsLoading(true);
    setStatus(null);

    try {
      const res = await fetch(`${API_BASE}/opponents/${opponentId}/imports/chessbase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail ?? `Request failed: ${res.status}`);
      }

      setStatus({ type: "success", text: "Games imported from ChessBase. Refresh in a moment." });
      setUrl("");
      router.refresh();
    } catch (err) {
      setStatus({ type: "error", text: err instanceof Error ? err.message : "Import failed." });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border p-5 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Import from ChessBase</h2>
        <p className="text-sm text-gray-500">
          Paste a ChessBase player profile URL to fetch all their games.
        </p>
      </div>

      <div className="flex gap-3">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://players.chessbase.com/en/player/Carlsen_Magnus/40108"
          className="flex-1 rounded-xl border px-3 py-2 text-sm"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !url.trim()}
          className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40 shrink-0"
        >
          {isLoading ? "Fetching…" : "Import"}
        </button>
      </div>

      {status && (
        <p
          className={`rounded-xl border px-4 py-2 text-sm ${
            status.type === "success"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {status.text}
        </p>
      )}
    </form>
  );
}
