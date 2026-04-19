"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { Report, ReportContent, ReportStatus } from "@/lib/types";
import { useLanguage } from "@/lib/LanguageContext";
import { t } from "@/lib/translations";
import { FileTextIcon, SparkIcon } from "./Icons";

const STATUS_DOT: Record<ReportStatus, string> = {
  draft: "bg-amber-400 animate-pulse",
  awaiting_review: "bg-amber-400 animate-pulse",
  running: "bg-amber-400 animate-pulse",
  ready: "bg-emerald-500",
  failed: "bg-rose-500",
};

const PARALLEL_AGENTS: { key: keyof ReportContent; label: string }[] = [
  { key: "scouting_done", label: "Scouting" },
  { key: "pattern_done", label: "Pattern" },
  { key: "psychology_done", label: "Psychology" },
];

function AgentProgress({ content }: { content: ReportContent }) {
  const allParallelDone = PARALLEL_AGENTS.every(({ key }) => !!content[key]);
  const synthesisDone = !!content.synthesis_done;

  return (
    <div className="flex flex-wrap gap-3">
      {PARALLEL_AGENTS.map(({ key, label }) => {
        const done = !!content[key];
        return (
          <div key={key} className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${done ? "bg-emerald-500" : "bg-amber-400 animate-pulse"}`} />
            <span className={`text-xs ${done ? "text-gray-500" : "font-medium text-gray-700"}`}>{label}</span>
          </div>
        );
      })}
      {allParallelDone && (
        <div className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${synthesisDone ? "bg-emerald-500" : "bg-amber-400 animate-pulse"}`} />
          <span className={`text-xs ${synthesisDone ? "text-gray-500" : "font-medium text-gray-700"}`}>Synthesis</span>
        </div>
      )}
    </div>
  );
}

function ReportCard({ report, opponentId }: { report: Report; opponentId: string }) {
  const { language } = useLanguage();

  const statusLabel: Record<ReportStatus, string> = {
    draft: t("planning", language),
    awaiting_review: t("planning", language),
    running: t("running_agents", language),
    ready: t("status_ready", language),
    failed: t("status_failed", language),
  };

  return (
    <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FileTextIcon className="h-4 w-4 text-gray-400" />
            <span className="truncate text-sm font-medium text-gray-900">{report.title}</span>
          </div>
          <div className="mt-1 text-xs text-gray-400">{new Date(report.created_at).toLocaleDateString()}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${STATUS_DOT[report.status]}`} />
          <span className="text-xs text-gray-500">{statusLabel[report.status]}</span>
        </div>
      </div>

      {(report.status === "draft" || report.status === "awaiting_review") && (
        <p className="text-xs text-gray-400">{t("planning", language)}</p>
      )}

      {report.status === "running" && <AgentProgress content={report.content ?? {}} />}

      {report.status === "ready" && (
        <Link
          href={`/opponents/${opponentId}/reports/${report.id}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          {t("view_report", language)}
        </Link>
      )}

      {report.status === "failed" && report.content?.error && (
        <p className="text-xs font-mono text-rose-600">{report.content.error}</p>
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
    } catch {
      return [];
    }
  }, [opponentId]);

  const needsPolling = useCallback((rs: Report[]) => {
    const latest = rs[0];
    return !!latest && (latest.status === "draft" || latest.status === "running" || latest.status === "awaiting_review");
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
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
  }, [fetchReports, needsPolling, opponentId, stopPolling]);

  useEffect(() => {
    fetchReports().then((rs) => {
      setLoading(false);
      if (needsPolling(rs)) startPolling();
    });
    return () => stopPolling();
  }, [fetchReports, needsPolling, startPolling, stopPolling]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      await apiPost(`/opponents/${opponentId}/reports/generate`, { risk_mode: "balanced" });
      const rs = await fetchReports();
      if (needsPolling(rs)) startPolling();
    } catch (e) {
      console.error(e);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900">
          <SparkIcon className="h-4 w-4 text-gray-400" />
          {t("prep_reports", language)}
        </h2>
        <button
          onClick={handleGenerate}
          disabled={generating}
          title={t("generate_report", language)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gray-900 text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
        >
          <SparkIcon className="h-4 w-4" />
          <span className="sr-only">{generating ? t("generating", language) : t("generate_report", language)}</span>
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">{t("loading", language)}</p>
      ) : reports.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-400 shadow-sm">No report yet.</div>
      ) : (
        <ReportCard report={reports[0]} opponentId={opponentId} />
      )}
    </section>
  );
}
