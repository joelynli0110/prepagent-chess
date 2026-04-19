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
    <div className="rounded-[28px] border border-stone-200/80 bg-[var(--surface)] p-6 shadow-[var(--shadow)]">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex items-start gap-4">
          {profile?.photo_url ? (
            <img
              src={profile.photo_url}
              alt={profile.name ?? "Player photo"}
              className="h-20 w-16 shrink-0 rounded-2xl border border-stone-200/80 object-cover shadow-sm"
            />
          ) : (
            <div className="flex h-20 w-16 shrink-0 items-center justify-center rounded-2xl border border-stone-200 bg-[var(--surface-strong)] text-lg text-[var(--foreground-muted)]">
              ?
            </div>
          )}

          <div className="min-w-0 space-y-3">
            <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--foreground-muted)]">Profile</div>
            <div className="flex flex-wrap items-center gap-2">
              {profile?.title && (
                <span className="rounded-full border border-[var(--accent-soft)] bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--accent)]">
                  {profile.title}
                </span>
              )}
              <h2 className="text-xl font-semibold tracking-tight text-[var(--foreground)]">{profile?.name ?? "Player"}</h2>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--foreground-soft)]">
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
                    className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-[var(--surface-strong)] px-2.5 py-1 text-xs text-[var(--foreground-soft)] transition-colors hover:border-stone-300 hover:bg-white hover:text-[var(--foreground)]"
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
                    className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-[var(--surface-strong)] px-2.5 py-1 text-xs text-[var(--foreground-soft)] transition-colors hover:border-stone-300 hover:bg-white hover:text-[var(--foreground)]"
                  >
                    ChessBase
                    <ExternalLinkIcon className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="grid flex-1 grid-cols-2 gap-3 lg:max-w-xs">
          <div className="rounded-2xl border border-stone-200 bg-[var(--surface-strong)] px-4 py-4">
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--foreground-muted)]">Games</div>
            <div className="mt-1 text-2xl font-semibold tracking-tight text-[var(--foreground)]">{gamesCount}</div>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-[var(--surface-strong)] px-4 py-4">
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--foreground-muted)]">Openings</div>
            <div className="mt-1 text-2xl font-semibold tracking-tight text-[var(--foreground)]">{openingsCount}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
