// src/lib/need-to-buy.ts
export function isLowStock(quantity: number, lowThreshold: number): boolean {
  return quantity <= lowThreshold;
}

export interface NeedItem {
  id: string;
  name: string;
  emoji: string;
}
export interface StockLike {
  itemId: string;
  item: NeedItem;
  quantity: number;
  lowThreshold: number;
}
export interface OnListLike {
  itemId: string;
  item: NeedItem;
  listName: string;
  quantity: number;
}
export interface NeedEntry {
  item: NeedItem;
  reason: "low_stock" | "on_list" | "both";
  onLists: { listName: string; quantity: number }[];
  stock: { quantity: number; lowThreshold: number } | null;
}

export function computeNeedToBuy(input: {
  stockRows: StockLike[];
  openListItems: OnListLike[];
}): { entries: NeedEntry[]; lowCount: number; onListCount: number } {
  const lowMap = new Map<string, StockLike>();
  for (const s of input.stockRows) {
    if (isLowStock(s.quantity, s.lowThreshold)) lowMap.set(s.itemId, s);
  }
  const onListMap = new Map<
    string,
    { item: NeedItem; onLists: { listName: string; quantity: number }[] }
  >();
  for (const li of input.openListItems) {
    const e = onListMap.get(li.itemId) ?? { item: li.item, onLists: [] };
    e.onLists.push({ listName: li.listName, quantity: li.quantity });
    onListMap.set(li.itemId, e);
  }

  const entries: NeedEntry[] = [];
  for (const id of new Set<string>([...lowMap.keys(), ...onListMap.keys()])) {
    const low = lowMap.get(id);
    const onList = onListMap.get(id);
    const item = onList?.item ?? low?.item;
    if (!item) continue; // unreachable: id comes from one of the maps
    const reason = low && onList ? "both" : onList ? "on_list" : "low_stock";
    entries.push({
      item,
      reason,
      onLists: onList?.onLists ?? [],
      stock: low ? { quantity: low.quantity, lowThreshold: low.lowThreshold } : null,
    });
  }
  return { entries, lowCount: lowMap.size, onListCount: onListMap.size };
}
