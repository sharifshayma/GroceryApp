"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useT } from "@/i18n/LocaleProvider";
import { getCategoryName } from "@/lib/i18n-names";
import { HorizontalItemRow } from "@/components/HorizontalItemRow";
import { ItemCard } from "@/components/ItemCard";
import { AddToListModal } from "@/components/AddToListModal";
import { IconChevronDown, IconChevronRight, IconSearch, IconSettings } from "@/components/Icons";
import type { HomeItem, HomeCategory, HomeTag, OpenList, StockRow } from "@/lib/home-data";

export function HomeClient(props: {
  items: HomeItem[]; categories: HomeCategory[]; tags: HomeTag[];
  stockRows: StockRow[]; openLists: OpenList[]; needToBuy: HomeItem[]; frequentlyBought: HomeItem[];
}) {
  const { t, locale } = useT();
  const [homeCategoryId, setHomeCategoryId] = useState<string | null>(props.categories[0]?.id ?? null);
  const [addToListItem, setAddToListItem] = useState<HomeItem | null>(null);

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [expandedTagType, setExpandedTagType] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

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

  const renderItemCard = (item: HomeItem) => (
    <ItemCard key={item.id} item={item} showActions={false}
      isInList={itemsInList.has(item.id)} onAddToList={() => setAddToListItem(item)} />
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

      {addToListItem && (
        <AddToListModal item={addToListItem} openLists={props.openLists}
          stockRow={stockByItem.get(addToListItem.id) ?? null} onClose={() => setAddToListItem(null)} />
      )}
    </div>
  );
}
