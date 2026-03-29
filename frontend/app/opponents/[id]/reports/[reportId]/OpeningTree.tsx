"use client";

import { useState } from "react";
import { OpeningTreeEntry, OpeningTreeStats } from "@/lib/types";

// ---------------------------------------------------------------------------
// Action styles
// ---------------------------------------------------------------------------

const ACTION = {
  steer_toward:    { label: "Steer toward", bg: "bg-gray-100 text-gray-600" },
  avoid:           { label: "Avoid",         bg: "bg-gray-100 text-gray-500" },
  surprise_weapon: { label: "Surprise",      bg: "bg-gray-100 text-gray-600" },
} as const;

// ---------------------------------------------------------------------------
// Stats mini-bar
// ---------------------------------------------------------------------------

function StatsBadge({ stats }: { stats: OpeningTreeStats }) {
  return (
    <div className="flex items-center gap-3 text-xs text-gray-400 shrink-0">
      <span>
        <span className="font-medium text-gray-500">{stats.games}</span> games
      </span>
      <span>
        Win <span className="font-medium text-gray-600">{stats.win_pct}%</span>
      </span>
      {stats.avg_cpl != null && (
        <span>
          CPL <span className="font-medium text-gray-600">{Math.round(stats.avg_cpl)}</span>
        </span>
      )}
      {stats.blunder_rate != null && (
        <span>
          Blunders <span className="font-medium text-gray-600">{stats.blunder_rate}%</span>
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Win-rate bar (visual)
// ---------------------------------------------------------------------------

function WinBar({ win_pct }: { win_pct: number }) {
  return (
    <div className="h-1 w-16 rounded-full bg-gray-100 overflow-hidden shrink-0">
      <div className="h-full rounded-full bg-gray-400" style={{ width: `${win_pct}%` }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single tree node
// ---------------------------------------------------------------------------

function TreeNode({
  entry,
  depth = 0,
  defaultOpen = false,
}: {
  entry: OpeningTreeEntry;
  depth?: number;
  defaultOpen?: boolean;
}) {
  const hasChildren = (entry.children ?? []).length > 0;
  const [open, setOpen] = useState(defaultOpen);

  const action = entry.action ? ACTION[entry.action] : null;
  const indent = depth * 24;

  return (
    <div>
      <div
        className={`group flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${
          depth > 0 ? "border-t border-gray-100" : ""
        }`}
        style={{ paddingLeft: `${16 + indent}px` }}
      >
        {/* Expand / collapse toggle */}
        <button
          onClick={() => hasChildren && setOpen((o) => !o)}
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-gray-400 transition-colors ${
            hasChildren
              ? "hover:bg-gray-200 cursor-pointer"
              : "cursor-default opacity-0"
          }`}
          aria-label={open ? "Collapse" : "Expand"}
        >
          <svg
            className={`h-3 w-3 transition-transform ${open ? "rotate-90" : ""}`}
            viewBox="0 0 12 12"
            fill="currentColor"
          >
            <path d="M4 2l5 4-5 4V2z" />
          </svg>
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1">
          {/* Top row: ECO + name + action */}
          <div className="flex flex-wrap items-center gap-2">
            {entry.eco && (
              <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-500 shrink-0">
                {entry.eco}
              </span>
            )}
            <span className={`font-medium text-gray-900 ${depth === 0 ? "text-sm" : "text-xs"}`}>
              {entry.opening_name ?? "—"}
            </span>
            {action && (
              <span className={`rounded px-2 py-0.5 text-xs shrink-0 ${action.bg}`}>
                {action.label}
              </span>
            )}
          </div>

          {/* Stats row */}
          {entry.stats && (
            <div className="flex items-center gap-3">
              <WinBar win_pct={entry.stats.win_pct} />
              <StatsBadge stats={entry.stats} />
            </div>
          )}

          {/* Reason */}
          {entry.reason && (
            <p className="text-xs text-gray-500 leading-relaxed">{entry.reason}</p>
          )}

          {/* Key moment */}
          {entry.key_moment && (
            <p className="text-xs text-gray-400 italic">
              ♟ {entry.key_moment}
            </p>
          )}
        </div>
      </div>

      {/* Children */}
      {hasChildren && open && (
        <div className="border-l-2 border-gray-100 ml-8">
          {entry.children!.map((child, i) => (
            <TreeNode key={i} entry={child} depth={depth + 1} defaultOpen={false} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Full tree
// ---------------------------------------------------------------------------

export function OpeningTree({ tree }: { tree: OpeningTreeEntry[] }) {
  if (!tree.length) return null;

  const steerToward = tree.filter((n) => n.action === "steer_toward");
  const surprise    = tree.filter((n) => n.action === "surprise_weapon");
  const avoid       = tree.filter((n) => n.action === "avoid");

  const groups = [
    { label: "Steer toward", entries: steerToward, defaultOpen: true },
    { label: "Surprise weapons", entries: surprise, defaultOpen: true },
    { label: "Avoid", entries: avoid, defaultOpen: false },
  ].filter((g) => g.entries.length > 0);

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Opening Tree</h2>

      <div className="space-y-4">
        {groups.map((group) => (
          <GroupPanel key={group.label} label={group.label} defaultOpen={group.defaultOpen}>
            <div className="divide-y divide-gray-50">
              {group.entries.map((entry, i) => (
                <TreeNode key={i} entry={entry} depth={0} defaultOpen={group.defaultOpen} />
              ))}
            </div>
          </GroupPanel>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Collapsible group panel
// ---------------------------------------------------------------------------

function GroupPanel({
  label,
  defaultOpen,
  children,
}: {
  label: string;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-2xl border">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-5 py-3 text-sm font-medium bg-gray-50 text-gray-700 hover:bg-gray-100 transition-colors"
      >
        <span>{label}</span>
        <svg
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <path d="M8 11L2 5h12L8 11z" />
        </svg>
      </button>
      {open && <div className="bg-white">{children}</div>}
    </div>
  );
}
