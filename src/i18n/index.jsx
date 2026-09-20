import React, { createContext, useContext, useEffect, useState } from "react";
import { DICTIONARIES, SUPPORTED_LANGUAGES } from "./dictionaries";

const STORAGE_KEY = "hmc_language";
const I18nContext = createContext(null);

export function isSupportedLanguage(code) {
  return SUPPORTED_LANGUAGES.some((l) => l.code === code);
}

// The single central language controller: reads, validates, persists, and broadcasts the active language.
export function I18nProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    const stored = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    return isSupportedLanguage(stored) ? stored : "es";
  });

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = "ltr";
  }, [language]);

  const setLanguage = (code) => {
    if (!isSupportedLanguage(code)) return; // unsupported codes preserve the current language
    setLanguageState(code);
    try { localStorage.setItem(STORAGE_KEY, code); } catch (e) { /* preference is non-essential */ }
  };

  const t = (key, params) => {
    let value = DICTIONARIES[language]?.[key] ?? DICTIONARIES.en[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        value = value.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), String(v));
      }
    }
    return value;
  };

  return <I18nContext.Provider value={{ language, setLanguage, t, supportedLanguages: SUPPORTED_LANGUAGES }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

export { SUPPORTED_LANGUAGES };