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
  lichess: "Lichess",
  chesscom: "Chess.com",
};

export function ImportJobsStatus({ opponentId }: { opponentId: string }) {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function poll() {
    try {
      const res = await fetch(`${API_BASE}/opponents/${opponentId}/imports/jobs`);
      if (!res.ok) return;
      const data: Job[] = await res.json();
      // Only show jobs that are active or recently completed/failed
      const relevant = data.filter(
        (j) => j.status === "queued" || j.status === "running" || j.status === "completed" || j.status === "failed"
      );
      setJobs(relevant.slice(0, 10));

      const stillActive = relevant.some(
        (j) => j.status === "queued" || j.status === "running"
      );
      if (!stillActive && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        // Refresh server component data once all jobs settle
        router.refresh();
      }
    } catch {
      // ignore poll errors
    }
  }

  useEffect(() => {
    poll();
    intervalRef.current = setInterval(poll, 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [opponentId]);

  const active = jobs.filter((j) => j.status === "queued" || j.status === "running");

  if (jobs.length === 0 || active.length === 0) return null;

  return (
    <div className="rounded-2xl border p-4 space-y-2">
      <div className="flex items-center gap-2">
        {active.length > 0 && (
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-500" />
        )}
        <span className="text-sm font-medium text-gray-700">
          {active.length > 0
            ? `Importing games… (${active.length} source${active.length > 1 ? "s" : ""} in progress)`
            : "Import complete"}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {jobs.map((job) => {
          const source = job.payload?.source ?? "unknown";
          const label = SOURCE_LABEL[source] ?? source;
          const username = job.payload?.username ?? job.payload?.slug ?? "";
          const gamesImported =
            typeof job.result?.imported_games === "number"
              ? job.result.imported_games
              : null;

          return (
            <span
              key={job.id}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium ${
                job.status === "completed"
                  ? "bg-green-50 text-green-700"
                  : job.status === "failed"
                  ? "bg-red-50 text-red-600"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {job.status === "queued" || job.status === "running" ? (
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
              ) : null}
              {label}
              {username ? ` · ${username}` : ""}
              {job.status === "completed" && gamesImported !== null
                ? ` · ${gamesImported} games`
                : ""}
              {job.status === "failed" ? " · failed" : ""}
            </span>
          );
        })}
      </div>
    </div>
  );
}
