import { prisma } from "@/lib/prisma";
import { requireHousehold } from "@/lib/household-context";
import { getNeedToBuy, getFrequentlyBought } from "@/lib/mcp-queries";
import { HomeClient } from "@/components/home/HomeClient";
import type { HomeItem, OpenList, StockRow } from "@/lib/home-data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const household = await requireHousehold();
  const [items, categories, tags, stock, openLists, need, frequent] = await Promise.all([
    prisma.item.findMany({
      where: { householdId: household.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, nameHe: true, emoji: true, defaultUnit: true, notes: true,
        categoryId: true, photoUrl: true, autoTrackStock: true,
        tags: { select: { notes: true, tag: { select: { id: true, name: true, color: true, type: true } } } },
      },
    }),
    prisma.category.findMany({ where: { householdId: household.id }, orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, nameHe: true, emoji: true } }),
    prisma.tag.findMany({ where: { householdId: household.id }, orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, name: true, color: true, type: true } }),
    prisma.stock.findMany({ where: { householdId: household.id },
      select: { itemId: true, quantity: true, unit: true, lowThreshold: true } }),
    prisma.groceryList.findMany({
      where: { householdId: household.id, status: { in: ["draft", "active"] } },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, status: true, items: { select: { id: true, itemId: true } } },
    }),
    getNeedToBuy(household.id),
    getFrequentlyBought(household.id),
  ]);

  const itemsById = new Map((items as HomeItem[]).map((i) => [i.id, i]));
  const needItems = need.entries.map((e) => itemsById.get(e.item.id)).filter(Boolean) as HomeItem[];
  const frequentItems = frequent.map((f) => itemsById.get(f.itemId)).filter(Boolean) as HomeItem[];
  const stockRows: StockRow[] = stock.map((s) => ({ itemId: s.itemId, quantity: s.quantity, unit: s.unit, lowThreshold: s.lowThreshold }));
  const lists: OpenList[] = openLists.map((l) => ({
    id: l.id, name: l.name, status: l.status as "draft" | "active",
    items: l.items.filter((li) => li.itemId != null).map((li) => ({ listItemId: li.id, itemId: li.itemId as string })),
  }));

  return (
    <HomeClient
      items={items as HomeItem[]}
      categories={categories}
      tags={tags}
      stockRows={stockRows}
      openLists={lists}
      needToBuy={needItems}
      frequentlyBought={frequentItems}
    />
  );
}
