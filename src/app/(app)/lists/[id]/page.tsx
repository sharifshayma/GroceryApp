import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireHousehold } from "@/lib/household-context";
import { ShoppingList } from "@/components/lists/ShoppingList";
import type { OpenList, StockRow } from "@/lib/home-data";

export const dynamic = "force-dynamic";

export default async function ListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const household = await requireHousehold();
  const { id } = await params;
  const [list, stock, openLists] = await Promise.all([
    prisma.groceryList.findFirst({
      where: { id, householdId: household.id },
      select: {
        id: true,
        name: true,
        status: true,
        items: {
          orderBy: { id: "asc" },
          select: {
            id: true,
            quantity: true,
            unit: true,
            notes: true,
            isBought: true,
            item: {
              select: {
                id: true,
                name: true,
                nameHe: true,
                emoji: true,
                defaultUnit: true,
                photoUrl: true,
                autoTrackStock: true,
                category: { select: { name: true, nameHe: true, emoji: true } },
              },
            },
          },
        },
      },
    }),
    prisma.stock.findMany({
      where: { householdId: household.id },
      select: { itemId: true, quantity: true, unit: true, lowThreshold: true },
    }),
    prisma.groceryList.findMany({
      where: { householdId: household.id, status: { in: ["draft", "active"] } },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, status: true, items: { select: { id: true, itemId: true } } },
    }),
  ]);
  if (!list) notFound();

  const stockRows: StockRow[] = stock.map((s) => ({
    itemId: s.itemId,
    quantity: s.quantity,
    unit: s.unit,
    lowThreshold: s.lowThreshold,
  }));
  const lists: OpenList[] = openLists.map((l) => ({
    id: l.id,
    name: l.name,
    status: l.status as "draft" | "active",
    items: l.items.filter((li) => li.itemId != null).map((li) => ({ listItemId: li.id, itemId: li.itemId as string })),
  }));

  return <ShoppingList list={list} openLists={lists} stockRows={stockRows} />;
}
