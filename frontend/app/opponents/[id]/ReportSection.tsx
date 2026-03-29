"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { Report, ReportContent, ReportStatus } from "@/lib/types";
import { useLanguage } from "@/lib/LanguageContext";
import { t } from "@/lib/translations";

const STATUS_DOT: Record<ReportStatus, string> = {
  draft:            "bg-amber-400 animate-pulse",
  awaiting_review:  "bg-amber-400 animate-pulse",
  running:          "bg-amber-400 animate-pulse",
  ready:            "bg-emerald-500",
  failed:           "bg-rose-500",
};

const PARALLEL_AGENTS: { key: keyof ReportContent; label: string }[] = [
  { key: "scouting_done",   label: "Scouting" },
  { key: "pattern_done",    label: "Pattern" },
  { key: "psychology_done", label: "Psychology" },
];

function AgentProgress({ content }: { content: ReportContent }) {
  const allParallelDone = PARALLEL_AGENTS.every(({ key }) => !!content[key]);
  const synthesisDone = !!content.synthesis_done;
  const synthesisRunning = allParallelDone && !synthesisDone;

  return (
    <div className="space-y-2.5">
      {/* Parallel agents row */}
      <div className="flex gap-4">
        {PARALLEL_AGENTS.map(({ key, label }) => {
          const done = !!content[key];
          return (
            <div key={key} className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${
                done ? "bg-emerald-500" : "bg-amber-400 animate-pulse"
              }`} />
              <span className={`text-xs ${done ? "text-gray-600" : "font-medium text-gray-700"}`}>
                {label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Synthesis — shown only once parallel agents are done */}
      {allParallelDone && (
        <div className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${
            synthesisDone ? "bg-emerald-500" : "bg-amber-400 animate-pulse"
          }`} />
          <span className={`text-xs ${synthesisDone ? "text-gray-600" : synthesisRunning ? "font-medium text-gray-700" : "text-gray-300"}`}>
            Synthesis
          </span>
        </div>
      )}
    </div>
  );
}


function ReportCard({ report, opponentId }: {
  report: Report; opponentId: string;
}) {
  const { language } = useLanguage();

  const statusLabel: Record<ReportStatus, string> = {
    draft:           t("planning", language),
    awaiting_review: t("planning", language),
    running:         t("running_agents", language),
    ready:           t("status_ready", language),
    failed:          t("status_failed", language),
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <span className="text-sm font-medium text-gray-900">{report.title}</span>
          <span className="ml-2 text-xs text-gray-400">
            {new Date(report.created_at).toLocaleDateString()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${STATUS_DOT[report.status]}`} />
          <span className="text-xs text-gray-500">{statusLabel[report.status]}</span>
        </div>
      </div>

      {(report.status === "draft" || report.status === "awaiting_review") && (
        <p className="text-xs text-gray-400 animate-pulse">{t("planning", language)}</p>
      )}

      {report.status === "running" && <AgentProgress content={report.content ?? {}} />}

      {report.status === "ready" && (
        <Link
          href={`/opponents/${opponentId}/reports/${report.id}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          {t("view_report", language)}
        </Link>
      )}

      {report.status === "failed" && report.content?.error && (
        <p className="text-xs text-rose-600 font-mono">{report.content.error}</p>
      )}
    </div>
  );
}

export function ReportSection({ opponentId }: { opponentId: string }) {
  const { language } = useLanguage();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchReports = useCallback(async () => {
    try {
      const data = await apiGet<Report[]>(`/opponents/${opponentId}/reports`);
      setReports(data);
      return data;
    } catch { return []; }
  }, [opponentId]);

  const needsPolling = useCallback((rs: Report[]) => {
    const latest = rs[0];
    return !!latest && (latest.status === "draft" || latest.status === "running" || latest.status === "awaiting_review");
  }, []);

  useEffect(() => {
    fetchReports().then((rs) => {
      setLoading(false);
      if (needsPolling(rs)) startPolling();
    });
    return () => stopPolling();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startPolling() {
    if (pollingRef.current) return;
    pollingRef.current = setInterval(async () => {
      const rs = await fetchReports();
      const latest = rs[0];
      if (latest?.status === "awaiting_review") {
        stopPolling();
        await apiPost(`/opponents/${opponentId}/reports/${latest.id}/resume`, {});
        const rs2 = await fetchReports();
        if (needsPolling(rs2)) startPolling();
      } else if (!needsPolling(rs)) {
        stopPolling();
      }
    }, 2500);
  }

  function stopPolling() {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      await apiPost(`/opponents/${opponentId}/reports/generate`, { risk_mode: "balanced" });
      const rs = await fetchReports();
      if (needsPolling(rs)) startPolling();
    } catch (e) { console.error(e); } finally { setGenerating(false); }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-semibold text-gray-900">{t("prep_reports", language)}</h2>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          {generating ? t("generating", language) : t("generate_report", language)}
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">{t("loading", language)}</p>
      ) : reports.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
          <p className="text-sm text-gray-500">{t("no_reports", language)}</p>
          <p className="text-xs text-gray-400 mt-1">{t("no_reports_sub", language)}</p>
        </div>
      ) : (
        <ReportCard
          report={reports[0]}
          opponentId={opponentId}
        />
      )}
    </section>
  );
}
