"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/LocaleProvider";
import { getCategoryName } from "@/lib/i18n-names";
import { HorizontalItemRow } from "@/components/HorizontalItemRow";
import { ItemCard } from "@/components/ItemCard";
import { AddToListModal } from "@/components/AddToListModal";
import { BottomSheet } from "@/components/BottomSheet";
import { IconChevronDown, IconChevronRight, IconSearch, IconSettings } from "@/components/Icons";
import { addListItem } from "@/actions/list-items";
import { createListAndAddItem } from "@/actions/home";
import type { HomeItem, HomeCategory, HomeTag, OpenList, StockRow } from "@/lib/home-data";

export function HomeClient(props: {
  items: HomeItem[]; categories: HomeCategory[]; tags: HomeTag[];
  stockRows: StockRow[]; openLists: OpenList[]; needToBuy: HomeItem[]; frequentlyBought: HomeItem[];
}) {
  const router = useRouter();
  const { t, locale } = useT();
  const [homeCategoryId, setHomeCategoryId] = useState<string | null>(props.categories[0]?.id ?? null);
  const [addToListItem, setAddToListItem] = useState<HomeItem | null>(null);

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [expandedTagType, setExpandedTagType] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Multi-select state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Map<string, HomeItem>>(new Map());
  const [showListPicker, setShowListPicker] = useState(false);

  const settingsRef = useRef<HTMLDivElement>(null);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const tagDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showSettings && !showCategoryDropdown && !expandedTagType) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (showSettings && settingsRef.current && !settingsRef.current.contains(e.target as Node)) setShowSettings(false);
      if (showCategoryDropdown && categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target as Node)) setShowCategoryDropdown(false);
      if (expandedTagType && tagDropdownRef.current && !tagDropdownRef.current.contains(e.target as Node)) setExpandedTagType(null);
    };
    // Use requestAnimationFrame to ensure the listener is added after the current event cycle
    const rafId = requestAnimationFrame(() => {
      document.addEventListener("mousedown", handleClickOutside);
    });
    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showSettings, showCategoryDropdown, expandedTagType]);

  // Clear selections when switching filters
  useEffect(() => {
    setSelectedItems(new Map());
  }, [activeTag, activeCategory, search]);

  const itemsInList = new Set(props.openLists.flatMap((l) => l.items.map((i) => i.itemId)));
  const stockByItem = new Map(props.stockRows.map((s) => [s.itemId, s]));
  const homeCategoryItems = homeCategoryId ? props.items.filter((i) => i.categoryId === homeCategoryId) : [];

  const searchResults = search
    ? props.items.filter((item) => {
        const q = search.toLowerCase();
        return (
          item.name?.toLowerCase().includes(q) ||
          item.nameHe?.toLowerCase().includes(q) ||
          item.notes?.toLowerCase().includes(q)
        );
      })
    : null;

  const categoryFilteredItems = activeCategory ? props.items.filter((i) => i.categoryId === activeCategory) : null;
  const tagFilteredItems = activeTag ? props.items.filter((i) => i.tags.some((t) => t.tag.id === activeTag)) : null;

  const tagGroups = [
    { type: "recipe", emoji: "🍽️", label: locale === "he" ? "מתכונים" : "Recipes", items: props.tags.filter((tg) => tg.type === "recipe") },
    { type: "store", emoji: "🏪", label: locale === "he" ? "חנויות" : "Stores", items: props.tags.filter((tg) => tg.type === "store") },
    { type: "custom", emoji: "🏷️", label: locale === "he" ? "מותאם" : "Custom", items: props.tags.filter((tg) => tg.type === "custom") },
  ].filter((g) => g.items.length > 0);

  const toggleSelect = (item: HomeItem) => {
    setSelectedItems((prev) => {
      const next = new Map(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.set(item.id, item);
      return next;
    });
  };

  // Create a brand-new dated list seeded with `items` (first item via
  // createListAndAddItem, the rest via addListItem against the new list id).
  const createNewListWithItems = async (items: HomeItem[]) => {
    if (items.length === 0) return;
    const name = `${t("nav.lists")} — ${new Date().toLocaleDateString(locale === "he" ? "he-IL" : "en-US", { month: "short", day: "numeric" })}`;
    const [first, ...rest] = items;
    const res = await createListAndAddItem({ name, itemId: first.id, quantity: 1, unit: first.defaultUnit || "pcs" });
    if (res.ok) {
      for (const item of rest) {
        const itemRes = await addListItem({ listId: res.id, itemId: item.id, quantity: 1, unit: item.defaultUnit || "pcs" });
        if (!itemRes.ok) break;
      }
    }
  };

  // Bulk add all selected items to a list, skipping duplicates already on it.
  // When no explicit listId is given but exactly one list is open, that list
  // is the implicit target — resolve it up front so dedup applies there too.
  const handleBulkAdd = async (listId: string | null) => {
    const effectiveListId = listId ?? (props.openLists.length === 1 ? props.openLists[0].id : null);
    const targetList = effectiveListId ? props.openLists.find((l) => l.id === effectiveListId) : null;
    const existingItemIds = new Set((targetList?.items ?? []).map((li) => li.itemId));
    const items = [...selectedItems.values()].filter((item) => !existingItemIds.has(item.id));

    if (items.length === 0) {
      setSelectedItems(new Map());
      setSelectMode(false);
      return;
    }

    if (effectiveListId) {
      for (const item of items) {
        const res = await addListItem({ listId: effectiveListId, itemId: item.id, quantity: 1, unit: item.defaultUnit || "pcs" });
        if (!res.ok) break;
      }
    } else if (props.openLists.length === 0) {
      await createNewListWithItems(items);
    } else {
      // Multiple lists — show picker, don't clear selection yet
      setShowListPicker(true);
      return;
    }

    router.refresh();
    setSelectedItems(new Map());
    setSelectMode(false);
  };

  const handlePickerNewList = async () => {
    setShowListPicker(false);
    await createNewListWithItems([...selectedItems.values()]);
    router.refresh();
    setSelectedItems(new Map());
    setSelectMode(false);
  };

  const renderItemCard = (item: HomeItem) => (
    <ItemCard key={item.id} item={item} showActions={false}
      isInList={itemsInList.has(item.id)} onAddToList={() => setAddToListItem(item)}
      selectMode={selectMode} isSelected={selectedItems.has(item.id)} onSelect={() => toggleSelect(item)} />
  );

  return (
    <div className="px-4 pt-6 pb-8 animate-fade-in">
      {/* Header with title + settings gear */}
      <div ref={settingsRef} className="flex items-center justify-between mb-4 relative">
        <h1 className="text-2xl font-semibold">{locale === "he" ? "פריטים" : "Items"}</h1>
        <button
          onMouseDown={(e) => { e.preventDefault(); setShowSettings((v) => !v); }}
          className="w-10 h-10 rounded-xl bg-surface border border-neutral flex items-center justify-center text-text-secondary hover:text-text transition-colors"
        >
          <IconSettings />
        </button>
        {showSettings && (
          <div className="absolute end-0 top-full mt-1 z-20 bg-surface rounded-xl border border-neutral shadow-lg min-w-[200px] py-1">
            <Link
              href="/categories"
              onClick={() => setShowSettings(false)}
              className="flex items-center justify-between px-4 py-3 hover:bg-bg transition-colors text-sm"
            >
              <span>{locale === "he" ? "ניהול קטגוריות" : "Manage Categories"}</span>
              <IconChevronRight className="w-4 h-4 text-text-secondary" />
            </Link>
            <Link
              href="/tags"
              onClick={() => setShowSettings(false)}
              className="flex items-center justify-between px-4 py-3 hover:bg-bg transition-colors text-sm"
            >
              <span>{locale === "he" ? "ניהול תגיות" : "Manage Tags"}</span>
              <IconChevronRight className="w-4 h-4 text-text-secondary" />
            </Link>
          </div>
        )}
      </div>

      {/* Search bar */}
      <div className="relative mb-4">
        <IconSearch className="absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("home.search")}
          className="w-full ps-10 pe-4 py-3 rounded-xl border border-neutral bg-surface text-text placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute end-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-neutral/50 flex items-center justify-center text-text-secondary hover:text-text"
          >
            ×
          </button>
        )}
      </div>

      {/* Filter row: Categories + Tag types */}
      {!search && (
        <div className="flex flex-wrap gap-2 mb-4 relative">
          {/* Categories filter */}
          <div ref={categoryDropdownRef} className="relative flex-shrink-0">
            <button
              onMouseDown={(e) => { e.preventDefault(); setShowCategoryDropdown((v) => !v); setExpandedTagType(null); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                activeCategory
                  ? "bg-primary text-white"
                  : "bg-surface border border-neutral text-text-secondary"
              }`}
            >
              {activeCategory
                ? (() => {
                    const cat = props.categories.find((c) => c.id === activeCategory);
                    return `${cat?.emoji || "📁"} ${cat ? getCategoryName(cat, locale) : ""}`;
                  })()
                : `📁 ${locale === "he" ? "קטגוריות" : "Categories"}`}
              <IconChevronDown className="w-3 h-3" />
            </button>
            {showCategoryDropdown && (
              <div className="absolute start-0 top-full mt-1 z-20 bg-surface rounded-xl border border-neutral shadow-lg min-w-[200px] max-h-[60vh] overflow-y-auto py-1">
                <button
                  onClick={() => { setActiveCategory(null); setShowCategoryDropdown(false); }}
                  className={`w-full flex items-center gap-2 px-4 py-2.5 hover:bg-bg transition-colors text-sm text-start ${!activeCategory ? "text-primary font-medium" : ""}`}
                >
                  {locale === "he" ? "הצג הכל" : "Show All"}
                </button>
                {props.categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => { setActiveCategory(cat.id); setActiveTag(null); setShowCategoryDropdown(false); }}
                    className={`w-full flex items-center gap-2 px-4 py-2.5 hover:bg-bg transition-colors text-sm text-start ${activeCategory === cat.id ? "bg-primary/10 text-primary font-medium" : ""}`}
                  >
                    <span>{cat.emoji}</span>
                    <span>{getCategoryName(cat, locale)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tag type chips */}
          {tagGroups.map((group) => {
            const activeTagInGroup = props.tags.find((tg) => tg.id === activeTag && tg.type === group.type);
            return (
              <div key={group.type} ref={expandedTagType === group.type ? tagDropdownRef : undefined} className="relative flex-shrink-0">
                <button
                  onMouseDown={(e) => { e.preventDefault(); setExpandedTagType((v) => (v === group.type ? null : group.type)); setShowCategoryDropdown(false); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    activeTagInGroup
                      ? "text-white"
                      : "bg-surface border border-neutral text-text-secondary"
                  }`}
                  style={activeTagInGroup ? { backgroundColor: activeTagInGroup.color } : {}}
                >
                  {activeTagInGroup
                    ? `${group.emoji} ${activeTagInGroup.name}`
                    : `${group.emoji} ${group.label}`}
                  <IconChevronDown className="w-3 h-3" />
                </button>
                {expandedTagType === group.type && (
                  <div className="absolute start-0 top-full mt-1 z-20 bg-surface rounded-xl border border-neutral shadow-lg min-w-[180px] max-h-[50vh] overflow-y-auto py-1">
                    {group.items.map((tag) => (
                      <button
                        key={tag.id}
                        onClick={() => {
                          setActiveTag(activeTag === tag.id ? null : tag.id);
                          setActiveCategory(null);
                          setExpandedTagType(null);
                        }}
                        className={`w-full flex items-center gap-2 px-4 py-2.5 hover:bg-bg transition-colors text-sm text-start ${activeTag === tag.id ? "font-medium" : ""}`}
                      >
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                        <span className={activeTag === tag.id ? "text-primary" : ""}>{tag.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Add Tag chip (if no tags exist) */}
          {props.tags.length === 0 && (
            <Link
              href="/tags"
              className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border border-dashed border-primary/30 text-primary"
            >
              + {locale === "he" ? "הוסף תגית" : "Add Tag"}
            </Link>
          )}

          {/* Select / Clear button — only when items are showing */}
          {(activeTag || activeCategory) && (
            <button
              onClick={() => {
                if (selectMode) {
                  setSelectMode(false);
                  setSelectedItems(new Map());
                } else {
                  setSelectMode(true);
                }
              }}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                selectMode ? "bg-primary text-white" : "bg-surface border border-neutral text-text-secondary"
              }`}
            >
              {selectMode
                ? (locale === "he" ? "נקה" : "Clear")
                : (locale === "he" ? "בחירה" : "Select")}
            </button>
          )}

          {/* Select all / deselect all (visible in select mode with filtered items) */}
          {selectMode && (activeTag || activeCategory) && (
            <button
              onClick={() => {
                const currentItems = activeTag ? (tagFilteredItems || []) : (categoryFilteredItems || []);
                if (selectedItems.size === currentItems.length) {
                  setSelectedItems(new Map());
                } else {
                  const all = new Map<string, HomeItem>();
                  currentItems.forEach((i) => all.set(i.id, i));
                  setSelectedItems(all);
                }
              }}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium text-primary"
            >
              {locale === "he" ? "בחר הכל" : "Select all"}
            </button>
          )}
        </div>
      )}

      {/* Tag filter results */}
      {activeTag && !search && tagFilteredItems && (
        <div className="mb-6">
          {tagFilteredItems.length === 0 ? (
            <p className="text-center text-text-secondary py-6">
              {locale === "he" ? "אין פריטים עם תגית זו" : "No items with this tag"}
            </p>
          ) : (
            <div className="space-y-2">{tagFilteredItems.map((item) => renderItemCard(item))}</div>
          )}
        </div>
      )}

      {/* Category filter results */}
      {activeCategory && !activeTag && !search && categoryFilteredItems && (
        <div className="mb-6">
          {categoryFilteredItems.length === 0 ? (
            <p className="text-center text-text-secondary py-6">
              {locale === "he" ? "אין פריטים בקטגוריה זו" : "No items in this category"}
            </p>
          ) : (
            <div className="space-y-2">{categoryFilteredItems.map((item) => renderItemCard(item))}</div>
          )}
        </div>
      )}

      {/* Select / Clear button for search results */}
      {searchResults && searchResults.length > 0 && (
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => {
              if (selectMode) {
                setSelectMode(false);
                setSelectedItems(new Map());
              } else {
                setSelectMode(true);
              }
            }}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              selectMode ? "bg-primary text-white" : "bg-surface border border-neutral text-text-secondary"
            }`}
          >
            {selectMode
              ? (locale === "he" ? "נקה" : "Clear")
              : (locale === "he" ? "בחירה" : "Select")}
          </button>
        </div>
      )}

      {/* Search results */}
      {searchResults && (
        <div className="space-y-2">
          {searchResults.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-text-secondary">{t("home.noResults")}</p>
            </div>
          ) : (
            searchResults.map((item) => renderItemCard(item))
          )}
        </div>
      )}

      {/* Default view: horizontal rows + category browser */}
      {!search && !activeCategory && !activeTag && (
        <>
          <HorizontalItemRow title={locale === "he" ? "צריך לקנות" : "Need to Buy"} icon="🔴"
            items={props.needToBuy} accentClass="border-t-danger" itemsInList={itemsInList}
            onItemClick={(item) => setAddToListItem(item as HomeItem)} />
          <HorizontalItemRow title={locale === "he" ? "קונים הרבה" : "Frequently Bought"} icon="⭐"
            items={props.frequentlyBought} accentClass="border-t-secondary" itemsInList={itemsInList}
            onItemClick={(item) => setAddToListItem(item as HomeItem)} />

          {/* Category pill browser */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar mb-3 -mx-4 px-4">
            {props.categories.map((cat) => (
              <button key={cat.id} onClick={() => setHomeCategoryId(cat.id)}
                className={`flex-shrink-0 px-3 py-2 rounded-full text-xs font-medium transition-colors min-h-[36px] ${
                  cat.id === homeCategoryId ? "bg-primary text-white" : "bg-white text-text-secondary border border-neutral/30 hover:text-text"}`}>
                {cat.emoji} {getCategoryName(cat, locale)}
              </button>
            ))}
          </div>
          {homeCategoryItems.length === 0 ? (
            <div className="text-center py-12"><p className="text-text-secondary">{t("home.emptyCategory")}</p></div>
          ) : (
            <div className="space-y-2">
              {homeCategoryItems.map((item) => (
                <ItemCard key={item.id} item={item} showActions={false}
                  isInList={itemsInList.has(item.id)} onAddToList={() => setAddToListItem(item)} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Floating bulk add button */}
      {selectMode && selectedItems.size > 0 && (
        <div className="fixed bottom-20 inset-x-0 px-4 z-20" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
          <button
            onClick={() => handleBulkAdd(null)}
            className="w-full max-w-lg mx-auto block py-3.5 rounded-xl bg-primary text-white font-medium text-lg shadow-lg active:scale-[0.98] transition-transform"
          >
            {locale === "he"
              ? `הוסף ${selectedItems.size} פריטים לרשימה`
              : `Add ${selectedItems.size} item${selectedItems.size > 1 ? "s" : ""} to list`}
          </button>
        </div>
      )}

      {addToListItem && (
        <AddToListModal item={addToListItem} openLists={props.openLists}
          stockRow={stockByItem.get(addToListItem.id) ?? null} onClose={() => setAddToListItem(null)} />
      )}

      {/* List picker for bulk add (when multiple lists exist) */}
      {showListPicker && (
        <BottomSheet onClose={() => setShowListPicker(false)}>
          <div className="px-5 pt-5 pb-3 border-b border-neutral/50 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text">
              {locale === "he" ? "בחר רשימה" : "Choose List"}
            </h2>
            <button onClick={() => setShowListPicker(false)} className="w-11 h-11 rounded-full bg-neutral/30 flex items-center justify-center text-text hover:bg-neutral/50 transition-colors text-xl font-medium">×</button>
          </div>
          <div className="p-4 pb-20 space-y-2">
            {props.openLists.map((list) => (
              <button
                key={list.id}
                onClick={async () => {
                  setShowListPicker(false);
                  await handleBulkAdd(list.id);
                }}
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-neutral/20 bg-white hover:bg-bg transition-colors min-h-[56px]"
              >
                <span className="text-lg">🛒</span>
                <div className="flex-1 text-start">
                  <p className="font-semibold text-sm">{list.name}</p>
                  <p className="text-xs text-text-secondary">
                    {list.items.length} {locale === "he" ? "פריטים" : "items"}
                  </p>
                </div>
              </button>
            ))}
            <button
              onClick={handlePickerNewList}
              className="w-full flex items-center gap-3 p-4 rounded-xl border border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors min-h-[56px]"
            >
              <span className="text-lg">+</span>
              <p className="font-semibold text-sm text-primary">
                {locale === "he" ? "רשימה חדשה" : "New List"}
              </p>
            </button>
          </div>
        </BottomSheet>
      )}
    </div>
  );
}
