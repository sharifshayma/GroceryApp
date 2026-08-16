"use client";

import { useMemo, useState } from "react";
import { useT } from "@/i18n/LocaleProvider";
import { getCategoryName, getItemName } from "@/lib/i18n-names";
import { IconBack, IconSearch, IconCheck } from "@/components/Icons";

type PickerItem = {
  id: string;
  name: string;
  nameHe: string | null;
  emoji: string;
  defaultUnit: string;
  categoryId: string | null;
};

type PickerCategory = {
  id: string;
  name: string;
  nameHe: string | null;
  emoji: string;
};

type PickerTag = {
  id: string;
  name: string;
  color: string;
  type: "recipe" | "store" | "custom";
};

type Selection = { quantity: number; unit: string; notes?: string };

export function ListItemPicker({
  items,
  categories,
  tags,
  tagItemMap,
  initialSelected,
  submitLabel,
  onSubmit,
  onBack,
}: {
  items: PickerItem[];
  categories: PickerCategory[];
  tags: PickerTag[];
  tagItemMap: Record<string, string[]>;
  initialSelected?: Record<string, Selection>;
  submitLabel: string;
  onSubmit: (items: { itemId: string; quantity: number; unit: string; notes?: string }[]) => Promise<void>;
  onBack: () => void;
}) {
  const { t, locale } = useT();
  const isHe = locale === "he";

  const [selected, setSelected] = useState<Map<string, Selection>>(
    () => new Map(Object.entries(initialSelected ?? {}))
  );
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const activeTaggedItemIds = useMemo(() => {
    if (activeTags.length === 0) return null;
    const set = new Set<string>();
    for (const tagId of activeTags) {
      for (const itemId of tagItemMap[tagId] ?? []) set.add(itemId);
    }
    return set;
  }, [activeTags, tagItemMap]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        return (
          item.name?.toLowerCase().includes(q) ||
          (item.nameHe ?? "").toLowerCase().includes(q)
        );
      }
      if (activeTaggedItemIds) return activeTaggedItemIds.has(item.id);
      if (activeCategory) return item.categoryId === activeCategory;
      return true;
    });
  }, [items, search, activeTaggedItemIds, activeCategory]);

  const grouped = useMemo(() => {
    const map = new Map<string, PickerItem[]>();
    for (const item of filteredItems) {
      const key = item.categoryId ?? "uncategorized";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return map;
  }, [filteredItems]);

  function toggleTagFilter(tagId: string) {
    setActiveTags((prev) => (prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]));
    setActiveCategory(null);
    setSearch("");
  }

  function selectCategory(catId: string | null) {
    setActiveCategory(catId);
    setSearch("");
    setActiveTags([]);
  }

  function toggleItem(item: PickerItem) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.set(item.id, { quantity: 1, unit: item.defaultUnit || "pcs" });
      }
      return next;
    });
  }

  function updateQuantity(itemId: string, quantity: number) {
    if (quantity < 1) return;
    setSelected((prev) => {
      const current = prev.get(itemId);
      if (!current) return prev;
      const next = new Map(prev);
      next.set(itemId, { ...current, quantity });
      return next;
    });
  }

  const selectedCount = selected.size;

  async function handleSubmit() {
    if (selectedCount === 0 || saving) return;
    setSaving(true);
    try {
      const payload = [...selected].map(([itemId, v]) => ({
        itemId,
        quantity: v.quantity,
        unit: v.unit,
        notes: v.notes,
      }));
      await onSubmit(payload);
    } finally {
      setSaving(false);
    }
  }

  const noActiveFilter = !activeCategory && !search && activeTags.length === 0;

  return (
    <div className="min-h-dvh bg-bg">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-bg">
        <div className="px-4 pt-4 pb-2 flex items-center gap-3 max-w-lg mx-auto">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-xl bg-surface border border-neutral flex items-center justify-center text-text-secondary hover:text-text transition-colors flex-shrink-0"
            aria-label={t("lists.back")}
          >
            <IconBack />
          </button>
          <h1 className="text-xl font-semibold">{t("lists.newTitle")}</h1>
        </div>

        {/* Search */}
        <div className="px-4 pb-2 max-w-lg mx-auto">
          <div className="relative">
            <IconSearch className="absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setActiveCategory(null);
                setActiveTags([]);
              }}
              placeholder={t("home.search")}
              className="w-full ps-10 pe-4 py-2.5 rounded-xl border border-neutral bg-surface text-text text-sm placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
        </div>

        {/* Tag filter pills */}
        {tags.length > 0 && (
          <div className="flex gap-2 px-4 pb-2 overflow-x-auto no-scrollbar max-w-lg mx-auto">
            {activeTags.length > 0 && (
              <button
                onClick={() => setActiveTags([])}
                className="flex-shrink-0 px-3 py-2 rounded-full text-xs font-semibold bg-neutral/30 text-text-secondary min-h-[36px]"
              >
                {t("lists.clearFilter")}
              </button>
            )}
            {tags.map((tag) => {
              const isActive = activeTags.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  onClick={() => toggleTagFilter(tag.id)}
                  className="flex-shrink-0 px-3 py-2 rounded-full text-xs font-semibold transition-colors min-h-[36px] flex items-center gap-1.5"
                  style={
                    isActive
                      ? { backgroundColor: tag.color, color: "white" }
                      : { backgroundColor: "white", color: "#6B7280", border: "1px solid rgba(0,0,0,0.1)" }
                  }
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: isActive ? "white" : tag.color }}
                  />
                  {tag.name}
                </button>
              );
            })}
          </div>
        )}

        {/* Category pills */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar max-w-lg mx-auto">
          <button
            onClick={() => selectCategory(null)}
            className={`flex-shrink-0 px-4 py-2.5 rounded-full text-xs font-semibold transition-colors min-h-[40px] ${
              noActiveFilter ? "bg-primary text-white" : "bg-white text-text-secondary border border-neutral/30 shadow-sm"
            }`}
          >
            {t("lists.allCategories")}
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => selectCategory(cat.id)}
              className={`flex-shrink-0 px-4 py-2.5 rounded-full text-xs font-semibold transition-colors min-h-[40px] ${
                activeCategory === cat.id
                  ? "bg-primary text-white"
                  : "bg-white text-text-secondary border border-neutral/30 shadow-sm"
              }`}
            >
              {cat.emoji} {getCategoryName(cat, locale)}
            </button>
          ))}
        </div>

        <div className="border-b border-neutral/50" />
      </div>

      {/* Item list */}
      <div className="px-4 py-3 max-w-lg mx-auto pb-28">
        {[...grouped.entries()].map(([catId, catItems]) => {
          const cat = categories.find((c) => c.id === catId);
          return (
            <div key={catId} className="mb-4">
              {!search && (
                <h3 className="text-sm font-medium text-text-secondary mb-2">
                  {cat ? `${cat.emoji} ${getCategoryName(cat, locale)}` : isHe ? "אחר" : "Other"}
                </h3>
              )}
              <div className="space-y-1.5">
                {catItems.map((item) => {
                  const sel = selected.get(item.id);
                  const isSelected = !!sel;
                  return (
                    <div
                      key={item.id}
                      className={`bg-white rounded-xl p-3.5 flex items-center gap-3 border shadow-sm transition-colors min-h-[52px] ${
                        isSelected ? "border-primary bg-primary/5" : "border-neutral/20"
                      }`}
                    >
                      <button
                        onClick={() => toggleItem(item)}
                        className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                          isSelected ? "bg-primary border-primary text-white" : "border-neutral"
                        }`}
                        aria-label={getItemName(item, locale)}
                      >
                        {isSelected && <IconCheck className="w-4 h-4" />}
                      </button>
                      <span className="text-xl">{item.emoji}</span>
                      <span className="flex-1 font-medium text-sm truncate">{getItemName(item, locale)}</span>

                      {isSelected && sel && (
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => updateQuantity(item.id, sel.quantity - 1)}
                            className="w-9 h-9 rounded-lg bg-neutral/30 flex items-center justify-center text-text font-medium text-base active:scale-90 transition-transform"
                            aria-label={isHe ? "הפחת" : "Decrease"}
                          >
                            −
                          </button>
                          <span className="w-8 text-center font-medium text-sm">{sel.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.id, sel.quantity + 1)}
                            className="w-9 h-9 rounded-lg bg-primary text-white flex items-center justify-center font-medium text-base active:scale-90 transition-transform"
                            aria-label={isHe ? "הוסף" : "Increase"}
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {filteredItems.length === 0 && (
          <div className="text-center py-12">
            <span className="text-4xl mb-3 block">🔍</span>
            <p className="text-text-secondary">{t("home.noResults")}</p>
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      {selectedCount > 0 && (
        <div
          className="fixed bottom-16 inset-x-0 z-20 px-4 pb-2"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 4rem)" }}
        >
          <div className="max-w-lg mx-auto">
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="w-full py-3.5 rounded-xl bg-primary text-white font-medium text-lg shadow-lg hover:bg-primary-light active:bg-primary-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <span>🛒</span>
              <span>{saving ? t("lists.saving") : `${submitLabel} (${selectedCount})`}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
