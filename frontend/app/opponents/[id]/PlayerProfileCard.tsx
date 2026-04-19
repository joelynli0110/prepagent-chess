"use client";

import type { PlayerProfile } from "@/lib/types";
import { ExternalLinkIcon } from "./Icons";

function FlagImg({ iso2 }: { iso2: string | null | undefined }) {
  if (!iso2) return null;
  return <img src={`https://flagcdn.com/20x15/${iso2.toLowerCase()}.png`} width={20} height={15} alt={iso2} />;
}

export function PlayerProfileCard({
  profile,
  gamesCount,
  openingsCount,
}: {
  profile: PlayerProfile | null | undefined;
  gamesCount: number;
  openingsCount: number;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="flex items-start gap-4">
          {profile?.photo_url ? (
            <img
              src={profile.photo_url}
              alt={profile.name ?? "Player photo"}
              className="h-16 w-14 shrink-0 rounded-xl object-cover"
            />
          ) : (
            <div className="flex h-16 w-14 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-lg text-gray-300">
              ?
            </div>
          )}

          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {profile?.title && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                  {profile.title}
                </span>
              )}
              <h2 className="text-lg font-semibold text-gray-900">{profile?.name ?? "Player"}</h2>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
              {(profile?.federation_iso2 || profile?.nationality || profile?.federation) && (
                <span className="flex items-center gap-1.5">
                  <FlagImg iso2={profile?.federation_iso2 ?? null} />
                  {profile?.nationality ?? profile?.federation}
                </span>
              )}
              {profile?.birth_year && <span>b. {profile.birth_year}</span>}
              {profile?.rating_std != null && <span>Std {profile.rating_std}</span>}
              {profile?.rating_rapid != null && <span>Rapid {profile.rating_rapid}</span>}
              {profile?.rating_blitz != null && <span>Blitz {profile.rating_blitz}</span>}
            </div>

            {(profile?.fide_url || profile?.chessbase_url) && (
              <div className="flex flex-wrap gap-2 pt-1">
                {profile.fide_url && (
                  <a
                    href={profile.fide_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2.5 py-1 text-xs text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-700"
                  >
                    FIDE
                    <ExternalLinkIcon className="h-3.5 w-3.5" />
                  </a>
                )}
                {profile.chessbase_url && (
                  <a
                    href={profile.chessbase_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2.5 py-1 text-xs text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-700"
                  >
                    ChessBase
                    <ExternalLinkIcon className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="grid flex-1 grid-cols-2 gap-2 lg:max-w-xs">
          <div className="rounded-xl bg-gray-50 px-4 py-3">
            <div className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Games</div>
            <div className="mt-1 text-2xl font-semibold text-gray-900">{gamesCount}</div>
          </div>
          <div className="rounded-xl bg-gray-50 px-4 py-3">
            <div className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Openings</div>
            <div className="mt-1 text-2xl font-semibold text-gray-900">{openingsCount}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
