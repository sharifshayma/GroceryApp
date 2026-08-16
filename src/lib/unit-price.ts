export function computeUnitPrice(
  price: number,
  quantityAmount: number | null | undefined,
): number | null {
  if (quantityAmount == null || !Number.isFinite(quantityAmount) || quantityAmount <= 0) return null;
  if (!Number.isFinite(price)) return null;
  return price / quantityAmount;
}
