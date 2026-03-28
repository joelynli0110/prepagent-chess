"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { Report, ReportContent, ReportStatus, StrategyPlan } from "@/lib/types";

const STATUS_LABEL: Record<ReportStatus, string> = {
  draft: "Planning…",
  awaiting_review: "Review plan",
  running: "Agents running…",
  ready: "Ready",
  failed: "Failed",
};

function PlanCard({
  plan,
  onApprove,
  approving,
}: {
  plan: StrategyPlan;
  onApprove: () => void;
  approving: boolean;
}) {
  return (
    <div className="rounded-2xl border p-5 space-y-4">
      <h3 className="font-semibold text-base">Strategy Plan</h3>

      {plan.focus_areas && plan.focus_areas.length > 0 && (
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1">
            Focus areas
          </div>
          <ul className="space-y-0.5">
            {plan.focus_areas.map((a, i) => (
              <li key={i} className="text-sm text-gray-800">
                • {a}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {plan.target_openings && plan.target_openings.length > 0 && (
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1">
              Target openings
            </div>
            <div className="flex flex-wrap gap-1">
              {plan.target_openings.map((o, i) => (
                <span
                  key={i}
                  className="rounded bg-red-50 px-2 py-0.5 text-xs text-red-700 border border-red-100"
                >
                  {o}
                </span>
              ))}
            </div>
          </div>
        )}

        {plan.avoid_openings && plan.avoid_openings.length > 0 && (
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1">
              Avoid openings
            </div>
            <div className="flex flex-wrap gap-1">
              {plan.avoid_openings.map((o, i) => (
                <span
                  key={i}
                  className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500"
                >
                  {o}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        {plan.phase_weakness && (
          <div>
            <span className="text-gray-400">Phase weakness: </span>
            <span className="capitalize font-medium">{plan.phase_weakness}</span>
          </div>
        )}
        {plan.prep_priority && (
          <div>
            <span className="text-gray-400">Priority: </span>
            <span className="capitalize font-medium">{plan.prep_priority}</span>
          </div>
        )}
      </div>

      {plan.risk_notes && (
        <p className="text-sm text-gray-600 italic border-l-2 border-gray-200 pl-3">
          {plan.risk_notes}
        </p>
      )}

      {plan.raw && (
        <pre className="rounded bg-gray-50 p-3 text-xs text-gray-600 overflow-auto">
          {plan.raw}
        </pre>
      )}

      <button
        onClick={onApprove}
        disabled={approving}
        className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
      >
        {approving ? "Approving…" : "Approve & Generate Report"}
      </button>
    </div>
  );
}

const AGENTS: { key: keyof ReportContent; label: string }[] = [
  { key: "scouting_done",   label: "Scouting" },
  { key: "pattern_done",    label: "Pattern" },
  { key: "psychology_done", label: "Psychology" },
  { key: "synthesis_done",  label: "Synthesis" },
];

function AgentProgress({ content }: { content: ReportContent }) {
  return (
    <div className="space-y-2">
      {content.current_agent_label && (
        <p className="text-sm text-gray-500 animate-pulse">{content.current_agent_label}</p>
      )}
      <div className="flex gap-3">
        {AGENTS.map(({ key, label }) => {
          const done = !!content[key];
          const active = content.current_agent === key.replace("_done", "");
          return (
            <div key={key} className="flex items-center gap-1.5">
              <span
                className={`h-2 w-2 rounded-full ${
                  done
                    ? "bg-green-500"
                    : active
                    ? "bg-yellow-400 animate-pulse"
                    : "bg-gray-200"
                }`}
              />
              <span
                className={`text-xs ${
                  done ? "text-gray-700" : active ? "text-gray-600 font-medium" : "text-gray-300"
                }`}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ReportStatus }) {
  const colors: Record<ReportStatus, string> = {
    draft: "bg-yellow-50 text-yellow-700 border-yellow-100",
    awaiting_review: "bg-blue-50 text-blue-700 border-blue-100",
    running: "bg-yellow-50 text-yellow-700 border-yellow-100",
    ready: "bg-green-50 text-green-700 border-green-100",
    failed: "bg-red-50 text-red-700 border-red-100",
  };
  return (
    <span className={`rounded border px-2 py-0.5 text-xs font-medium ${colors[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function ReportCard({
  report,
  opponentId,
  onApprove,
  approving,
}: {
  report: Report;
  opponentId: string;
  onApprove: (id: string) => void;
  approving: boolean;
}) {
  return (
    <div className="rounded-2xl border p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <span className="font-medium text-sm text-gray-900">{report.title}</span>
          <span className="ml-2 text-xs text-gray-400">
            {new Date(report.created_at).toLocaleDateString()}
          </span>
        </div>
        <StatusBadge status={report.status} />
      </div>

      {report.status === "draft" && (
        <p className="text-sm text-gray-400 animate-pulse">Orchestrator planning strategy…</p>
      )}

      {report.status === "running" && (
        <AgentProgress content={report.content ?? {}} />
      )}

      {report.status === "awaiting_review" && report.content?.plan && (
        <PlanCard
          plan={report.content.plan}
          onApprove={() => onApprove(report.id)}
          approving={approving}
        />
      )}

      {report.status === "ready" && (
        <Link
          href={`/opponents/${opponentId}/reports/${report.id}`}
          className="inline-block rounded-xl border px-4 py-2 text-sm hover:bg-gray-50"
        >
          View report →
        </Link>
      )}

      {report.status === "failed" && report.content?.error && (
        <p className="text-xs text-red-600 font-mono">{report.content.error}</p>
      )}
    </div>
  );
}

export function ReportSection({ opponentId }: { opponentId: string }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);
  const [riskMode, setRiskMode] = useState<"balanced" | "need_win" | "draw_ok">("balanced");
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

  // Poll when the latest report is in a non-terminal state
  const needsPolling = useCallback((rs: Report[]) => {
    const latest = rs[0];
    return !!latest && (latest.status === "draft" || latest.status === "running");
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
      if (!needsPolling(rs)) stopPolling();
    }, 2500);
  }

  function stopPolling() {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      await apiPost(`/opponents/${opponentId}/reports/generate`, { risk_mode: riskMode });
      const rs = await fetchReports();
      if (needsPolling(rs)) startPolling();
    } catch (e) {
      console.error(e);
    } finally {
      setGenerating(false);
    }
  }

  async function handleApprove(reportId: string) {
    setApproving(reportId);
    try {
      await apiPost(`/opponents/${opponentId}/reports/${reportId}/resume`, {});
      const rs = await fetchReports();
      if (needsPolling(rs)) startPolling();
    } catch (e) {
      console.error(e);
    } finally {
      setApproving(null);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold">Prep Reports</h2>
        <div className="flex items-center gap-2">
          <select
            value={riskMode}
            onChange={(e) => setRiskMode(e.target.value as typeof riskMode)}
            className="rounded-xl border px-3 py-2 text-sm text-gray-700 focus:outline-none"
          >
            <option value="balanced">Balanced</option>
            <option value="need_win">Need win</option>
            <option value="draw_ok">Draw OK</option>
          </select>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
          >
            {generating ? "Starting…" : "Generate Report"}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : reports.length === 0 ? (
        <p className="text-sm text-gray-400">No reports yet. Generate your first prep report above.</p>
      ) : (
        <ReportCard
          report={reports[0]}
          opponentId={opponentId}
          onApprove={handleApprove}
          approving={approving === reports[0].id}
        />
      )}
    </section>
  );
}
