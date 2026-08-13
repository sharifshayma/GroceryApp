import { prisma } from "@/lib/prisma";
import { requireHousehold } from "@/lib/household-context";
import { computeNeedToBuy } from "@/lib/need-to-buy";
import { StockManager } from "@/components/StockManager";

export const dynamic = "force-dynamic";

export default async function StockPage() {
  const household = await requireHousehold();
  const [stock, catalogItems, openListItems] = await Promise.all([
    prisma.stock.findMany({
      where: { householdId: household.id },
      orderBy: { updatedAt: "desc" },
      select: {
        itemId: true,
        quantity: true,
        unit: true,
        lowThreshold: true,
        item: { select: { id: true, name: true, emoji: true, defaultUnit: true } },
      },
    }),
    prisma.item.findMany({
      where: { householdId: household.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true, emoji: true, defaultUnit: true },
    }),
    prisma.listItem.findMany({
      where: {
        isBought: false,
        itemId: { not: null },
        list: { householdId: household.id, status: { in: ["draft", "active"] } },
      },
      select: {
        quantity: true,
        item: { select: { id: true, name: true, emoji: true } },
        list: { select: { name: true } },
      },
    }),
  ]);

  const needToBuy = computeNeedToBuy({
    stockRows: stock.map((s) => ({
      itemId: s.itemId,
      item: { id: s.item.id, name: s.item.name, emoji: s.item.emoji },
      quantity: s.quantity,
      lowThreshold: s.lowThreshold,
    })),
    openListItems: openListItems
      .filter(
        (li): li is typeof li & { item: NonNullable<(typeof li)["item"]> } =>
          li.item != null
      )
      .map((li) => ({
        itemId: li.item.id,
        item: { id: li.item.id, name: li.item.name, emoji: li.item.emoji },
        listName: li.list.name,
        quantity: li.quantity,
      })),
  });

  const trackedItemIds = new Set(stock.map((s) => s.itemId));
  const untracked = catalogItems.filter((i) => !trackedItemIds.has(i.id));

  return (
    <StockManager
      stock={stock.map((s) => ({
        itemId: s.itemId,
        name: s.item.name,
        emoji: s.item.emoji,
        quantity: s.quantity,
        unit: s.unit,
        lowThreshold: s.lowThreshold,
      }))}
      untrackedItems={untracked}
      needToBuy={needToBuy}
    />
  );
}
