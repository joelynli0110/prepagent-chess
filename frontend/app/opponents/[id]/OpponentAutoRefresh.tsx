"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiGet } from "@/lib/api";
import { Job } from "@/lib/types";

export function OpponentAutoRefresh({
  opponentId,
  shouldStart,
}: {
  opponentId: string;
  shouldStart: boolean;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!shouldStart) return;

    let cancelled = false;

    async function tick() {
      try {
        const jobs = await apiGet<Job[]>(`/opponents/${opponentId}/imports/jobs`);
        if (cancelled) return;

        const hasActiveJobs = jobs.some((job) => job.status === "queued" || job.status === "running");
        router.refresh();

        if (hasActiveJobs) {
          window.setTimeout(tick, 2500);
        }
      } catch {
        if (!cancelled) {
          window.setTimeout(tick, 4000);
        }
      }
    }

    const timer = window.setTimeout(tick, 1200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [opponentId, router, shouldStart]);

  return null;
}
