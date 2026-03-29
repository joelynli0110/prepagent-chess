"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { LANGUAGES, LangCode } from "@/lib/translations";

export function LanguageSelector() {
  const { language, setLanguage } = useLanguage();

  return (
    <select
      value={language}
      onChange={(e) => setLanguage(e.target.value as LangCode)}
      className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 transition-colors"
      aria-label="Select language"
    >
      {LANGUAGES.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label}
        </option>
      ))}
    </select>
  );
}
