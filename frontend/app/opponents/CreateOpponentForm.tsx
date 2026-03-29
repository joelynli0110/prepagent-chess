"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

const FIDE_TO_ISO2: Record<string, string> = {
  AFG:"AF", ALB:"AL", ALG:"DZ", AND:"AD", ANG:"AO", ANT:"AG", ARG:"AR",
  ARM:"AM", AUS:"AU", AUT:"AT", AZE:"AZ", BAH:"BS", BAN:"BD", BAR:"BB",
  BEL:"BE", BIH:"BA", BLR:"BY", BOL:"BO", BOT:"BW", BRA:"BR", BUL:"BG",
  CAM:"KH", CAN:"CA", CHI:"CL", CHN:"CN", CIV:"CI", CMR:"CM", COL:"CO",
  CRC:"CR", CRO:"HR", CUB:"CU", CYP:"CY", CZE:"CZ", DEN:"DK", ECU:"EC",
  EGY:"EG", ENG:"GB", ESP:"ES", EST:"EE", ETH:"ET", FIJ:"FJ", FIN:"FI",
  FRA:"FR", GAB:"GA", GAM:"GM", GEO:"GE", GER:"DE", GHA:"GH", GRE:"GR",
  GUA:"GT", GUY:"GY", HAI:"HT", HON:"HN", HKG:"HK", HUN:"HU", INA:"ID",
  IND:"IN", IRL:"IE", IRN:"IR", IRQ:"IQ", ISL:"IS", ISR:"IL", ITA:"IT",
  JAM:"JM", JOR:"JO", JPN:"JP", KAZ:"KZ", KEN:"KE", KGZ:"KG", KOR:"KR",
  KUW:"KW", LAT:"LV", LBA:"LY", LBN:"LB", LIE:"LI", LTU:"LT", LUX:"LU",
  MAC:"MO", MAD:"MG", MAR:"MA", MAS:"MY", MAW:"MW", MDA:"MD", MEX:"MX",
  MGL:"MN", MKD:"MK", MLT:"MT", MNE:"ME", MOZ:"MZ", MRI:"MU", MYA:"MM",
  NAM:"NA", NCA:"NI", NED:"NL", NEP:"NP", NGR:"NG", NIG:"NE", NOR:"NO",
  NZL:"NZ", OMA:"OM", PAK:"PK", PAN:"PA", PAR:"PY", PER:"PE", PHI:"PH",
  PLE:"PS", PNG:"PG", POL:"PL", POR:"PT", PRK:"KP", PUR:"PR", QAT:"QA",
  ROU:"RO", RSA:"ZA", RUS:"RU", SAU:"SA", SCO:"GB", SEN:"SN", SGP:"SG",
  SLE:"SL", SLO:"SI", SVK:"SK", SRB:"RS", SRI:"LK", SUD:"SD", SUI:"CH",
  SUR:"SR", SWE:"SE", SYR:"SY", TAN:"TZ", TJK:"TJ", TKM:"TM", TOG:"TG",
  TTO:"TT", TUN:"TN", TUR:"TR", UAE:"AE", UGA:"UG", UKR:"UA", URU:"UY",
  USA:"US", UZB:"UZ", VEN:"VE", VIE:"VN", WAL:"GB", YEM:"YE", ZAM:"ZM",
  ZIM:"ZW",
};

function FederationFlag({ code }: { code: string | null }) {
  if (!code) return null;
  const iso2 = FIDE_TO_ISO2[code.toUpperCase()];
  if (!iso2) return <span className="text-xs text-gray-400">{code}</span>;
  return (
    <img
      src={`https://flagcdn.com/16x12/${iso2.toLowerCase()}.png`}
      width={16} height={12} alt={code} title={code}
      className="inline-block"
    />
  );
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

type Stage = "idle" | "creating" | "importing";

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
      setCandidates([]); setDropdownOpen(false); setSearching(false); return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/players/search?q=${encodeURIComponent(value.trim())}`);
        if (!res.ok) throw new Error();
        const data: FidePlayer[] = await res.json();
        setCandidates(data); setNoResults(data.length === 0); setDropdownOpen(true);
      } catch {
        setCandidates([]); setNoResults(true); setDropdownOpen(true);
      } finally { setSearching(false); }
    }, 300);
  }

  function onSelect(player: FidePlayer) {
    setSelected(player); setQuery(player.name); setDropdownOpen(false); setCandidates([]);
  }

  function onAddManually() {
    setSelected(null); setDropdownOpen(false); setCandidates([]);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const display_name = (selected?.name ?? query).trim();
    if (!display_name) return;
    setError(null); setStage("creating");
    try {
      const res = await fetch(`${API_BASE}/opponents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name, canonical_name: selected?.fide_name ?? display_name }),
      });
      if (!res.ok) throw new Error(`Could not create opponent (${res.status})`);
      const created = await res.json();
      // Navigate immediately — the space page will trigger scouting on load
      router.push(`/opponents/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStage("idle");
    }
  }

  const canSubmit = stage === "idle" && (selected !== null || (noResults && query.trim().length >= 2));
  const submitLabel: Record<Stage, string> = { idle: "Add opponent", creating: "Creating…" };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">Add opponent</h2>
        <p className="text-xs text-gray-400 mt-0.5">Search by name to find the player in the FIDE database.</p>
      </div>

      <form onSubmit={onSubmit}>
        <div ref={containerRef} className="relative">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                onFocus={() => { if (candidates.length > 0 || noResults) setDropdownOpen(true); }}
                placeholder="e.g. Magnus Carlsen"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:opacity-50"
                disabled={stage !== "idle"}
                autoComplete="off"
              />
              {searching && (
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                  Searching…
                </span>
              )}
            </div>
            <button
              type="submit"
              disabled={!canSubmit}
              className="shrink-0 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
            >
              {submitLabel[stage]}
            </button>
          </div>

          {dropdownOpen && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
              {candidates.length > 0 ? (
                <ul>
                  {[...candidates]
                    .sort((a, b) => (b.rating_std ?? 0) - (a.rating_std ?? 0))
                    .map((p) => (
                    <li key={p.fide_id}>
                      <button
                        type="button"
                        onClick={() => onSelect(p)}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-gray-50 transition-colors"
                      >
                        {p.title && (
                          <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-semibold text-gray-600">
                            {p.title}
                          </span>
                        )}
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
                  <p className="px-4 py-2.5 text-sm text-gray-400">No players found in FIDE database.</p>
                  <button
                    type="button"
                    onClick={onAddManually}
                    className="flex w-full items-center gap-2 border-t border-gray-100 px-4 py-2.5 text-left text-sm hover:bg-gray-50 transition-colors"
                  >
                    <span className="font-medium text-gray-700">Add &ldquo;{query}&rdquo; manually</span>
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {selected && (
          <div className="mt-3 flex items-center gap-3 rounded-lg bg-gray-50 border border-gray-200 px-4 py-2.5 text-sm">
            {selected.title && (
              <span className="rounded bg-gray-200 px-1.5 py-0.5 text-xs font-semibold text-gray-700">{selected.title}</span>
            )}
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
              className="ml-auto text-xs text-gray-400 hover:text-gray-700 hover:underline"
            >
              FIDE ↗
            </a>
            <button
              type="button"
              onClick={() => { setSelected(null); setQuery(""); setNoResults(false); }}
              className="text-gray-300 hover:text-gray-600 transition-colors"
              aria-label="Clear selection"
            >
              ✕
            </button>
          </div>
        )}

        {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
      </form>
    </div>
  );
}
