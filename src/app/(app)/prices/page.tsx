import { prisma } from "@/lib/prisma";
import { requireHousehold } from "@/lib/household-context";
import { cheapestByItem } from "@/lib/cheapest-price";
import { PricesManager } from "@/components/PricesManager";

export const dynamic = "force-dynamic";

export default async function PricesPage() {
  const household = await requireHousehold();
  const [entries, catalogItems] = await Promise.all([
    prisma.priceHistory.findMany({
      where: { householdId: household.id },
      orderBy: [{ purchasedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        itemId: true,
        price: true,
        currency: true,
        store: true,
        purchasedAt: true,
        quantityAmount: true,
        quantityUnit: true,
        item: { select: { id: true, name: true, emoji: true } },
      },
    }),
    prisma.item.findMany({
      where: { householdId: household.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true, emoji: true },
    }),
  ]);

  const rows = entries
    .filter((e): e is typeof e & { item: NonNullable<(typeof e)["item"]> } => e.item != null)
    .map((e) => ({
      id: e.id,
      itemId: e.itemId,
      price: Number(e.price),
      currency: e.currency,
      store: e.store,
      purchasedAt: e.purchasedAt.toISOString().slice(0, 10),
      quantityAmount: e.quantityAmount,
      quantityUnit: e.quantityUnit,
      item: { id: e.item.id, name: e.item.name, emoji: e.item.emoji },
    }));

  const cheapest = cheapestByItem(rows);
  const byItem = new Map<string, { item: (typeof rows)[number]["item"]; entries: typeof rows }>();
  for (const r of rows) {
    const g = byItem.get(r.itemId) ?? { item: r.item, entries: [] };
    g.entries.push(r);
    byItem.set(r.itemId, g);
  }
  const pricedItems = [...byItem.values()].map((g) => ({
    item: g.item,
    entries: g.entries,
    cheapest: cheapest.get(g.item.id) ?? null,
  }));

  return <PricesManager pricedItems={pricedItems} catalogItems={catalogItems} />;
}
