import Link from "next/link";
import { notFound } from "next/navigation";
import { apiGet } from "@/lib/api";
import {
  OpeningTreeEntry,
  PatternReport,
  PsychologyReport,
  Report,
  ScoutingReport,
  StrategyPlan,
} from "@/lib/types";
import { CriticalPositions } from "./CriticalPositions";
import { Markdown } from "./Markdown";
import { OpeningTree } from "./OpeningTree";
import { ReportChat } from "./ReportChat";

// ---------------------------------------------------------------------------
// Small display helpers
// ---------------------------------------------------------------------------

function Chip({ label, variant = "gray" }: { label: string; variant?: "gray" | "red" | "green" | "blue" | "amber" }) {
  const cls = {
    gray:  "bg-gray-100 text-gray-600",
    red:   "bg-red-50 text-red-700 border border-red-100",
    green: "bg-green-50 text-green-700 border border-green-100",
    blue:  "bg-blue-50 text-blue-700 border border-blue-100",
    amber: "bg-amber-50 text-amber-700 border border-amber-100",
  }[variant];
  return (
    <span className={`rounded px-2 py-0.5 text-xs ${cls}`}>{label}</span>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border p-5 space-y-4">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      {children}
    </section>
  );
}

function KV({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="text-sm">
      <span className="text-gray-400">{label}: </span>
      <span className="text-gray-800">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Strategy plan card
// ---------------------------------------------------------------------------

function PlanSection({ plan }: { plan: StrategyPlan }) {
  return (
    <SectionCard title="Strategy Plan">
      <div className="grid gap-4 sm:grid-cols-2">
        {plan.focus_areas && plan.focus_areas.length > 0 && (
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">Focus areas</div>
            <ul className="space-y-1 text-sm text-gray-800">
              {plan.focus_areas.map((a, i) => <li key={i}>• {a}</li>)}
            </ul>
          </div>
        )}
        {plan.target_openings && plan.target_openings.length > 0 && (
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">Target</div>
            <div className="flex flex-wrap gap-1">
              {plan.target_openings.map((o, i) => <Chip key={i} label={o} variant="red" />)}
            </div>
          </div>
        )}
        {plan.avoid_openings && plan.avoid_openings.length > 0 && (
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">Avoid</div>
            <div className="flex flex-wrap gap-1">
              {plan.avoid_openings.map((o, i) => <Chip key={i} label={o} variant="gray" />)}
            </div>
          </div>
        )}
        <div className="space-y-1">
          <KV label="Phase weakness" value={plan.phase_weakness} />
          <KV label="Priority" value={plan.prep_priority} />
        </div>
      </div>
      {plan.risk_notes && (
        <p className="text-sm text-gray-600 italic border-l-2 border-gray-200 pl-3">{plan.risk_notes}</p>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Scouting agent card
// ---------------------------------------------------------------------------

function ScoutingSection({ report }: { report: ScoutingReport }) {
  const sensitivity = report.time_pressure_sensitivity;
  const sensitivityVariant =
    sensitivity === "high" ? "red" : sensitivity === "medium" ? "amber" : "green";

  return (
    <SectionCard title="Scouting Agent">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Time pressure sensitivity</span>
            {sensitivity && <Chip label={sensitivity} variant={sensitivityVariant} />}
          </div>
          <KV label="Preferred format" value={report.preferred_time_control} />
          <KV label="Strongest bracket" value={report.strongest_bracket} />
          <KV label="Weakest bracket" value={report.weakest_bracket} />
        </div>
        <div className="space-y-2 text-sm text-gray-700">
          {report.time_pressure_insight && (
            <p className="italic border-l-2 border-amber-200 pl-3">{report.time_pressure_insight}</p>
          )}
          {report.rating_insight && (
            <p className="italic border-l-2 border-gray-200 pl-3">{report.rating_insight}</p>
          )}
        </div>
      </div>
      {report.key_findings && report.key_findings.length > 0 && (
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">Key findings</div>
          <ul className="space-y-1 text-sm text-gray-800">
            {report.key_findings.map((f, i) => <li key={i}>• {f}</li>)}
          </ul>
        </div>
      )}
      {report.raw && (
        <pre className="rounded bg-gray-50 p-3 text-xs text-gray-600 overflow-auto">{report.raw}</pre>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Pattern agent card
// ---------------------------------------------------------------------------

function PatternSection({ report }: { report: PatternReport }) {
  const depthVariant =
    report.opening_depth_assessment === "deep" ? "green"
    : report.opening_depth_assessment === "shallow" ? "red"
    : "amber";

  return (
    <SectionCard title="Pattern Agent">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-3">
          {report.structural_tendencies && report.structural_tendencies.length > 0 && (
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1">Structural tendencies</div>
              <ul className="space-y-0.5 text-sm text-gray-800">
                {report.structural_tendencies.map((t, i) => <li key={i}>• {t}</li>)}
              </ul>
            </div>
          )}
          {report.exploit_positions && report.exploit_positions.length > 0 && (
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1">Exploit positions</div>
              <div className="flex flex-wrap gap-1">
                {report.exploit_positions.map((p, i) => <Chip key={i} label={p} variant="red" />)}
              </div>
            </div>
          )}
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Opening depth</span>
            {report.opening_depth_assessment && (
              <Chip label={report.opening_depth_assessment} variant={depthVariant} />
            )}
          </div>
          <KV label="Book deviation" value={report.book_deviation_habit} />
          <KV label="Phase weakness" value={report.dominant_phase_weakness} />
        </div>
      </div>
      {report.recurring_error_patterns && report.recurring_error_patterns.length > 0 && (
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1">Recurring errors</div>
          <ul className="space-y-0.5 text-sm text-gray-800">
            {report.recurring_error_patterns.map((e, i) => <li key={i}>• {e}</li>)}
          </ul>
        </div>
      )}
      {report.raw && (
        <pre className="rounded bg-gray-50 p-3 text-xs text-gray-600 overflow-auto">{report.raw}</pre>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Psychology agent card
// ---------------------------------------------------------------------------

function PsychologySection({ report }: { report: PsychologyReport }) {
  return (
    <SectionCard title="Psychology Agent">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Color preference</span>
            {report.color_preference && (
              <Chip
                label={report.color_preference}
                variant={report.color_preference === "white" ? "gray" : report.color_preference === "black" ? "gray" : "blue"}
              />
            )}
          </div>
          <KV label="Critical move range" value={report.critical_move_range} />
          {report.fatigue_pattern && report.fatigue_pattern !== "none" && report.fatigue_pattern !== "null" && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Fatigue</span>
              <Chip label={`fades ${report.fatigue_pattern}`} variant="amber" />
            </div>
          )}
          {report.color_insight && (
            <p className="text-sm text-gray-700 italic border-l-2 border-gray-200 pl-3">
              {report.color_insight}
            </p>
          )}
          {report.fatigue_insight && (
            <p className="text-sm text-gray-700 italic border-l-2 border-amber-200 pl-3">
              {report.fatigue_insight}
            </p>
          )}
        </div>
        <div className="space-y-3">
          {report.comfort_zone_openings && report.comfort_zone_openings.length > 0 && (
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1">Comfort zone</div>
              <div className="flex flex-wrap gap-1">
                {report.comfort_zone_openings.map((o, i) => <Chip key={i} label={o} variant="green" />)}
              </div>
            </div>
          )}
          {report.discomfort_zone_openings && report.discomfort_zone_openings.length > 0 && (
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1">Discomfort zone</div>
              <div className="flex flex-wrap gap-1">
                {report.discomfort_zone_openings.map((o, i) => <Chip key={i} label={o} variant="red" />)}
              </div>
            </div>
          )}
        </div>
      </div>
      {report.psychological_profile && (
        <p className="text-sm text-gray-700 italic border-l-2 border-blue-200 pl-3">
          {report.psychological_profile}
        </p>
      )}
      {report.exploit_strategy && (
        <div className="rounded-xl bg-gray-900 px-4 py-3 text-sm text-white">
          <span className="text-gray-400 text-xs uppercase tracking-wide mr-2">Exploit strategy</span>
          {report.exploit_strategy}
        </div>
      )}
      {report.raw && (
        <pre className="rounded bg-gray-50 p-3 text-xs text-gray-600 overflow-auto">{report.raw}</pre>
      )}
    </SectionCard>
  );
}


// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string; reportId: string }>;
}) {
  const { id, reportId } = await params;

  let report: Report;
  try {
    report = await apiGet<Report>(`/opponents/${id}/reports/${reportId}`);
  } catch {
    notFound();
  }

  const content = report.content ?? {};
  const plan = content.plan;
  const scoutingReport = content.scouting_report;
  const patternReport = content.pattern_report;
  const psychologyReport = content.psychology_report;
  const openingTree = (content.opening_tree ?? []) as OpeningTreeEntry[];
  const criticalPositions = (content.critical_positions ?? []) as object[];
  const narrative = content.narrative ?? content.markdown ?? "";

  return (
    <main className="mx-auto max-w-6xl p-8 space-y-8">
      <Link
        href={`/opponents/${id}`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
      >
        ← Back to opponent
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{report.title}</h1>
          <p className="text-sm text-gray-400 mt-1">
            {new Date(report.created_at).toLocaleDateString(undefined, {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
            {content.risk_mode && (
              <span className="ml-2 capitalize text-gray-500">· {content.risk_mode}</span>
            )}
          </p>
        </div>
        <span
          className={`rounded border px-2 py-0.5 text-xs font-medium ${
            report.status === "ready"
              ? "bg-green-50 text-green-700 border-green-100"
              : "bg-yellow-50 text-yellow-700 border-yellow-100"
          }`}
        >
          {report.status}
        </span>
      </div>

      {/* Agent sections */}
      {plan && <PlanSection plan={plan} />}

      <div className="grid gap-6 lg:grid-cols-3">
        {scoutingReport && <ScoutingSection report={scoutingReport as ScoutingReport} />}
        {patternReport && <PatternSection report={patternReport as PatternReport} />}
        {psychologyReport && <PsychologySection report={psychologyReport as PsychologyReport} />}
      </div>

      {/* Opening tree */}
      {openingTree.length > 0 && <OpeningTree tree={openingTree} />}

      {/* Critical positions */}
      {criticalPositions.length > 0 && (
        <CriticalPositions
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          positions={criticalPositions as any[]}
          opponentId={id}
        />
      )}

      {/* Narrative */}
      {narrative && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Analysis</h2>
          <div className="rounded-2xl border p-7">
            <div className="max-w-3xl">
              <Markdown>{narrative}</Markdown>
            </div>
          </div>
        </section>
      )}

      {/* Chat */}
      {report.status === "ready" && (
        <ReportChat opponentId={id} reportId={reportId} />
      )}

      {/* Error */}
      {report.status === "failed" && content.error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-700">Report generation failed</p>
          <p className="mt-1 font-mono text-xs text-red-600">{content.error}</p>
        </div>
      )}
    </main>
  );
}
