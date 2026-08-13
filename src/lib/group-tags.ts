const TYPE_ORDER = ["recipe", "store", "custom"] as const;

export function groupTagsByType<T extends { type: string }>(
  tags: T[],
): { type: string; tags: T[] }[] {
  return TYPE_ORDER.map((type) => ({
    type,
    tags: tags.filter((t) => t.type === type),
  })).filter((g) => g.tags.length > 0);
}
