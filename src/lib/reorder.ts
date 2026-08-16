export function swapOrder(
  ordered: { id: string; sortOrder: number }[],
  id: string,
  direction: "up" | "down",
): { id: string; sortOrder: number }[] {
  const sorted = [...ordered].sort((a, b) => a.sortOrder - b.sortOrder);
  const idx = sorted.findIndex((x) => x.id === id);
  if (idx === -1) return [];
  const neighborIdx = direction === "up" ? idx - 1 : idx + 1;
  if (neighborIdx < 0 || neighborIdx >= sorted.length) return [];
  const target = sorted[idx];
  const neighbor = sorted[neighborIdx];
  return [
    { id: target.id, sortOrder: neighbor.sortOrder },
    { id: neighbor.id, sortOrder: target.sortOrder },
  ];
}
