"use client";

import { useT } from "@/i18n/LocaleProvider";
import { getItemName } from "@/lib/i18n-names";
import { BottomSheet } from "@/components/BottomSheet";

export interface UnboughtItem {
  id: string;
  quantity: number;
  unit: string;
  item: {
    emoji?: string | null;
    name: string;
    nameHe?: string | null;
  } | null;
}

export function CarryOverModal({
  unboughtItems,
  onCarryOver,
  onCompleteAnyway,
  onKeepShopping,
  saving,
}: {
  unboughtItems: UnboughtItem[];
  onCarryOver: () => void;
  onCompleteAnyway: () => void;
  onKeepShopping: () => void;
  saving: boolean;
}) {
  const { t, locale } = useT();

  return (
    <BottomSheet onClose={onKeepShopping}>
      <div className="p-5">
        {/* Header */}
        <div className="text-center mb-4">
          <span className="text-4xl block mb-2">🛒</span>
          <h2 className="text-lg font-semibold">{t("lists.unboughtTitle")}</h2>
          <p className="text-sm text-text-secondary mt-1">
            {t("lists.unboughtMessage", { count: unboughtItems.length })}
          </p>
        </div>

        {/* Items preview */}
        <div className="max-h-40 overflow-y-auto mb-5 space-y-1.5 rounded-xl bg-neutral/10 p-3">
          {unboughtItems.map((li) => (
            <div key={li.id} className="flex items-center gap-2 text-sm">
              <span className="text-base">{li.item?.emoji || "🛒"}</span>
              <span className="flex-1 truncate font-medium">
                {li.item ? getItemName(li.item, locale) : "?"}
              </span>
              <span className="text-xs text-text-secondary flex-shrink-0">
                {li.quantity} {li.unit}
              </span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <button
            onClick={onCarryOver}
            disabled={saving}
            className="w-full py-3.5 rounded-xl bg-green-dark text-white font-semibold text-base disabled:opacity-50 min-h-[48px]"
          >
            {saving ? t("lists.saving") : t("lists.carryOver")}
          </button>
          <button
            onClick={onCompleteAnyway}
            disabled={saving}
            className="w-full py-3 rounded-xl text-danger font-medium text-base disabled:opacity-50 min-h-[48px]"
          >
            {t("lists.completeAnyway")}
          </button>
          <button
            onClick={onKeepShopping}
            disabled={saving}
            className="w-full py-3 rounded-xl text-text-secondary font-medium text-base disabled:opacity-50 min-h-[48px]"
          >
            {t("lists.keepShopping")}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
