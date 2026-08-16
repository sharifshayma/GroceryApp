"use client";

import { useState } from "react";
import { useT } from "@/i18n/LocaleProvider";
import { getCategoryName } from "@/lib/i18n-names";
import { ItemCard } from "@/components/ItemCard";
import { AddToListModal } from "@/components/AddToListModal";
import type { HomeCategory, HomeItem, OpenList, StockRow } from "@/lib/home-data";

export function CategoryItems({
  category,
  items,
  openLists,
  stockRows,
}: {
  category: HomeCategory;
  items: HomeItem[];
  openLists: OpenList[];
  stockRows: StockRow[];
}) {
  const { t, locale } = useT();
  const [addToListItem, setAddToListItem] = useState<HomeItem | null>(null);

  const itemsInList = new Set(openLists.flatMap((l) => l.items.map((i) => i.itemId)));
  const stockByItem = new Map(stockRows.map((s) => [s.itemId, s]));

  return (
    <div className="px-4 pt-6 pb-8 animate-fade-in">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">{category.emoji}</span>
        <h1 className="text-2xl font-semibold text-text truncate">{getCategoryName(category, locale)}</h1>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-text-secondary">{t("home.emptyCategory")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              showActions={false}
              isInList={itemsInList.has(item.id)}
              onAddToList={() => setAddToListItem(item)}
            />
          ))}
        </div>
      )}

      {addToListItem && (
        <AddToListModal
          item={addToListItem}
          openLists={openLists}
          stockRow={stockByItem.get(addToListItem.id) ?? null}
          onClose={() => setAddToListItem(null)}
        />
      )}
    </div>
  );
}
