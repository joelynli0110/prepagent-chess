"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { OpponentSpace } from "@/lib/types";
import { ExternalLinkIcon, PlusIcon, SearchIcon, XIcon } from "./Icons";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

const FIDE_TO_ISO2: Record<string, string> = {
  AFG: "AF", ALB: "AL", ALG: "DZ", AND: "AD", ANG: "AO", ANT: "AG", ARG: "AR",
  ARM: "AM", AUS: "AU", AUT: "AT", AZE: "AZ", BAH: "BS", BAN: "BD", BAR: "BB",
  BEL: "BE", BIH: "BA", BLR: "BY", BOL: "BO", BOT: "BW", BRA: "BR", BUL: "BG",
  CAM: "KH", CAN: "CA", CHI: "CL", CHN: "CN", CIV: "CI", CMR: "CM", COL: "CO",
  CRC: "CR", CRO: "HR", CUB: "CU", CYP: "CY", CZE: "CZ", DEN: "DK", ECU: "EC",
  EGY: "EG", ENG: "GB", ESP: "ES", EST: "EE", ETH: "ET", FIJ: "FJ", FIN: "FI",
  FRA: "FR", GAB: "GA", GAM: "GM", GEO: "GE", GER: "DE", GHA: "GH", GRE: "GR",
  GUA: "GT", GUY: "GY", HAI: "HT", HON: "HN", HKG: "HK", HUN: "HU", INA: "ID",
  IND: "IN", IRL: "IE", IRN: "IR", IRQ: "IQ", ISL: "IS", ISR: "IL", ITA: "IT",
  JAM: "JM", JOR: "JO", JPN: "JP", KAZ: "KZ", KEN: "KE", KGZ: "KG", KOR: "KR",
  KUW: "KW", LAT: "LV", LBA: "LY", LBN: "LB", LIE: "LI", LTU: "LT", LUX: "LU",
  MAC: "MO", MAD: "MG", MAR: "MA", MAS: "MY", MAW: "MW", MDA: "MD", MEX: "MX",
  MGL: "MN", MKD: "MK", MLT: "MT", MNE: "ME", MOZ: "MZ", MRI: "MU", MYA: "MM",
  NAM: "NA", NCA: "NI", NED: "NL", NEP: "NP", NGR: "NG", NIG: "NE", NOR: "NO",
  NZL: "NZ", OMA: "OM", PAK: "PK", PAN: "PA", PAR: "PY", PER: "PE", PHI: "PH",
  PLE: "PS", PNG: "PG", POL: "PL", POR: "PT", PRK: "KP", PUR: "PR", QAT: "QA",
  ROU: "RO", RSA: "ZA", RUS: "RU", SAU: "SA", SCO: "GB", SEN: "SN", SGP: "SG",
  SLE: "SL", SLO: "SI", SVK: "SK", SRB: "RS", SRI: "LK", SUD: "SD", SUI: "CH",
  SUR: "SR", SWE: "SE", SYR: "SY", TAN: "TZ", TJK: "TJ", TKM: "TM", TOG: "TG",
  TTO: "TT", TUN: "TN", TUR: "TR", UAE: "AE", UGA: "UG", UKR: "UA", URU: "UY",
  USA: "US", UZB: "UZ", VEN: "VE", VIE: "VN", WAL: "GB", YEM: "YE", ZAM: "ZM",
  ZIM: "ZW",
};

function FederationFlag({ code }: { code: string | null }) {
  if (!code) return null;
  const iso2 = FIDE_TO_ISO2[code.toUpperCase()];
  if (!iso2) return <span className="text-xs text-gray-400">{code}</span>;
  return <img src={`https://flagcdn.com/16x12/${iso2.toLowerCase()}.png`} width={16} height={12} alt={code} title={code} className="inline-block" />;
}

interface FidePlayer {
  fide_id: number;
  name: string;
  fide_name: string;
  title: string | null;
  federation: string | null;
  birth_year: number | null;
  rating_std: number | null;
  rating_rapid: number | null;
  rating_blitz: number | null;
  fide_url: string;
}

type Stage = "idle" | "creating";

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/[^\p{L}\p{N}\s]+/gu, " ").replace(/\s+/g, " ");
}

function candidateScore(player: FidePlayer, query: string): number {
  const q = normalizeName(query);
  const name = normalizeName(player.name);
  const fideName = normalizeName(player.fide_name);

  if (!q) return 0;
  if (name === q) return 1000;
  if (fideName === q) return 980;
  if (name.startsWith(q)) return 920;
  if (fideName.startsWith(q)) return 900;

  const qTokens = q.split(" ").filter(Boolean);
  const nameTokens = new Set(name.split(" ").filter(Boolean));
  const fideTokens = new Set(fideName.split(" ").filter(Boolean));

  const allNameTokensMatch = qTokens.length > 0 && qTokens.every((token) => nameTokens.has(token));
  const allFideTokensMatch = qTokens.length > 0 && qTokens.every((token) => fideTokens.has(token));
  if (allNameTokensMatch) return 840;
  if (allFideTokensMatch) return 820;

  if (name.includes(q)) return 760;
  if (fideName.includes(q)) return 740;

  let partial = 0;
  for (const token of qTokens) {
    if (name.includes(token)) partial += 40;
    else if (fideName.includes(token)) partial += 30;
  }
  return partial;
}

export function CreateOpponentForm() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<FidePlayer[]>([]);
  const [searching, setSearching] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selected, setSelected] = useState<FidePlayer | null>(null);
  const [noResults, setNoResults] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sortedCandidates = useMemo(
    () =>
      [...candidates].sort((a, b) => {
        const scoreDiff = candidateScore(b, query) - candidateScore(a, query);
        if (scoreDiff !== 0) return scoreDiff;
        return (b.rating_std ?? 0) - (a.rating_std ?? 0);
      }),
    [candidates, query]
  );

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function onQueryChange(value: string) {
    setQuery(value);
    setSelected(null);
    setNoResults(false);
    setError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) {
      setCandidates([]);
      setDropdownOpen(false);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/players/search?q=${encodeURIComponent(value.trim())}`);
        if (!res.ok) throw new Error();
        const data: FidePlayer[] = await res.json();
        setCandidates(data);
        setNoResults(data.length === 0);
        setDropdownOpen(true);
      } catch {
        setCandidates([]);
        setNoResults(true);
        setDropdownOpen(true);
      } finally {
        setSearching(false);
      }
    }, 300);
  }

  async function createOpponent(display_name: string, canonical_name: string, player?: FidePlayer | null) {
    setError(null);
    setStage("creating");
    try {
      if (player?.fide_id) {
        const existingRes = await fetch(`${API_BASE}/opponents`, { cache: "no-store" });
        if (!existingRes.ok) throw new Error(`Could not check existing opponents (${existingRes.status})`);
        const existingOpponents: OpponentSpace[] = await existingRes.json();
        const existing = existingOpponents.find((opponent) => opponent.profile_data?.fide_id === player.fide_id);
        if (existing) {
          router.push(`/opponents/${existing.id}`);
          return;
        }
      }

      const res = await fetch(`${API_BASE}/opponents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name,
          canonical_name,
          profile_data: player
            ? {
                fide_id: player.fide_id,
                name: player.name,
                title: player.title,
                federation: player.federation,
                birth_year: player.birth_year,
                rating_std: player.rating_std,
                rating_rapid: player.rating_rapid,
                rating_blitz: player.rating_blitz,
                fide_url: player.fide_url,
              }
            : undefined,
        }),
      });
      if (!res.ok) throw new Error(`Could not create opponent (${res.status})`);
      const created = await res.json();
      router.push(`/opponents/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStage("idle");
    }
  }

  async function onSelect(player: FidePlayer) {
    setSelected(player);
    setQuery(player.name);
    setDropdownOpen(false);
    setCandidates([]);
    await createOpponent(player.name, player.fide_name ?? player.name, player);
  }

  function onAddManually() {
    setSelected(null);
    setDropdownOpen(false);
    setCandidates([]);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const display_name = (selected?.name ?? query).trim();
    if (!display_name) return;
    await createOpponent(display_name, selected?.fide_name ?? display_name, selected);
  }

  const canSubmit = stage === "idle" && (selected !== null || (noResults && query.trim().length >= 2));

  return (
    <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <form onSubmit={onSubmit}>
        <div ref={containerRef} className="relative space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-300" />
              <input
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                onFocus={() => {
                  if (candidates.length > 0 || noResults) setDropdownOpen(true);
                }}
                placeholder="Search FIDE player"
                className="w-full rounded-full border border-gray-200 bg-white py-2 pl-10 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:opacity-50"
                disabled={stage !== "idle"}
                autoComplete="off"
              />
              {searching && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">...</span>}
            </div>
            <button
              type="submit"
              disabled={!canSubmit}
              title="Add opponent"
              className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-gray-900 text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <PlusIcon className="h-4 w-4" />
              <span className="sr-only">Add opponent</span>
            </button>
          </div>

          {dropdownOpen && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
              {candidates.length > 0 ? (
                <ul>
                  {sortedCandidates.map((p) => (
                      <li key={p.fide_id}>
                        <button
                          type="button"
                          onClick={() => onSelect(p)}
                          className="flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-left text-sm transition-colors hover:bg-gray-50"
                        >
                          {p.title && <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">{p.title}</span>}
                          <span className="font-medium text-gray-900">{p.name}</span>
                          <span className="ml-auto flex shrink-0 items-center gap-2 text-xs text-gray-400">
                            <FederationFlag code={p.federation ?? null} />
                            {p.birth_year && <span>{p.birth_year}</span>}
                            {p.rating_std != null && <span className="font-medium text-gray-600">{p.rating_std}</span>}
                          </span>
                        </button>
                      </li>
                    ))}
                </ul>
              ) : noResults ? (
                <div>
                  <p className="px-4 py-3 text-sm text-gray-400">No FIDE match.</p>
                  <button
                    type="button"
                    onClick={onAddManually}
                    className="flex w-full cursor-pointer items-center gap-2 border-t border-gray-100 px-4 py-3 text-left text-sm transition-colors hover:bg-gray-50"
                  >
                    <span className="font-medium text-gray-700">Add &ldquo;{query}&rdquo;</span>
                  </button>
                </div>
              ) : null}
            </div>
          )}

          {selected && (
            <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm">
              {selected.title && <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-semibold text-gray-700">{selected.title}</span>}
              <span className="font-medium text-gray-900">{selected.name}</span>
              <span className="flex items-center gap-2 text-xs text-gray-500">
                <FederationFlag code={selected.federation ?? null} />
                {selected.birth_year && <span>{selected.birth_year}</span>}
                {selected.rating_std != null && <span className="font-medium">{selected.rating_std}</span>}
              </span>
              <a
                href={selected.fide_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="ml-auto inline-flex items-center gap-1 text-xs text-gray-400 transition-colors hover:text-gray-700"
              >
                FIDE
                <ExternalLinkIcon className="h-3.5 w-3.5" />
              </a>
              <button
                type="button"
                onClick={() => {
                  setSelected(null);
                  setQuery("");
                  setNoResults(false);
                }}
                className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-gray-300 transition-colors hover:bg-white hover:text-gray-600"
                aria-label="Clear selection"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
          )}

          {error && <p className="text-xs text-rose-600">{error}</p>}
        </div>
      </form>
    </div>
  );
}
