"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

interface Job {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  payload: Record<string, string> | null;
  result: Record<string, unknown> | null;
}

const SOURCE_LABEL: Record<string, string> = {
  chessbase: "ChessBase",
  chesscom: "Chess.com",
};

export function ScoutingPanel({
  opponentId,
  initialHasJobs,
}: {
  opponentId: string;
  initialHasJobs: boolean;
}) {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [scouting, setScouting] = useState(!initialHasJobs);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const triggeredRef = useRef(false);

  async function fetchJobs(): Promise<Job[]> {
    try {
      const res = await fetch(`${API_BASE}/opponents/${opponentId}/imports/jobs`);
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  }

  function startPolling() {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(async () => {
      const data = await fetchJobs();
      setJobs(data);
      const active = data.some((j) => j.status === "queued" || j.status === "running");
      if (!active) {
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        setScouting(false);
        // Refresh now for games, then again after delays to catch the
        // FIDE profile background task which may finish slightly later.
        router.refresh();
        setTimeout(() => router.refresh(), 5_000);
        setTimeout(() => router.refresh(), 15_000);
      }
    }, 3000);
  }

  useEffect(() => {
    if (initialHasJobs) {
      // Already has jobs — just poll for active ones
      fetchJobs().then((data) => {
        setJobs(data);
        const active = data.some((j) => j.status === "queued" || j.status === "running");
        if (active) startPolling();
      });
      return;
    }

    // New space — trigger scouting once
    if (triggeredRef.current) return;
    triggeredRef.current = true;

    (async () => {
      try {
        await fetch(`${API_BASE}/opponents/${opponentId}/imports/auto`, { method: "POST" });
      } catch {
        // ignore — still poll to check
      }
      const data = await fetchJobs();
      setJobs(data);
      startPolling();
    })();

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [opponentId]);

  const active = jobs.filter((j) => j.status === "queued" || j.status === "running");
  const done = jobs.filter((j) => j.status === "completed" || j.status === "failed");
  const isActive = active.length > 0 || scouting;

  if (!isActive && jobs.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-center gap-2">
        {isActive ? (
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-400" />
        ) : (
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
        )}
        <span className="text-sm font-medium text-gray-700">
          {isActive ? "Scouting…" : "Scouting complete"}
        </span>
      </div>

      {jobs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {jobs.map((job) => {
            const source = job.payload?.source ?? "unknown";
            const label = SOURCE_LABEL[source] ?? source;
            const username = job.payload?.username ?? job.payload?.slug ?? null;
            const gamesImported =
              typeof job.result?.imported_games === "number"
                ? job.result.imported_games
                : null;
            const isRunning = job.status === "queued" || job.status === "running";
            const isSearching = isRunning && !username;

            return (
              <span
                key={job.id}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ${
                  job.status === "completed"
                    ? "bg-emerald-50 text-emerald-700"
                    : job.status === "failed"
                    ? "bg-rose-50 text-rose-600"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {isRunning && (
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                )}
                {label}
                {isSearching ? " · searching…" : username ? ` · ${username}` : ""}
                {job.status === "completed" && gamesImported !== null
                  ? ` · ${gamesImported} games`
                  : ""}
                {job.status === "failed" && job.result?.error
                  ? ` · ${String(job.result.error).slice(0, 60)}`
                  : job.status === "failed" ? " · failed" : ""}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
