"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { PlayerProfile } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

// FIDE 3-letter federation → ISO 2-letter (for flag images)
const FIDE_TO_ISO2: Record<string, string> = {
  AFG:"AF",ALB:"AL",ALG:"DZ",AND:"AD",ANG:"AO",ANT:"AG",ARG:"AR",ARM:"AM",
  AUS:"AU",AUT:"AT",AZE:"AZ",BAH:"BS",BAN:"BD",BAR:"BB",BEL:"BE",BIH:"BA",
  BLR:"BY",BOL:"BO",BOT:"BW",BRA:"BR",BUL:"BG",CAM:"KH",CAN:"CA",CHI:"CL",
  CHN:"CN",CIV:"CI",CMR:"CM",COL:"CO",CRC:"CR",CRO:"HR",CUB:"CU",CYP:"CY",
  CZE:"CZ",DEN:"DK",ECU:"EC",EGY:"EG",ENG:"GB",ESP:"ES",EST:"EE",ETH:"ET",
  FIJ:"FJ",FIN:"FI",FRA:"FR",GAB:"GA",GAM:"GM",GEO:"GE",GER:"DE",GHA:"GH",
  GRE:"GR",GUA:"GT",GUY:"GY",HAI:"HT",HON:"HN",HKG:"HK",HUN:"HU",INA:"ID",
  IND:"IN",IRL:"IE",IRN:"IR",IRQ:"IQ",ISL:"IS",ISR:"IL",ITA:"IT",JAM:"JM",
  JOR:"JO",JPN:"JP",KAZ:"KZ",KEN:"KE",KGZ:"KG",KOR:"KR",KUW:"KW",LAT:"LV",
  LBA:"LY",LBN:"LB",LIE:"LI",LTU:"LT",LUX:"LU",MAC:"MO",MAD:"MG",MAR:"MA",
  MAS:"MY",MAW:"MW",MDA:"MD",MEX:"MX",MGL:"MN",MKD:"MK",MLT:"MT",MNE:"ME",
  NED:"NL",NEP:"NP",NGR:"NG",NIG:"NE",NOR:"NO",NZL:"NZ",OMA:"OM",PAK:"PK",
  PAN:"PA",PAR:"PY",PER:"PE",PHI:"PH",PLE:"PS",PNG:"PG",POL:"PL",POR:"PT",
  PRK:"KP",PUR:"PR",QAT:"QA",ROU:"RO",RSA:"ZA",RUS:"RU",SAU:"SA",SCO:"GB",
  SEN:"SN",SGP:"SG",SLE:"SL",SLO:"SI",SVK:"SK",SRB:"RS",SRI:"LK",SUD:"SD",
  SUI:"CH",SUR:"SR",SWE:"SE",SYR:"SY",TAN:"TZ",TJK:"TJ",TKM:"TM",TOG:"TG",
  TTO:"TT",TUN:"TN",TUR:"TR",UAE:"AE",UGA:"UG",UKR:"UA",URU:"UY",USA:"US",
  UZB:"UZ",VEN:"VE",VIE:"VN",WAL:"GB",YEM:"YE",ZAM:"ZM",ZIM:"ZW",
};

function ratingColor(r: number): string {
  if (r >= 2700) return "text-yellow-500 font-bold";   // super-GM
  if (r >= 2500) return "text-green-600 font-semibold"; // GM
  if (r >= 2400) return "text-teal-600 font-semibold";  // IM
  if (r >= 2200) return "text-blue-600 font-medium";    // FM / NM
  if (r >= 2000) return "text-slate-600 font-medium";   // club
  return "text-gray-400";
}

function FlagImg({ code }: { code: string | null | undefined }) {
  const iso2 = code ? FIDE_TO_ISO2[code.toUpperCase()] : null;
  if (!iso2) return null;
  return (
    <img
      src={`https://flagcdn.com/20x15/${iso2.toLowerCase()}.png`}
      width={20}
      height={15}
      alt={code ?? ""}
      title={code ?? ""}
    />
  );
}

export function PlayerProfileCard({
  opponentId,
  profile,
}: {
  opponentId: string;
  profile: PlayerProfile | null | undefined;
}) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  async function onRefresh() {
    setRefreshing(true);
    await fetch(`${API_BASE}/opponents/${opponentId}/profile/refresh`, {
      method: "POST",
    }).catch(() => {});
    setRefreshing(false);
    router.refresh();
  }

  // Auto-fetch on mount if no profile is stored yet
  useEffect(() => {
    if (!profile) {
      onRefresh();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!profile) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border p-5 text-sm text-gray-400">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-gray-300" />
        Loading player profile…
      </div>
    );
  }

  return (
    <div className="flex items-start gap-5 rounded-2xl border p-5">
      {/* Avatar */}
      {profile.photo_url ? (
        <img
          src={profile.photo_url}
          alt={profile.name ?? "Player photo"}
          className="h-24 w-20 shrink-0 rounded-xl object-cover"
        />
      ) : (
        <div className="flex h-24 w-20 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-3xl text-gray-300">
          ♟
        </div>
      )}

      {/* Info */}
      <div className="min-w-0 flex-1 space-y-2">
        {/* Name + title */}
        <div className="flex items-center gap-2">
          {profile.title && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-700">
              {profile.title}
            </span>
          )}
          <h2 className="text-xl font-semibold text-gray-900">
            {profile.name}
          </h2>
        </div>

        {/* Meta rows */}
        <div className="space-y-1 text-sm text-gray-600">
          {profile.federation && (
            <div className="flex items-center gap-1.5">
              <FlagImg code={profile.federation} />
              <span>{profile.nationality ?? profile.federation}</span>
            </div>
          )}
          {(profile.age != null || profile.birth_year != null) && (
            <div>
              Age: {profile.age ?? "—"}
              {profile.birth_year && (
                <span className="ml-1 text-gray-400">(Born in: {profile.birth_year})</span>
              )}
            </div>
          )}
          {profile.gender && <div>Gender: {profile.gender}</div>}
          {(profile.rating_std != null || profile.rating_rapid != null || profile.rating_blitz != null) && (
            <div className="flex flex-wrap gap-4">
              {profile.rating_std != null && (
                <span>
                  <span className="text-gray-400">ELO </span>
                  <span className={ratingColor(profile.rating_std)}>{profile.rating_std}</span>
                </span>
              )}
              {profile.rating_rapid != null && (
                <span>
                  <span className="text-gray-400">Rapid </span>
                  <span className={ratingColor(profile.rating_rapid)}>{profile.rating_rapid}</span>
                </span>
              )}
              {profile.rating_blitz != null && (
                <span>
                  <span className="text-gray-400">Blitz </span>
                  <span className={ratingColor(profile.rating_blitz)}>{profile.rating_blitz}</span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Links */}
        <div className="flex items-center gap-3 text-xs">
          {profile.chessbase_url && (
            <a
              href={profile.chessbase_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-gray-700 hover:underline"
            >
              ChessBase
            </a>
          )}
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="ml-auto text-gray-300 hover:text-gray-500 disabled:opacity-50"
            title="Refresh profile"
          >
            {refreshing ? "…" : "↻"}
          </button>
        </div>
      </div>
    </div>
  );
}
