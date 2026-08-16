import type { Locale } from "@/i18n";

type Named = { name: string; nameHe?: string | null };

export function getItemName(item: Named, locale: Locale): string {
  if (locale === "he") return item.nameHe?.trim() ? item.nameHe : item.name;
  return item.name;
}

export function getCategoryName(cat: Named, locale: Locale): string {
  return getItemName(cat, locale);
}
