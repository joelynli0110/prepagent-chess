"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

type JobStatus = "queued" | "running" | "completed" | "failed";

interface Job {
  id: string;
  status: JobStatus;
  result?: { analyzed_games?: number; analyzed_positions?: number; error?: string } | null;
}

export function AnalyzeButton({ opponentId }: { opponentId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | JobStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function startAnalysis() {
    setStatus("queued");
    setMessage(null);

    try {
      const res = await fetch(`${API_BASE}/opponents/${opponentId}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ depth: 10, max_games: 20, max_plies: 40, only_missing: false }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail ?? `Request failed: ${res.status}`);
      }

      const job: Job = await res.json();
      setStatus("running");
      poll(job.id);
    } catch (err) {
      setStatus("failed");
      setMessage(err instanceof Error ? err.message : "Failed to start analysis.");
    }
  }

  function poll(jobId: string) {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/jobs/${jobId}`);
        if (!res.ok) return;
        const job: Job = await res.json();

        if (job.status === "completed") {
          clearInterval(interval);
          setStatus("completed");
          const g = job.result?.analyzed_games ?? 0;
          const p = job.result?.analyzed_positions ?? 0;
          setMessage(`Analyzed ${g} game(s), ${p} position(s).`);
          router.refresh();
        } else if (job.status === "failed") {
          clearInterval(interval);
          setStatus("failed");
          setMessage(job.result?.error ?? "Analysis failed.");
        }
      } catch {
        // network hiccup — keep polling
      }
    }, 2000);
  }

  const isRunning = status === "queued" || status === "running";

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={startAnalysis}
        disabled={isRunning}
        className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isRunning ? "Analyzing…" : "Analyze opponent"}
      </button>

      {message && (
        <p className={`text-xs ${status === "failed" ? "text-red-600" : "text-gray-500"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
