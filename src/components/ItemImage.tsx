"use client";

import { useT } from "@/i18n/LocaleProvider";
import { getItemName } from "@/lib/i18n-names";

// Renders an item's photo when present, otherwise falls back to its emoji.
// Single source of truth for the square tile sizes used across the app.

const SIZES = {
  sm: { box: "w-12 h-12", emoji: "text-2xl", rounded: "rounded-lg" },
  md: { box: "w-10 h-10", emoji: "text-2xl", rounded: "rounded-lg" },
  lg: { box: "w-14 h-14", emoji: "text-3xl", rounded: "rounded-2xl" },
};

export function ItemImage({
  item,
  size = "md",
  className = "",
}: {
  item: { photoUrl?: string | null; emoji?: string | null; name: string; nameHe?: string | null };
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const { locale } = useT();
  const s = SIZES[size] || SIZES.md;
  const photoUrl = item?.photoUrl;
  const emoji = item?.emoji || "🛒";

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={getItemName(item, locale)}
        loading="lazy"
        decoding="async"
        className={`${s.box} ${s.rounded} object-cover flex-shrink-0 bg-bg ${className}`}
      />
    );
  }

  return (
    <span
      className={`${s.box} ${s.rounded} ${s.emoji} flex items-center justify-center flex-shrink-0 ${className}`}
      aria-hidden="true"
    >
      {emoji}
    </span>
  );
}
