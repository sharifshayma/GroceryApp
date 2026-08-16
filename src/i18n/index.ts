import { he } from "./dictionaries/he";
import { en } from "./dictionaries/en";

export type Locale = "en" | "he";
export type Dictionary = typeof en;

export function getDictionary(locale: Locale): Dictionary {
  return locale === "en" ? en : he;
}

export function dirFor(locale: Locale): "rtl" | "ltr" {
  return locale === "en" ? "ltr" : "rtl";
}

export function t(
  dict: Dictionary,
  path: string,
  vars?: Record<string, string | number>,
): string {
  const raw = path
    .split(".")
    .reduce<unknown>(
      (o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined),
      dict,
    );
  if (typeof raw !== "string") return path;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}
