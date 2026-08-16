"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import { ItemImage } from "@/components/ItemImage";
import { useT } from "@/i18n/LocaleProvider";
import { getItemName } from "@/lib/i18n-names";

type StockItem = {
  itemId: string;
  item: {
    name: string;
    nameHe: string | null;
    emoji: string;
    photoUrl: string | null;
  };
  quantity: number;
  unit: string;
  lowThreshold: number;
};

export function EditStockModal({
  stockItem,
  onSave,
  onClose,
}: {
  stockItem: StockItem;
  onSave: (updates: { quantity: number; lowThreshold: number }) => Promise<void>;
  onClose: () => void;
}) {
  const { t, locale } = useT();
  const [quantity, setQuantity] = useState(stockItem.quantity);
  const [threshold, setThreshold] = useState(stockItem.lowThreshold);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await onSave({ quantity, lowThreshold: threshold });
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet onClose={onClose}>
      <div className="sticky top-0 bg-white rounded-t-3xl px-5 pt-5 pb-3 border-b border-neutral/50 flex items-center justify-between z-10">
        <h2 className="text-lg font-semibold text-text">
          {locale === "he" ? "עריכת מלאי" : "Edit Stock"}
        </h2>
        <button
          onClick={onClose}
          className="w-11 h-11 rounded-full bg-neutral/30 flex items-center justify-center text-text hover:bg-neutral/50 transition-colors text-xl font-medium"
        >
          ×
        </button>
      </div>

      <div className="p-4 pb-20 space-y-4">
        <div className="flex items-center gap-3 p-3.5 bg-bg rounded-xl border border-primary/30">
          <ItemImage item={stockItem.item} size="lg" />
          <div>
            <p className="font-medium">{getItemName(stockItem.item, locale)}</p>
            <p className="text-xs text-text-secondary">{stockItem.unit}</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1">
            {locale === "he" ? "כמות נוכחית" : "Current Quantity"}
          </label>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setQuantity(Math.max(0, quantity - 1))}
              className="w-12 h-12 rounded-xl bg-neutral/30 flex items-center justify-center font-medium text-lg active:scale-90 transition-transform"
            >
              −
            </button>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(0, Number(e.target.value)))}
              className="w-20 px-3 py-2 rounded-xl border border-neutral bg-surface text-text text-center text-lg font-medium"
            />
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center font-medium text-lg active:scale-90 transition-transform"
            >
              +
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1">
            {locale === "he" ? "סף מלאי נמוך" : "Low Stock Threshold"}
          </label>
          <input
            type="number"
            value={threshold}
            onChange={(e) => setThreshold(Math.max(0, Number(e.target.value)))}
            className="w-20 px-3 py-2 rounded-xl border border-neutral bg-surface text-text text-center"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={saving}
          className="w-full py-3.5 rounded-xl bg-primary text-white font-medium text-lg disabled:opacity-50 min-h-[48px]"
        >
          {saving ? t("common.saving") : t("common.save")}
        </button>
      </div>
    </BottomSheet>
  );
}
