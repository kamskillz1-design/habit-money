import React, { createContext, useContext, useEffect, useState } from "react";
import { DICTIONARIES, SUPPORTED_LANGUAGES } from "./dictionaries";

const STORAGE_KEY = "hmc_language";
const I18nContext = createContext(null);

export function isSupportedLanguage(code) {
  return SUPPORTED_LANGUAGES.some((l) => l.code === code);
}

export function readStoredLanguage() {
  try {
    const stored = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    return isSupportedLanguage(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function persistLanguage(code) {
  if (!isSupportedLanguage(code)) return;
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* preference is non-essential */
  }
}

function applyParams(value, params) {
  if (!params || typeof value !== "string") return value;
  let out = value;
  for (const [k, v] of Object.entries(params)) {
    const s = String(v);
    out = out.replaceAll("{{ " + k + " }}", s);
    out = out.replaceAll("{{" + k + "}}", s);
    out = out.replaceAll("{" + k + "}", s);
  }
  return out;
}

export function I18nProvider({ children }) {
  const [language, setLanguageState] = useState(() => readStoredLanguage() || "es");

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = "ltr";
    persistLanguage(language);
  }, [language]);

  const setLanguage = (code) => {
    if (!isSupportedLanguage(code)) return;
    persistLanguage(code);
    setLanguageState(code);
  };

  const t = (key, params) => {
    const value = DICTIONARIES[language]?.[key] ?? DICTIONARIES.en[key] ?? key;
    return applyParams(value, params);
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t, supportedLanguages: SUPPORTED_LANGUAGES }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

export { SUPPORTED_LANGUAGES, STORAGE_KEY };
