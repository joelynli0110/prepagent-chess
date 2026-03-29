"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { t } from "@/lib/translations";

/** Inline translation component — use inside server components for static UI strings. */
export function T({ k }: { k: string }) {
  const { language } = useLanguage();
  return <>{t(k, language)}</>;
}
