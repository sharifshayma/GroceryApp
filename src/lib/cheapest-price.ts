export function cheapestByItem<T extends { itemId: string; price: number }>(
  entries: T[],
): Map<string, T> {
  const map = new Map<string, T>();
  for (const e of entries) {
    const cur = map.get(e.itemId);
    if (!cur || e.price < cur.price) map.set(e.itemId, e);
  }
  return map;
}
