"use client";

import type { PlayerProfile } from "@/lib/types";

function FlagImg({ iso2 }: { iso2: string | null | undefined }) {
  if (!iso2) return null;
  return (
    <img
      src={`https://flagcdn.com/20x15/${iso2.toLowerCase()}.png`}
      width={20} height={15} alt={iso2}
    />
  );
}

export function PlayerProfileCard({
  profile,
}: {
  opponentId: string;
  profile: PlayerProfile | null | undefined;
}) {
  if (!profile) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-400">
        <span className="inline-block h-2 w-2 rounded-full bg-gray-200" />
        No profile data available.
      </div>
    );
  }

  return (
    <div className="flex items-start gap-5 rounded-xl border border-gray-200 bg-white p-5">
      {profile.photo_url ? (
        <img
          src={profile.photo_url}
          alt={profile.name ?? "Player photo"}
          className="h-20 w-16 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <div className="flex h-20 w-16 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-2xl text-gray-300">
          ♟
        </div>
      )}

      <div className="min-w-0 flex-1 space-y-2.5">
        <div className="flex items-center gap-2">
          {profile.title && (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-semibold text-gray-600">
              {profile.title}
            </span>
          )}
          <h2 className="text-lg font-semibold text-gray-900">{profile.name}</h2>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-gray-600">
          {(profile.federation_iso2 || profile.nationality || profile.federation) && (
            <span className="flex items-center gap-1.5">
              <FlagImg iso2={profile.federation_iso2 ?? null} />
              {profile.nationality ?? profile.federation}
            </span>
          )}
          {profile.birth_year && (
            <span className="text-gray-400">b. {profile.birth_year}</span>
          )}
          {profile.gender && (
            <span className="text-gray-400">{profile.gender}</span>
          )}

          {(profile.rating_std != null || profile.rating_rapid != null || profile.rating_blitz != null) && (
            <span className="flex items-center gap-3">
              {profile.rating_std != null && (
                <span>
                  <span className="text-gray-400 text-xs">Classical </span>
                  <span className="font-semibold text-gray-900">{profile.rating_std}</span>
                </span>
              )}
              {profile.rating_rapid != null && (
                <span>
                  <span className="text-gray-400 text-xs">Rapid </span>
                  <span className="font-medium text-gray-700">{profile.rating_rapid}</span>
                </span>
              )}
              {profile.rating_blitz != null && (
                <span>
                  <span className="text-gray-400 text-xs">Blitz </span>
                  <span className="font-medium text-gray-700">{profile.rating_blitz}</span>
                </span>
              )}
            </span>
          )}
        </div>

        {profile.fide_url && (
          <a
            href={profile.fide_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-400 hover:text-gray-700 hover:underline transition-colors"
          >
            FIDE profile ↗
          </a>
        )}
      </div>
    </div>
  );
}
