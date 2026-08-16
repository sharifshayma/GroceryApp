// src/lib/shopping-progress.ts
export function shoppingProgress(
  items: { isBought: boolean }[],
): { bought: number; total: number } {
  let bought = 0;
  for (const i of items) if (i.isBought) bought++;
  return { bought, total: items.length };
}
