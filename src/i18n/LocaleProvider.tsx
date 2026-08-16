"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { getDictionary, t as translate, dirFor, type Dictionary, type Locale } from "@/i18n";

type LocaleContextValue = {
  t: (path: string, vars?: Record<string, string | number>) => string;
  d: Dictionary;
  locale: Locale;
  dir: "rtl" | "ltr";
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo<LocaleContextValue>(() => {
    const d = getDictionary(locale);
    return { d, locale, dir: dirFor(locale), t: (path, vars) => translate(d, path, vars) };
  }, [locale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useT(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useT must be used within <LocaleProvider>");
  return ctx;
}
