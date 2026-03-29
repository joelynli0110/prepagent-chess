"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { LangCode } from "./translations";

interface LanguageContextValue {
  language: LangCode;
  setLanguage: (lang: LangCode) => void;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: "en",
  setLanguage: () => {},
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<LangCode>("en");

  useEffect(() => {
    const stored = localStorage.getItem("prep_language") as LangCode | null;
    if (stored) setLanguageState(stored);
  }, []);

  function setLanguage(lang: LangCode) {
    setLanguageState(lang);
    localStorage.setItem("prep_language", lang);
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
