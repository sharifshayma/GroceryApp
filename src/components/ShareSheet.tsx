"use client";

import { useState } from "react";
import { useT } from "@/i18n/LocaleProvider";
import { BottomSheet } from "@/components/BottomSheet";
import { getCategoryName, getItemName } from "@/lib/i18n-names";
import { IconShare, IconCopy, IconLink, IconClose } from "@/components/Icons";

interface ShareCategory {
  name: string;
  nameHe: string | null;
  emoji: string;
}

interface ShareItem {
  name: string;
  nameHe: string | null;
  emoji: string;
  category: ShareCategory | null;
}

interface ShareListItemRow {
  item: ShareItem | null;
  isBought: boolean;
  quantity: number;
  unit: string;
  notes: string | null;
}

export function ShareSheet({
  list,
  onClose,
}: {
  list: { id: string; name: string; items: ShareListItemRow[] };
  onClose: () => void;
}) {
  const { locale } = useT();
  const isHe = locale === "he";
  const [copied, setCopied] = useState<"text" | "link" | null>(null);

  const items = list.items;

  // Group by category
  const grouped = new Map<string, ShareListItemRow[]>();
  items.forEach((li) => {
    const catName = li.item?.category ? getCategoryName(li.item.category, locale) : isHe ? "אחר" : "Other";
    const catEmoji = li.item?.category?.emoji || "📦";
    const key = `${catEmoji} ${catName}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(li);
  });

  const buildText = () => {
    let text = `🛒 ${list.name}\n\n`;
    grouped.forEach((catItems, cat) => {
      text += `${cat}\n`;
      catItems.forEach((li) => {
        const check = li.isBought ? "✅" : "⬜";
        let line = `${check} ${(li.item ? getItemName(li.item, locale) : null) || "?"} × ${li.quantity} ${li.unit}`;
        if (li.notes) line += ` (${li.notes})`;
        text += `${line}\n`;
      });
      text += "\n";
    });
    return text.trim();
  };

  const handleShareText = async () => {
    const text = buildText();
    if (navigator.share) {
      try {
        await navigator.share({ text });
        onClose();
        return;
      } catch {}
    }
    await navigator.clipboard.writeText(text);
    setCopied("text");
    setTimeout(() => setCopied(null), 2000);
  };

  const handleCopyText = async () => {
    const text = buildText();
    await navigator.clipboard.writeText(text);
    setCopied("text");
    setTimeout(() => setCopied(null), 2000);
  };

  const buildShareLinkText = () => {
    const itemNames = items.map((li) => (li.item ? getItemName(li.item, locale) : null) || "?");
    const total = itemNames.length;
    const preview = itemNames.slice(0, 3).join(", ");
    const more = total > 3;

    let message;
    if (isHe) {
      message = `🛒 שיתפתי איתך רשימת קניות — ${total} פריטים`;
      if (total > 0) message += ` כולל ${preview}${more ? " ועוד" : ""}`;
    } else {
      message = `🛒 I shared a grocery list with you — ${total} item${total !== 1 ? "s" : ""}`;
      if (total > 0) message += ` including ${preview}${more ? " & more" : ""}`;
    }

    return `${message}\n${window.location.origin}/lists/${list.id}`;
  };

  const handleShareLink = async () => {
    const text = buildShareLinkText();
    if (navigator.share) {
      try {
        await navigator.share({ text });
        onClose();
        return;
      } catch {}
    }
    await navigator.clipboard.writeText(text);
    setCopied("link");
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <BottomSheet onClose={onClose}>
      <div className="px-5 pt-5 pb-3 border-b border-neutral/50 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text">{isHe ? "שתף רשימה" : "Share List"}</h2>
        <button
          onClick={onClose}
          className="w-11 h-11 rounded-full bg-neutral/30 flex items-center justify-center text-text hover:bg-neutral/50 transition-colors"
        >
          <IconClose />
        </button>
      </div>

      <div className="p-4 pb-20 space-y-2">
        {/* Share via platform */}
        <button
          onClick={handleShareText}
          className="w-full flex items-center gap-4 p-4 rounded-xl border border-neutral/20 bg-white hover:bg-bg transition-colors min-h-[56px]"
        >
          <span className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-lg">
            <IconShare className="w-5 h-5 text-primary" />
          </span>
          <div className="flex-1 text-start">
            <p className="font-semibold text-sm">{isHe ? "שתף כטקסט" : "Share as Text"}</p>
            <p className="text-xs text-text-secondary">{isHe ? "שלח דרך כל אפליקציה" : "Send via any app"}</p>
          </div>
        </button>

        {/* Copy list text */}
        <button
          onClick={handleCopyText}
          className="w-full flex items-center gap-4 p-4 rounded-xl border border-neutral/20 bg-white hover:bg-bg transition-colors min-h-[56px]"
        >
          <span className="w-10 h-10 rounded-full bg-green/10 flex items-center justify-center text-lg">
            <IconCopy className="w-5 h-5 text-green-dark" />
          </span>
          <div className="flex-1 text-start">
            <p className="font-semibold text-sm">
              {copied === "text" ? (isHe ? "הועתק!" : "Copied!") : isHe ? "העתק רשימה" : "Copy List"}
            </p>
            <p className="text-xs text-text-secondary">{isHe ? "העתק טקסט ללוח" : "Copy text to clipboard"}</p>
          </div>
        </button>

        {/* Share / copy link */}
        <button
          onClick={handleShareLink}
          className="w-full flex items-center gap-4 p-4 rounded-xl border border-neutral/20 bg-white hover:bg-bg transition-colors min-h-[56px]"
        >
          <span className="w-10 h-10 rounded-full bg-secondary/30 flex items-center justify-center text-lg">
            <IconLink className="w-5 h-5 text-text" />
          </span>
          <div className="flex-1 text-start">
            <p className="font-semibold text-sm">
              {copied === "link" ? (isHe ? "הועתק!" : "Copied!") : isHe ? "שתף קישור" : "Share Link"}
            </p>
            <p className="text-xs text-text-secondary">{isHe ? "לחברי משק בית" : "For household members"}</p>
          </div>
        </button>
      </div>
    </BottomSheet>
  );
}
