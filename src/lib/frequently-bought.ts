export function rankFrequentlyBought(
  rows: { itemId: string }[],
  limit: number,
): { itemId: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.itemId, (counts.get(r.itemId) ?? 0) + 1);
  // Map preserves first-seen insertion order, so a stable sort ties-break by it.
  return [...counts.entries()]
    .map(([itemId, count]) => ({ itemId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
