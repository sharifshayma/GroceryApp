const CURRENCY_SYMBOL: Record<string, string> = { ILS: "₪", USD: "$", EUR: "€" };

export function formatPrice(price: number, currency: string): string {
  const symbol = CURRENCY_SYMBOL[currency] ?? "";
  return `${symbol}${price.toFixed(2)}`;
}
