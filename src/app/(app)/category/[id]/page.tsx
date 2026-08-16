import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireHousehold } from "@/lib/household-context";
import { CategoryItems } from "@/components/home/CategoryItems";
import type { HomeItem, OpenList, StockRow } from "@/lib/home-data";

export const dynamic = "force-dynamic";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const household = await requireHousehold();

  const category = await prisma.category.findFirst({
    where: { id, householdId: household.id },
    select: { id: true, name: true, nameHe: true, emoji: true },
  });
  if (!category) notFound();

  const [items, stock, openLists] = await Promise.all([
    prisma.item.findMany({
      where: { householdId: household.id, categoryId: id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, nameHe: true, emoji: true, defaultUnit: true, notes: true,
        categoryId: true, photoUrl: true, autoTrackStock: true,
        tags: { select: { notes: true, tag: { select: { id: true, name: true, color: true, type: true } } } },
      },
    }),
    prisma.stock.findMany({ where: { householdId: household.id },
      select: { itemId: true, quantity: true, unit: true, lowThreshold: true } }),
    prisma.groceryList.findMany({
      where: { householdId: household.id, status: { in: ["draft", "active"] } },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, status: true, items: { select: { id: true, itemId: true } } },
    }),
  ]);

  const stockRows: StockRow[] = stock.map((s) => ({ itemId: s.itemId, quantity: s.quantity, unit: s.unit, lowThreshold: s.lowThreshold }));
  const lists: OpenList[] = openLists.map((l) => ({
    id: l.id, name: l.name, status: l.status as "draft" | "active",
    items: l.items.filter((li) => li.itemId != null).map((li) => ({ listItemId: li.id, itemId: li.itemId as string })),
  }));

  return (
    <CategoryItems
      category={category}
      items={items as HomeItem[]}
      openLists={lists}
      stockRows={stockRows}
    />
  );
}
