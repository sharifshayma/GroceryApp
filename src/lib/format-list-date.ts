import type { Locale } from "@/i18n";

export function formatListDate(dateISO: string, locale: Locale, nowMs: number): string {
  const d = new Date(dateISO);
  const now = new Date(nowMs);
  const dayMs = 86400000;
  const diff = nowMs - d.getTime();
  const sameUTCDay = d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth() && d.getUTCDate() === now.getUTCDate();
  if (diff < dayMs && sameUTCDay) return locale === "he" ? "היום" : "Today";
  if (diff < dayMs * 2) return locale === "he" ? "אתמול" : "Yesterday";
  return d.toLocaleDateString(locale === "he" ? "he-IL" : "en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
