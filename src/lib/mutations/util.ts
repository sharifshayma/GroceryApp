export function clean(s: string | undefined | null): string | null {
  const v = (s ?? "").trim();
  return v ? v : null;
}

export function normalizeQuantity(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 1;
}
