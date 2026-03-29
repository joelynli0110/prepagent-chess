"use client";

import Link from "next/link";
import { useState } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import { LANGUAGES, LangCode, t } from "@/lib/translations";
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

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TranslatedContent {
  narrative: string;
  plan: {
    focus_areas?: string[];
    phase_weakness?: string;
    prep_priority?: string;
    risk_notes?: string;
  };
  scouting: {
    time_pressure_insight?: string;
    rating_insight?: string;
    key_findings?: string[];
  };
  pattern: {
    structural_tendencies?: string[];
    recurring_error_patterns?: string[];
    exploit_positions?: string[];
  };
  psychology: {
    psychological_profile?: string;
    exploit_strategy?: string;
    color_insight?: string;
    fatigue_insight?: string;
  };
}

// ---------------------------------------------------------------------------
// Shared display helpers
// ---------------------------------------------------------------------------

function Chip({ label }: { label: string }) {
  return (
    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{label}</span>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
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
// Section components
// ---------------------------------------------------------------------------

function PlanSection({ plan, tx, lang }: { plan: StrategyPlan; tx: TranslatedContent["plan"] | null; lang: string }) {
  const focusAreas = tx?.focus_areas ?? plan.focus_areas;
  const phaseWeakness = tx?.phase_weakness ?? plan.phase_weakness;
  const prepPriority = tx?.prep_priority ?? plan.prep_priority;
  const riskNotes = tx?.risk_notes ?? plan.risk_notes;

  return (
    <SectionCard title={t("strategy_plan", lang as never)}>
      <div className="grid gap-4 sm:grid-cols-2">
        {focusAreas && focusAreas.length > 0 && (
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">{t("focus_areas", lang as never)}</div>
            <ul className="space-y-1 text-sm text-gray-800">
              {focusAreas.map((a, i) => <li key={i}>• {a}</li>)}
            </ul>
          </div>
        )}
        {plan.target_openings && plan.target_openings.length > 0 && (
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">{t("target", lang as never)}</div>
            <div className="flex flex-wrap gap-1">
              {plan.target_openings.map((o, i) => <Chip key={i} label={o} />)}
            </div>
          </div>
        )}
        {plan.avoid_openings && plan.avoid_openings.length > 0 && (
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">{t("avoid", lang as never)}</div>
            <div className="flex flex-wrap gap-1">
              {plan.avoid_openings.map((o, i) => <Chip key={i} label={o} />)}
            </div>
          </div>
        )}
        <div className="space-y-1">
          <KV label={t("phase_weakness", lang as never)} value={phaseWeakness} />
          <KV label={t("priority", lang as never)} value={prepPriority} />
        </div>
      </div>
      {riskNotes && (
        <p className="text-sm text-gray-600 italic border-l-2 border-gray-200 pl-3">{riskNotes}</p>
      )}
    </SectionCard>
  );
}

function ScoutingSection({ report, tx, lang }: {
  report: ScoutingReport;
  tx: TranslatedContent["scouting"] | null;
  lang: string;
}) {
  const sensitivity = report.time_pressure_sensitivity;
  const findings = tx?.key_findings ?? report.key_findings;
  const tpInsight = tx?.time_pressure_insight ?? report.time_pressure_insight;
  const rInsight = tx?.rating_insight ?? report.rating_insight;

  return (
    <SectionCard title={t("scouting_agent", lang as never)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">{t("time_pressure", lang as never)}</span>
            {sensitivity && <Chip label={sensitivity} />}
          </div>
          <KV label={t("preferred_format", lang as never)} value={report.preferred_time_control} />
          <KV label={t("strongest_bracket", lang as never)} value={report.strongest_bracket} />
          <KV label={t("weakest_bracket", lang as never)} value={report.weakest_bracket} />
        </div>
        <div className="space-y-2 text-sm text-gray-700">
          {tpInsight && <p className="italic border-l-2 border-gray-200 pl-3">{tpInsight}</p>}
          {rInsight && <p className="italic border-l-2 border-gray-200 pl-3">{rInsight}</p>}
        </div>
      </div>
      {findings && findings.length > 0 && (
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">{t("key_findings", lang as never)}</div>
          <ul className="space-y-1 text-sm text-gray-800">
            {findings.map((f, i) => <li key={i}>• {f}</li>)}
          </ul>
        </div>
      )}
    </SectionCard>
  );
}

function PatternSection({ report, tx, lang }: {
  report: PatternReport;
  tx: TranslatedContent["pattern"] | null;
  lang: string;
}) {
  const tendencies = tx?.structural_tendencies ?? report.structural_tendencies;
  const errors = tx?.recurring_error_patterns ?? report.recurring_error_patterns;
  const exploits = tx?.exploit_positions ?? report.exploit_positions;

  return (
    <SectionCard title={t("pattern_agent", lang as never)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-3">
          {tendencies && tendencies.length > 0 && (
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1">{t("structural_tendencies", lang as never)}</div>
              <ul className="space-y-0.5 text-sm text-gray-800">
                {tendencies.map((t_, i) => <li key={i}>• {t_}</li>)}
              </ul>
            </div>
          )}
          {exploits && exploits.length > 0 && (
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1">{t("exploit_positions", lang as never)}</div>
              <div className="flex flex-wrap gap-1">
                {exploits.map((p, i) => <Chip key={i} label={p} />)}
              </div>
            </div>
          )}
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">{t("opening_depth", lang as never)}</span>
            {report.opening_depth_assessment && <Chip label={report.opening_depth_assessment} />}
          </div>
          <KV label={t("book_deviation", lang as never)} value={report.book_deviation_habit} />
          <KV label={t("phase_weakness", lang as never)} value={report.dominant_phase_weakness} />
        </div>
      </div>
      {errors && errors.length > 0 && (
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1">{t("recurring_errors", lang as never)}</div>
          <ul className="space-y-0.5 text-sm text-gray-800">
            {errors.map((e, i) => <li key={i}>• {e}</li>)}
          </ul>
        </div>
      )}
    </SectionCard>
  );
}

function PsychologySection({ report, tx, lang }: {
  report: PsychologyReport;
  tx: TranslatedContent["psychology"] | null;
  lang: string;
}) {
  const profile = tx?.psychological_profile ?? report.psychological_profile;
  const strategy = tx?.exploit_strategy ?? report.exploit_strategy;
  const colorInsight = tx?.color_insight ?? report.color_insight;
  const fatigueInsight = tx?.fatigue_insight ?? report.fatigue_insight;

  return (
    <SectionCard title={t("psychology_agent", lang as never)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">{t("color_preference", lang as never)}</span>
            {report.color_preference && <Chip label={report.color_preference} />}
          </div>
          <KV label={t("critical_move_range", lang as never)} value={report.critical_move_range} />
          {report.fatigue_pattern && report.fatigue_pattern !== "none" && report.fatigue_pattern !== "null" && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Fatigue</span>
              <Chip label={`fades ${report.fatigue_pattern}`} />
            </div>
          )}
          {colorInsight && (
            <p className="text-sm text-gray-700 italic border-l-2 border-gray-200 pl-3">{colorInsight}</p>
          )}
          {fatigueInsight && (
            <p className="text-sm text-gray-700 italic border-l-2 border-gray-200 pl-3">{fatigueInsight}</p>
          )}
        </div>
        <div className="space-y-3">
          {report.comfort_zone_openings && report.comfort_zone_openings.length > 0 && (
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1">{t("comfort_zone", lang as never)}</div>
              <div className="flex flex-wrap gap-1">
                {report.comfort_zone_openings.map((o, i) => <Chip key={i} label={o} />)}
              </div>
            </div>
          )}
          {report.discomfort_zone_openings && report.discomfort_zone_openings.length > 0 && (
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1">{t("discomfort_zone", lang as never)}</div>
              <div className="flex flex-wrap gap-1">
                {report.discomfort_zone_openings.map((o, i) => <Chip key={i} label={o} />)}
              </div>
            </div>
          )}
        </div>
      </div>
      {profile && (
        <p className="text-sm text-gray-700 italic border-l-2 border-gray-200 pl-3">{profile}</p>
      )}
      {strategy && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800">
          <span className="text-xs font-medium uppercase tracking-wide text-gray-400 mr-2">{t("exploit_strategy", lang as never)}</span>
          {strategy}
        </div>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

export function ReportContent({
  report,
  opponentId,
  reportId,
}: {
  report: Report;
  opponentId: string;
  reportId: string;
}) {
  const { language } = useLanguage();
  const [reportLang, setReportLang] = useState<LangCode>("en");
  const [translated, setTranslated] = useState<TranslatedContent | null>(null);
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);

  const content = report.content ?? {};
  const plan = content.plan as StrategyPlan | undefined;
  const scoutingReport = content.scouting_report as ScoutingReport | undefined;
  const patternReport = content.pattern_report as PatternReport | undefined;
  const psychologyReport = content.psychology_report as PsychologyReport | undefined;
  const openingTree = (content.opening_tree ?? []) as OpeningTreeEntry[];
  const criticalPositions = (content.critical_positions ?? []) as object[];
  const narrative = (content.narrative ?? content.markdown ?? "") as string;

  async function handleReportLangChange(code: LangCode) {
    setReportLang(code);
    setTranslateError(null);
    if (code === "en") {
      setTranslated(null);
      return;
    }
    setTranslating(true);
    const targetLanguage = code;
    try {
      const r = await fetch(
        `${API_BASE}/opponents/${opponentId}/reports/${reportId}/translate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target_language: targetLanguage }),
        }
      );
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail ?? `HTTP ${r.status}`);
      setTranslated(data as TranslatedContent);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Translation failed";
      console.error("[translate]", msg);
      setTranslateError(msg);
      setReportLang("en");
      setTranslated(null);
    } finally {
      setTranslating(false);
    }
  }

  const lang = language as string;

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{report.title}</h1>
          <p className="text-sm text-gray-400 mt-1">
            {new Date(report.created_at).toLocaleDateString("en-US", {
              year: "numeric", month: "long", day: "numeric",
            })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {translating && (
            <span className="text-xs text-gray-400 animate-pulse">{t("translating", lang as never)}</span>
          )}
          <select
            value={reportLang}
            onChange={(e) => handleReportLangChange(e.target.value as LangCode)}
            disabled={translating || report.status !== "ready"}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-gray-200 transition-colors"
            aria-label="Translate report"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${report.status === "ready" ? "bg-emerald-500" : report.status === "failed" ? "bg-rose-500" : "bg-amber-400"}`} />
            <span className="text-xs text-gray-500 capitalize">{report.status}</span>
          </div>
        </div>
      </div>

      {translateError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Translation failed: {translateError}
        </div>
      )}

      {/* Agent sections */}
      {plan && <PlanSection plan={plan} tx={translated?.plan ?? null} lang={lang} />}

      <div className="grid gap-6 lg:grid-cols-3">
        {scoutingReport && (
          <ScoutingSection
            report={scoutingReport}
            tx={translated?.scouting ?? null}
            lang={lang}
          />
        )}
        {patternReport && (
          <PatternSection
            report={patternReport}
            tx={translated?.pattern ?? null}
            lang={lang}
          />
        )}
        {psychologyReport && (
          <PsychologySection
            report={psychologyReport}
            tx={translated?.psychology ?? null}
            lang={lang}
          />
        )}
      </div>

      {/* Opening tree */}
      {openingTree.length > 0 && <OpeningTree tree={openingTree} />}

      {/* Critical positions */}
      {criticalPositions.length > 0 && (
        <CriticalPositions
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          positions={criticalPositions as any[]}
          opponentId={opponentId}
        />
      )}

      {/* Narrative */}
      {(translated?.narrative || narrative) && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">{t("analysis", lang as never)}</h2>
          <div className="rounded-xl border border-gray-200 bg-white p-7">
            <div className="max-w-3xl">
              <Markdown>{translated?.narrative ?? narrative}</Markdown>
            </div>
          </div>
        </section>
      )}

      {/* Chat */}
      {report.status === "ready" && (
        <ReportChat opponentId={opponentId} reportId={reportId} />
      )}

      {/* Error */}
      {report.status === "failed" && content.error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-sm font-medium text-rose-700">Report generation failed</p>
          <p className="mt-1 font-mono text-xs text-rose-600">{content.error as string}</p>
        </div>
      )}
    </>
  );
}
