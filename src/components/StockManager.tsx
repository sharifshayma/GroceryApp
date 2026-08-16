"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adjustStock, setStock, removeStock } from "@/actions/stock";
import { setAutoTrackStock } from "@/actions/stock-extra";
import { useT } from "@/i18n/LocaleProvider";
import { getItemName, getCategoryName } from "@/lib/i18n-names";
import { ItemImage } from "@/components/ItemImage";
import { Toggle } from "@/components/Toggle";
import { IconSettings, IllustrationNoItems } from "@/components/Icons";
import { EditStockModal } from "@/components/stock/EditStockModal";
import { AddToStockModal } from "@/components/stock/AddToStockModal";

export interface Category {
  id: string;
  name: string;
  nameHe: string | null;
  emoji: string;
  sortOrder: number;
}

export interface CatalogItem {
  id: string;
  name: string;
  nameHe: string | null;
  emoji: string;
  defaultUnit: string;
  photoUrl: string | null;
  categoryId: string | null;
  autoTrackStock: boolean;
}

interface StockItemInfo {
  id: string;
  name: string;
  nameHe: string | null;
  emoji: string;
  defaultUnit: string;
  photoUrl: string | null;
  category: Category | null;
}

export interface StockRow {
  itemId: string;
  item: StockItemInfo;
  quantity: number;
  unit: string;
  lowThreshold: number;
}

const OTHER_KEY = "other";

export function StockManager({
  stock,
  allItems,
  categories,
  lowStockCount,
}: {
  stock: StockRow[];
  allItems: CatalogItem[];
  categories: Category[];
  lowStockCount: number;
}) {
  const router = useRouter();
  const { t, locale } = useT();
  const isHe = locale === "he";

  const [addModalMode, setAddModalMode] = useState<"in-stock" | "out-of-stock" | null>(null);
  const [editingStock, setEditingStock] = useState<StockRow | null>(null);
  const [filterLow, setFilterLow] = useState(false);
  const [editingThreshold, setEditingThreshold] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function handleAdjust(itemId: string, delta: number) {
    setPendingId(itemId);
    const result = await adjustStock({ itemId, delta });
    setPendingId(null);
    if (!result.ok) {
      alert(result.error);
      return;
    }
    router.refresh();
  }

  async function handleThresholdBlur(row: StockRow, value: string) {
    setEditingThreshold(null);
    const lowThreshold = Number(value) || 1;
    const result = await setStock({
      itemId: row.itemId,
      quantity: row.quantity,
      unit: row.unit,
      lowThreshold,
    });
    if (!result.ok) {
      alert(result.error);
      return;
    }
    router.refresh();
  }

  async function handleRemove(itemId: string) {
    if (!confirm(t("stock.removeConfirm"))) return;
    setPendingId(itemId);
    const result = await removeStock(itemId);
    setPendingId(null);
    if (!result.ok) {
      alert(result.error);
      return;
    }
    router.refresh();
  }

  async function handleEditSave(
    row: StockRow,
    updates: { quantity: number; lowThreshold: number },
  ) {
    const result = await setStock({
      itemId: row.itemId,
      quantity: updates.quantity,
      unit: row.unit,
      lowThreshold: updates.lowThreshold,
    });
    if (!result.ok) {
      alert(result.error);
      return;
    }
    setEditingStock(null);
    router.refresh();
  }

  async function handleBatchAdd(
    items: { itemId: string; quantity: number; unit: string; lowThreshold: number }[],
  ) {
    for (const item of items) {
      await setStock(item);
    }
    setAddModalMode(null);
    router.refresh();
  }

  async function handleToggleAutoTrack(item: CatalogItem) {
    const next = !(item.autoTrackStock ?? true);
    const result = await setAutoTrackStock(item.id, next);
    if (!result.ok) {
      alert(result.error);
      return;
    }
    router.refresh();
  }

  // Group stock rows by category (sorted by sortOrder; unassigned -> Other)
  const displayItems = filterLow ? stock.filter((s) => s.quantity <= s.lowThreshold) : stock;

  const grouped: Record<
    string,
    { name: string; emoji: string; sortOrder: number; items: StockRow[] }
  > = {};
  displayItems.forEach((s) => {
    const cat = s.item.category;
    const key = cat ? cat.id : OTHER_KEY;
    if (!grouped[key]) {
      grouped[key] = {
        name: cat ? getCategoryName(cat, locale) : isHe ? "אחר" : "Other",
        emoji: cat?.emoji || "📦",
        sortOrder: cat?.sortOrder ?? 999,
        items: [],
      };
    }
    grouped[key].items.push(s);
  });
  const sortedGroups = Object.entries(grouped).sort((a, b) => a[1].sortOrder - b[1].sortOrder);

  // Items not yet tracked in stock (for the add modal)
  const stockItemIds = new Set(stock.map((s) => s.itemId));
  const unstockedItems = allItems.filter((i) => !stockItemIds.has(i.id));

  // Group allItems by category for the auto-track settings panel
  const itemsByCategory = new Map<string, CatalogItem[]>();
  allItems.forEach((item) => {
    const key = item.categoryId || OTHER_KEY;
    if (!itemsByCategory.has(key)) itemsByCategory.set(key, []);
    itemsByCategory.get(key)!.push(item);
  });
  const settingsGroups = categories
    .filter((cat) => itemsByCategory.has(cat.id))
    .map((cat) => ({
      key: cat.id,
      name: getCategoryName(cat, locale),
      emoji: cat.emoji,
      items: itemsByCategory.get(cat.id)!,
    }));
  if (itemsByCategory.has(OTHER_KEY)) {
    settingsGroups.push({
      key: OTHER_KEY,
      name: isHe ? "אחר" : "Other",
      emoji: "📦",
      items: itemsByCategory.get(OTHER_KEY)!,
    });
  }

  return (
    <div className="mx-auto max-w-lg animate-fade-in px-4 pb-8 pt-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("nav.stock")}</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings((v) => !v)}
            aria-label={isHe ? "הגדרות" : "Settings"}
            className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${
              showSettings
                ? "border-primary bg-primary text-white"
                : "border-neutral bg-surface text-text-secondary hover:text-text"
            }`}
          >
            <IconSettings />
          </button>
          {lowStockCount > 0 && (
            <button
              onClick={() => setFilterLow(!filterLow)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                filterLow ? "bg-danger text-white" : "bg-danger/10 text-danger"
              }`}
            >
              {filterLow
                ? isHe
                  ? "הצג הכל"
                  : "Show All"
                : `${lowStockCount} ${isHe ? "מלאי נמוך" : "Low Stock"}`}
            </button>
          )}
        </div>
      </div>

      {/* Auto-track settings panel */}
      {showSettings && (
        <div className="mb-6 rounded-2xl border border-neutral/20 bg-surface p-4">
          <h3 className="mb-1 text-sm font-semibold">
            {isHe ? "מעקב מלאי אוטומטי" : "Auto Stock Tracking"}
          </h3>
          <p className="mb-3 text-xs text-text-secondary">
            {isHe
              ? "פריטים מופעלים יעודכנו אוטומטית במלאי כשנקנים"
              : "Enabled items will auto-update stock when bought"}
          </p>
          {allItems.length === 0 ? (
            <p className="py-2 text-center text-xs text-text-secondary">
              {isHe ? "אין פריטים" : "No items"}
            </p>
          ) : (
            <div className="max-h-64 overflow-y-auto overflow-x-hidden">
              {settingsGroups.map((group) => (
                <div key={group.key} className="mb-3 last:mb-0">
                  <h4 className="mb-1 flex items-center gap-1.5 text-xs font-medium text-text-secondary">
                    <span>{group.emoji}</span>
                    <span>{group.name}</span>
                  </h4>
                  {group.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between border-b border-neutral/10 py-2 last:border-0"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <ItemImage item={item} size="md" />
                        <span className="truncate text-sm font-medium">
                          {getItemName(item, locale)}
                        </span>
                      </div>
                      <Toggle
                        checked={item.autoTrackStock ?? true}
                        onChange={() => handleToggleAutoTrack(item)}
                        ariaLabel={getItemName(item, locale)}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add items buttons */}
      {unstockedItems.length > 0 && (
        <div className="mb-5 flex gap-3">
          <button
            onClick={() => setAddModalMode("in-stock")}
            className="min-h-[48px] flex-1 rounded-xl bg-green py-3.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-green-dark active:scale-[0.98]"
          >
            + {isHe ? "במלאי" : "In Stock"}
          </button>
          <button
            onClick={() => setAddModalMode("out-of-stock")}
            className="min-h-[48px] flex-1 rounded-xl border border-danger/30 bg-white py-3.5 text-sm font-medium text-danger shadow-sm transition-colors hover:bg-danger/5 active:scale-[0.98]"
          >
            − {isHe ? "חסר במלאי" : "Out of Stock"}
          </button>
        </div>
      )}

      {stock.length === 0 ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center">
          <div className="mb-4 flex justify-center">
            <IllustrationNoItems className="h-28 w-28" />
          </div>
          <h2 className="mb-2 text-xl font-medium">{t("empty.noStock")}</h2>
          <p className="mb-4 text-center text-text-secondary">{t("empty.noStockDesc")}</p>
        </div>
      ) : (
        sortedGroups.map(([catId, group]) => (
          <div key={catId} className="mb-5">
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-text-secondary">
              <span>{group.emoji}</span>
              <span>{group.name}</span>
              <span className="text-xs font-normal">({group.items.length})</span>
            </h3>
            <div className="space-y-2">
              {group.items.map((s) => {
                const isLow = s.quantity <= s.lowThreshold;
                const isPending = pendingId === s.itemId;
                return (
                  <div
                    key={s.itemId}
                    className={`rounded-xl border bg-white p-3.5 shadow-sm transition-colors ${
                      isLow ? "border-danger/30 bg-danger/5" : "border-neutral/20"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <ItemImage item={s.item} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="break-words font-semibold leading-tight">
                          {getItemName(s.item, locale)}
                        </p>
                        {isLow && (
                          <span className="text-xs font-medium text-danger">
                            {isHe ? "מלאי נמוך" : "Low Stock"}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <button
                        onClick={() => handleAdjust(s.itemId, -1)}
                        disabled={isPending}
                        className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral/30 text-lg font-medium text-text transition-transform active:scale-90 disabled:opacity-50"
                      >
                        −
                      </button>
                      <span
                        className={`w-10 text-center text-lg font-medium ${
                          isLow ? "text-danger" : "text-green-dark"
                        }`}
                      >
                        {s.quantity}
                      </span>
                      <button
                        onClick={() => handleAdjust(s.itemId, 1)}
                        disabled={isPending}
                        className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-lg font-medium text-white transition-transform active:scale-90 disabled:opacity-50"
                      >
                        +
                      </button>
                    </div>

                    <div className="mt-2 flex items-center justify-between border-t border-neutral/20 pt-2">
                      <span className="text-xs text-text-secondary">{s.unit}</span>

                      {editingThreshold === s.itemId ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-text-secondary">
                            {isHe ? "סף:" : "Threshold:"}
                          </span>
                          <input
                            type="number"
                            defaultValue={s.lowThreshold}
                            min={0}
                            className="w-14 rounded-lg border border-neutral bg-bg px-2 py-1 text-center text-sm text-text"
                            onBlur={(e) => handleThresholdBlur(s, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                            }}
                            autoFocus
                          />
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditingThreshold(s.itemId)}
                          className="text-xs text-text-secondary hover:text-text"
                        >
                          {isHe ? "סף:" : "Min:"} {s.lowThreshold}
                        </button>
                      )}

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditingStock(s)}
                          className="flex min-h-[36px] items-center px-2 py-1.5 text-xs text-primary hover:underline"
                        >
                          {t("stock.edit")}
                        </button>
                        <button
                          onClick={() => handleRemove(s.itemId)}
                          disabled={isPending}
                          className="flex min-h-[36px] items-center px-2 py-1.5 text-xs text-danger hover:underline disabled:opacity-50"
                        >
                          {t("stock.remove")}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* Add to stock modal */}
      {addModalMode && (
        <AddToStockModal
          mode={addModalMode}
          items={unstockedItems}
          categories={categories}
          onBatchAdd={handleBatchAdd}
          onClose={() => setAddModalMode(null)}
        />
      )}

      {/* Edit stock modal */}
      {editingStock && (
        <EditStockModal
          stockItem={editingStock}
          onSave={(updates) => handleEditSave(editingStock, updates)}
          onClose={() => setEditingStock(null)}
        />
      )}
    </div>
  );
}
