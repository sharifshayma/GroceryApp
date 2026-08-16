"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/LocaleProvider";
import { getCategoryName, getItemName } from "@/lib/i18n-names";
import { setListItemBought, updateListItem } from "@/actions/list-items";
import { completeList } from "@/actions/lists";
import { AddToListModal } from "@/components/AddToListModal";
import { CarryOverModal } from "@/components/CarryOverModal";
import { IconBack, IconEdit, IconCheck, IconChevronRight } from "@/components/Icons";
import type { HomeItem, OpenList, StockRow } from "@/lib/home-data";

type CategoryRef = { name: string; nameHe: string | null; emoji: string };

interface ShoppingListItemRow {
  id: string;
  quantity: number;
  unit: string;
  notes: string | null;
  isBought: boolean;
  item: {
    id: string;
    name: string;
    nameHe: string | null;
    emoji: string;
    defaultUnit: string;
    photoUrl: string | null;
    autoTrackStock: boolean;
    category: CategoryRef | null;
  } | null;
}

type ModalItem = Pick<HomeItem, "id" | "name" | "nameHe" | "emoji" | "defaultUnit">;

export function ShoppingList({
  list,
  openLists,
  stockRows,
}: {
  list: { id: string; name: string; status: string; items: ShoppingListItemRow[] };
  openLists: OpenList[];
  stockRows: StockRow[];
}) {
  const router = useRouter();
  const { t, locale } = useT();
  const isHe = locale === "he";

  const [detailItem, setDetailItem] = useState<ModalItem | null>(null);
  const [showCarryOver, setShowCarryOver] = useState(false);
  const [carryOverSaving, setCarryOverSaving] = useState(false);

  const items = list.items;
  const boughtCount = items.filter((li) => li.isBought).length;
  const total = items.length;
  const progress = total > 0 ? (boughtCount / total) * 100 : 0;

  const stockByItem = new Map(stockRows.map((s) => [s.itemId, s]));

  // Group by category
  const grouped = new Map<string, ShoppingListItemRow[]>();
  items.forEach((li) => {
    const catName = li.item?.category ? getCategoryName(li.item.category, locale) : isHe ? "אחר" : "Other";
    const catEmoji = li.item?.category?.emoji || "📦";
    const key = `${catEmoji} ${catName}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(li);
  });

  // Sort: unbought first in each group
  grouped.forEach((arr) => {
    arr.sort((a, b) => (a.isBought === b.isBought ? 0 : a.isBought ? 1 : -1));
  });

  const unboughtItems = items.filter((li) => !li.isBought);

  async function toggleBought(li: ShoppingListItemRow) {
    await setListItemBought({ listItemId: li.id, isBought: !li.isBought });
    router.refresh();
  }

  async function changeQuantity(li: ShoppingListItemRow, next: number) {
    await updateListItem({ listItemId: li.id, quantity: Math.max(1, next), unit: li.unit, notes: li.notes ?? undefined });
    router.refresh();
  }

  function openDetails(li: ShoppingListItemRow) {
    if (!li.item) return;
    setDetailItem({
      id: li.item.id,
      name: li.item.name,
      nameHe: li.item.nameHe,
      emoji: li.item.emoji,
      defaultUnit: li.item.defaultUnit,
    });
  }

  async function handleDone() {
    if (boughtCount === total || boughtCount === 0) {
      await completeList({ listId: list.id, carryOver: false });
      router.push("/lists");
      return;
    }
    setShowCarryOver(true);
  }

  async function handleCarryOver() {
    setCarryOverSaving(true);
    try {
      await completeList({ listId: list.id, carryOver: true });
      router.push("/lists");
    } finally {
      setCarryOverSaving(false);
    }
  }

  async function handleCompleteAnyway() {
    setCarryOverSaving(true);
    try {
      await completeList({ listId: list.id, carryOver: false });
      router.push("/lists");
    } finally {
      setCarryOverSaving(false);
    }
  }

  return (
    <div className="px-4 pt-4 pb-8 max-w-lg mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => router.push("/lists")}
          className="w-10 h-10 rounded-xl bg-surface border border-neutral flex items-center justify-center text-text-secondary"
        >
          <IconBack />
        </button>
        <h1 className="text-lg font-semibold flex-1 text-center truncate px-2">{list.name}</h1>
        {list.status !== "completed" && (
          <Link
            href={`/edit-list/${list.id}`}
            className="w-10 h-10 rounded-xl bg-surface border border-neutral flex items-center justify-center text-text-secondary"
            title="Edit"
          >
            <IconEdit />
          </Link>
        )}
      </div>

      {/* Progress */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="font-semibold text-text-secondary">
            {boughtCount}/{total}
          </span>
          <span className="font-medium text-green-dark">{Math.round(progress)}%</span>
        </div>
        <div className="h-2.5 bg-neutral/30 rounded-full overflow-hidden">
          <div
            className="h-full bg-green rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Items by category */}
      {Array.from(grouped.entries()).map(([cat, catItems]) => (
        <div key={cat} className="mb-4">
          <h3 className="text-sm font-medium text-text-secondary mb-2">{cat}</h3>
          <div className="space-y-1.5">
            {catItems.map((li) => {
              const name = li.item ? getItemName(li.item, locale) : "?";

              if (li.isBought) {
                return (
                  <div
                    key={li.id}
                    className="w-full bg-white rounded-xl p-2 flex items-center gap-1 border shadow-sm transition-all min-h-[52px] border-green/30 opacity-60"
                  >
                    <button
                      onClick={() => toggleBought(li)}
                      aria-label={isHe ? `בטל סימון של ${name}` : `Unmark ${name}`}
                      className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 hover:bg-neutral/10 active:bg-neutral/20 transition-colors"
                    >
                      <div className="w-7 h-7 rounded-lg border-2 flex items-center justify-center bg-green border-green text-white">
                        <IconCheck />
                      </div>
                    </button>
                    <button
                      onClick={() => openDetails(li)}
                      disabled={!li.item}
                      aria-label={isHe ? `הצג פרטי ${name}` : `Show details for ${name}`}
                      className="flex items-center gap-2.5 flex-1 min-w-0 text-start py-2 px-1 rounded-lg hover:bg-primary/5 active:bg-primary/10 transition-colors disabled:opacity-50"
                    >
                      <span className="text-lg">{li.item?.emoji || "🛒"}</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium block line-through text-text-secondary truncate">
                          {name}
                        </span>
                        {li.notes && (
                          <span className="text-xs text-text-secondary block truncate">📝 {li.notes}</span>
                        )}
                      </div>
                      <span className="flex-shrink-0 inline-flex items-center gap-0.5 text-[11px] font-semibold text-primary uppercase tracking-wide">
                        {isHe ? "פרטים" : "Details"}
                        <IconChevronRight className="w-3 h-3" />
                      </span>
                    </button>
                    <span className="text-xs text-text-secondary flex-shrink-0 ms-1">
                      {li.quantity} {li.unit}
                    </span>
                  </div>
                );
              }

              return (
                <div
                  key={li.id}
                  className="w-full bg-white rounded-xl p-2 flex items-center gap-1 border shadow-sm transition-all min-h-[52px] border-neutral/20"
                >
                  <button
                    onClick={() => toggleBought(li)}
                    className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 hover:bg-neutral/10 active:bg-neutral/20 transition-colors"
                    aria-label={isHe ? `סמן ${name} כנקנה` : `Mark ${name} as bought`}
                  >
                    <div className="w-7 h-7 rounded-lg border-2 flex items-center justify-center border-neutral" />
                  </button>
                  <button
                    onClick={() => openDetails(li)}
                    disabled={!li.item}
                    aria-label={isHe ? `הצג פרטי ${name}` : `Show details for ${name}`}
                    className="flex items-center gap-2.5 flex-1 min-w-0 text-start py-2 px-1 rounded-lg hover:bg-primary/5 active:bg-primary/10 transition-colors disabled:opacity-50"
                  >
                    <span className="text-lg">{li.item?.emoji || "🛒"}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium block truncate">{name}</span>
                      {li.notes && (
                        <span className="text-xs text-text-secondary block truncate">📝 {li.notes}</span>
                      )}
                    </div>
                    <span className="flex-shrink-0 inline-flex items-center gap-0.5 text-[11px] font-semibold text-primary uppercase tracking-wide">
                      {isHe ? "פרטים" : "Details"}
                      <IconChevronRight className="w-3 h-3" />
                    </span>
                  </button>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => changeQuantity(li, li.quantity - 1)}
                      disabled={li.quantity <= 1}
                      className="w-7 h-7 rounded-lg bg-neutral/30 flex items-center justify-center font-medium disabled:opacity-40"
                      aria-label={isHe ? "הפחת" : "Decrease"}
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-sm font-medium">{li.quantity}</span>
                    <button
                      onClick={() => changeQuantity(li, li.quantity + 1)}
                      className="w-7 h-7 rounded-lg bg-primary text-white flex items-center justify-center font-medium"
                      aria-label={isHe ? "הוסף" : "Increase"}
                    >
                      +
                    </button>
                    <span className="text-xs text-text-secondary ms-1">{li.unit}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Done button */}
      <button
        onClick={handleDone}
        className={`w-full py-3.5 rounded-xl font-medium text-lg text-white transition-colors mt-2 ${
          boughtCount === total ? "bg-green-dark hover:bg-green" : "bg-primary hover:bg-primary-light"
        }`}
      >
        {t("common.done")} ✓
      </button>

      {showCarryOver && (
        <CarryOverModal
          unboughtItems={unboughtItems}
          onCarryOver={handleCarryOver}
          onCompleteAnyway={handleCompleteAnyway}
          onKeepShopping={() => setShowCarryOver(false)}
          saving={carryOverSaving}
        />
      )}

      {detailItem && (
        <AddToListModal
          item={detailItem}
          openLists={openLists}
          stockRow={stockByItem.get(detailItem.id) ?? null}
          onClose={() => setDetailItem(null)}
        />
      )}
    </div>
  );
}
