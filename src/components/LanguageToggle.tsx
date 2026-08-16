"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/LocaleProvider";
import { setLanguage } from "@/actions/preferences";
import type { Locale } from "@/i18n";

export function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { locale } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const switchTo = (lang: Locale) => {
    if (lang === locale || pending) return;
    startTransition(async () => {
      await setLanguage(lang);
      router.refresh();
    });
  };

  const btn = (lang: Locale, label: string) =>
    `${compact ? "px-2 py-1 text-xs" : "px-4 py-2 text-sm"} rounded-lg font-semibold transition-colors ${
      locale === lang ? "bg-primary text-white" : "text-text-secondary hover:text-text"
    }`;

  return (
    <div className={`flex items-center gap-1 rounded-xl border border-neutral bg-surface p-1 ${compact ? "p-0.5" : ""}`}>
      <button type="button" onClick={() => switchTo("en")} className={btn("en", "EN")}>
        {compact ? "EN" : "English"}
      </button>
      <button type="button" onClick={() => switchTo("he")} className={btn("he", "עב")}>
        {compact ? "עב" : "עברית"}
      </button>
    </div>
  );
}
