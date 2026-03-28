"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

// FIDE 3-letter federation code → ISO 3166-1 alpha-2 (for emoji flags)
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
      width={16}
      height={12}
      alt={code}
      title={code}
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

function ratingColor(r: number): string {
  if (r >= 2700) return "text-yellow-500 font-bold";
  if (r >= 2500) return "text-green-600 font-semibold";
  if (r >= 2400) return "text-teal-600 font-semibold";
  if (r >= 2200) return "text-blue-600 font-medium";
  if (r >= 2000) return "text-slate-500";
  return "text-gray-400";
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

  // Close dropdown on outside click
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
        const res = await fetch(
          `${API_BASE}/players/search?q=${encodeURIComponent(value.trim())}`
        );
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

  function onSelect(player: FidePlayer) {
    setSelected(player);
    setQuery(player.name);
    setDropdownOpen(false);
    setCandidates([]);
  }

  function onAddManually() {
    // Keep the typed name, clear FIDE selection
    setSelected(null);
    setDropdownOpen(false);
    setCandidates([]);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const display_name = (selected?.name ?? query).trim();
    if (!display_name) return;

    setError(null);
    setStage("creating");

    try {
      const res = await fetch(`${API_BASE}/opponents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name,
          canonical_name: selected?.fide_name ?? display_name,
        }),
      });
      if (!res.ok) throw new Error(`Could not create opponent (${res.status})`);
      const created = await res.json();

      setStage("importing");
      await fetch(`${API_BASE}/opponents/${created.id}/imports/auto`, {
        method: "POST",
      }).catch(() => {});

      router.push(`/opponents/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStage("idle");
    }
  }

  const canSubmit = stage === "idle" && (selected !== null || (noResults && query.trim().length >= 2));
  const submitLabel: Record<Stage, string> = {
    idle: "Add",
    creating: "Creating…",
    importing: "Finding games…",
  };

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border p-4 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Add Opponent</h2>
        <p className="text-sm text-gray-500">
          Search by name to find the player in the FIDE database.
        </p>
      </div>

      <div ref={containerRef} className="relative">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <input
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onFocus={() => {
                if (candidates.length > 0 || noResults) setDropdownOpen(true);
              }}
              placeholder="e.g. Magnus Carlsen"
              className="w-full rounded-xl border px-3 py-2 text-sm disabled:opacity-50"
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
            className="shrink-0 rounded-xl border px-4 py-2 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitLabel[stage]}
          </button>
        </div>

        {/* Dropdown */}
        {dropdownOpen && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border bg-white shadow-lg">
            {candidates.length > 0 ? (
              <ul>
                {[...candidates]
                  .sort((a, b) => (b.rating_std ?? 0) - (a.rating_std ?? 0))
                  .map((p) => (
                  <li key={p.fide_id}>
                    <button
                      type="button"
                      onClick={() => onSelect(p)}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-gray-50"
                    >
                      {p.title && (
                        <span className="shrink-0 text-xs font-semibold text-amber-600">
                          {p.title}
                        </span>
                      )}
                      <span className="font-medium text-gray-900">{p.name}</span>
                      <span className="ml-auto flex shrink-0 items-center gap-2 text-xs">
                        <FederationFlag code={p.federation ?? null} />
                        {p.birth_year && (
                          <span className="text-slate-400">{p.birth_year}</span>
                        )}
                        {p.rating_std != null && (
                          <span className={ratingColor(p.rating_std)}>{p.rating_std}</span>
                        )}
                        {p.rating_rapid != null && (
                          <span className={`${ratingColor(p.rating_rapid)} opacity-70`}>{p.rating_rapid}</span>
                        )}
                        {p.rating_blitz != null && (
                          <span className={`${ratingColor(p.rating_blitz)} opacity-70`}>{p.rating_blitz}</span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : noResults ? (
              <div className="space-y-0">
                <p className="px-4 py-2.5 text-sm text-gray-400">
                  No players found in FIDE database.
                </p>
                <button
                  type="button"
                  onClick={onAddManually}
                  className="flex w-full items-center gap-2 border-t px-4 py-2.5 text-left text-sm hover:bg-gray-50"
                >
                  <span className="font-medium text-gray-700">
                    Add &ldquo;{query}&rdquo; manually
                  </span>
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Selected player confirmation */}
      {selected && (
        <div className="flex items-center gap-3 rounded-xl bg-gray-50 px-4 py-2.5 text-sm">
          {selected.title && (
            <span className="text-xs font-semibold text-amber-600">{selected.title}</span>
          )}
          <span className="font-medium text-gray-900">{selected.name}</span>
          <span className="flex items-center gap-2 text-xs">
            <FederationFlag code={selected.federation ?? null} />
            {selected.birth_year && (
              <span className="text-slate-400">{selected.birth_year}</span>
            )}
            {selected.rating_std != null && (
              <span className={ratingColor(selected.rating_std)}>{selected.rating_std}</span>
            )}
            {selected.rating_rapid != null && (
              <span className={`${ratingColor(selected.rating_rapid)} opacity-70`}>{selected.rating_rapid}</span>
            )}
            {selected.rating_blitz != null && (
              <span className={`${ratingColor(selected.rating_blitz)} opacity-70`}>{selected.rating_blitz}</span>
            )}
          </span>
          <a
            href={selected.fide_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="ml-auto text-xs text-blue-500 hover:underline"
          >
            FIDE
          </a>
          <button
            type="button"
            onClick={() => { setSelected(null); setQuery(""); setNoResults(false); }}
            className="text-xs text-gray-400 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
    </form>
  );
}
