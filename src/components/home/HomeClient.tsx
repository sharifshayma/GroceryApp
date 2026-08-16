"use client";

import { useState } from "react";
import { useT } from "@/i18n/LocaleProvider";
import { getCategoryName } from "@/lib/i18n-names";
import { HorizontalItemRow } from "@/components/HorizontalItemRow";
import { ItemCard } from "@/components/ItemCard";
import { AddToListModal } from "@/components/AddToListModal";
import type { HomeItem, HomeCategory, HomeTag, OpenList, StockRow } from "@/lib/home-data";

export function HomeClient(props: {
  items: HomeItem[]; categories: HomeCategory[]; tags: HomeTag[];
  stockRows: StockRow[]; openLists: OpenList[]; needToBuy: HomeItem[]; frequentlyBought: HomeItem[];
}) {
  const { t, locale } = useT();
  const [homeCategoryId, setHomeCategoryId] = useState<string | null>(props.categories[0]?.id ?? null);
  const [addToListItem, setAddToListItem] = useState<HomeItem | null>(null);

  const itemsInList = new Set(props.openLists.flatMap((l) => l.items.map((i) => i.itemId)));
  const stockByItem = new Map(props.stockRows.map((s) => [s.itemId, s]));
  const homeCategoryItems = homeCategoryId ? props.items.filter((i) => i.categoryId === homeCategoryId) : [];

  return (
    <div className="px-4 pt-6 pb-8 animate-fade-in">
      <h1 className="text-2xl font-semibold mb-4">{locale === "he" ? "פריטים" : "Items"}</h1>

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

      {addToListItem && (
        <AddToListModal item={addToListItem} openLists={props.openLists}
          stockRow={stockByItem.get(addToListItem.id) ?? null} onClose={() => setAddToListItem(null)} />
      )}
    </div>
  );
}
