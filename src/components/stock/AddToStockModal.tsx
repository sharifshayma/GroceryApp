"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import { ItemImage } from "@/components/ItemImage";
import { useT } from "@/i18n/LocaleProvider";
import { getItemName, getCategoryName } from "@/lib/i18n-names";

type Item = {
  id: string;
  name: string;
  nameHe: string | null;
  emoji: string;
  defaultUnit: string;
  categoryId: string | null;
};

type Category = {
  id: string;
  name: string;
  nameHe: string | null;
  emoji: string;
};

type BatchEntry = {
  itemId: string;
  quantity: number;
  unit: string;
  lowThreshold: number;
};

export function AddToStockModal({
  mode,
  items,
  categories,
  onBatchAdd,
  onClose,
}: {
  mode: "in-stock" | "out-of-stock";
  items: Item[];
  categories: Category[];
  onBatchAdd: (items: BatchEntry[]) => Promise<void>;
  onClose: () => void;
}) {
  const { t, locale } = useT();
  const isHe = locale === "he";
  const [search, setSearch] = useState("");
  const [selectedItems, setSelectedItems] = useState(new Map<string, Item>());
  const [singleQty, setSingleQty] = useState(1);
  const [saving, setSaving] = useState(false);

  const isInStock = mode === "in-stock";

  const toggleSelect = (item: Item) => {
    setSelectedItems((prev) => {
      const next = new Map(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.set(item.id, item);
      return next;
    });
  };

  const filtered = search.trim()
    ? items.filter(
        (i) =>
          i.name?.toLowerCase().includes(search.toLowerCase()) ||
          i.nameHe?.toLowerCase().includes(search.toLowerCase())
      )
    : items;

  const grouped: Record<string, { name: string; emoji: string; items: Item[] }> = {};
  filtered.forEach((item) => {
    const cat = categories.find((c) => c.id === item.categoryId);
    const key = cat?.id || "other";
    if (!grouped[key])
      grouped[key] = {
        name: cat ? getCategoryName(cat, locale) : isHe ? "אחר" : "Other",
        emoji: cat?.emoji || "📦",
        items: [],
      };
    grouped[key].items.push(item);
  });

  const handleSubmit = async () => {
    if (selectedItems.size === 0) return;
    setSaving(true);

    const defaultQty = isInStock ? (selectedItems.size === 1 ? singleQty : 1) : 0;

    const batch = [...selectedItems.values()].map((item) => ({
      itemId: item.id,
      quantity: defaultQty,
      unit: item.defaultUnit || "pcs",
      lowThreshold: 0,
    }));
    await onBatchAdd(batch);
  };

  return (
    <BottomSheet onClose={saving ? () => {} : onClose}>
      <div className="sticky top-0 bg-white rounded-t-3xl px-5 pt-5 pb-3 border-b border-neutral/50 flex items-center justify-between z-10">
        <h2 className="text-lg font-semibold text-text">
          {isInStock ? (isHe ? "הוסף למלאי" : "Add to Stock") : (isHe ? "סמן כחסר במלאי" : "Mark Out of Stock")}
        </h2>
        <button
          onClick={onClose}
          className="w-11 h-11 rounded-full bg-neutral/30 flex items-center justify-center text-text hover:bg-neutral/50 transition-colors text-xl font-medium"
        >
          ×
        </button>
      </div>

      <div className="p-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("home.search")}
          autoFocus
          className="w-full px-3 py-2.5 rounded-xl border border-neutral bg-surface text-text text-sm placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent mb-3"
        />
        {items.length === 0 ? (
          <p className="text-center text-text-secondary py-6">
            {isHe ? "כל הפריטים כבר במלאי" : "All items are already in stock"}
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-text-secondary py-6">{t("stock.noSearchResults")}</p>
        ) : (
          Object.entries(grouped).map(([catId, group]) => (
            <div key={catId} className="mb-3">
              <h3 className="text-xs font-medium text-text-secondary mb-1">
                {group.emoji} {group.name}
              </h3>
              {group.items.map((item) => {
                const isSelected = selectedItems.has(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => toggleSelect(item)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors min-h-[48px] ${
                      isSelected ? (isInStock ? "bg-green/10" : "bg-danger/10") : "hover:bg-bg"
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        isSelected
                          ? isInStock
                            ? "bg-green border-green text-white"
                            : "bg-danger border-danger text-white"
                          : "border-neutral"
                      }`}
                    >
                      {isSelected && <span className="text-xs">{isInStock ? "✓" : "✗"}</span>}
                    </span>
                    <ItemImage item={item} size="md" />
                    <span className="text-sm font-medium">{getItemName(item, locale)}</span>
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>

      {selectedItems.size > 0 && (
        <div className="sticky bottom-0 p-4 border-t border-neutral/30 bg-white rounded-b-3xl space-y-3">
          {/* Quantity stepper for single item in "in-stock" mode */}
          {isInStock && selectedItems.size === 1 && (
            <div className="flex items-center justify-center gap-3">
              <span className="text-sm text-text-secondary">{isHe ? "כמות:" : "Qty:"}</span>
              <button
                onClick={() => setSingleQty(Math.max(0, singleQty - 1))}
                className="w-10 h-10 rounded-lg bg-neutral/30 flex items-center justify-center font-medium text-lg active:scale-90 transition-transform"
              >
                −
              </button>
              <span className="w-10 text-center font-medium text-lg">{singleQty}</span>
              <button
                onClick={() => setSingleQty(singleQty + 1)}
                className="w-10 h-10 rounded-lg bg-green text-white flex items-center justify-center font-medium text-lg active:scale-90 transition-transform"
              >
                +
              </button>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={saving}
            className={`w-full py-3.5 rounded-xl text-white font-medium text-lg shadow-lg disabled:opacity-50 min-h-[48px] active:scale-[0.98] transition-transform ${
              isInStock ? "bg-green-dark" : "bg-danger"
            }`}
          >
            {saving
              ? isHe
                ? "מוסיף..."
                : "Adding..."
              : isInStock
                ? isHe
                  ? `הוסף ${selectedItems.size} פריטים למלאי`
                  : `Add ${selectedItems.size} item${selectedItems.size > 1 ? "s" : ""} to stock`
                : isHe
                  ? `סמן ${selectedItems.size} כחסר`
                  : `Mark ${selectedItems.size} as out of stock`}
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
