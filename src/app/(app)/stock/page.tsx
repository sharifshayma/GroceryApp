import { prisma } from "@/lib/prisma";
import { requireHousehold } from "@/lib/household-context";
import { StockManager } from "@/components/StockManager";

export const dynamic = "force-dynamic";

export default async function StockPage() {
  const household = await requireHousehold();
  const [stock, allItems, categories] = await Promise.all([
    prisma.stock.findMany({
      where: { householdId: household.id },
      orderBy: { updatedAt: "desc" },
      select: {
        itemId: true,
        quantity: true,
        unit: true,
        lowThreshold: true,
        item: {
          select: {
            id: true,
            name: true,
            nameHe: true,
            emoji: true,
            defaultUnit: true,
            photoUrl: true,
            category: { select: { id: true, name: true, nameHe: true, emoji: true, sortOrder: true } },
          },
        },
      },
    }),
    prisma.item.findMany({
      where: { householdId: household.id },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        nameHe: true,
        emoji: true,
        defaultUnit: true,
        photoUrl: true,
        categoryId: true,
        autoTrackStock: true,
      },
    }),
    prisma.category.findMany({
      where: { householdId: household.id },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, nameHe: true, emoji: true, sortOrder: true },
    }),
  ]);

  const lowStockCount = stock.filter((s) => s.quantity <= s.lowThreshold).length;

  return (
    <StockManager
      stock={stock.map((s) => ({
        itemId: s.itemId,
        item: s.item,
        quantity: s.quantity,
        unit: s.unit,
        lowThreshold: s.lowThreshold,
      }))}
      allItems={allItems}
      categories={categories}
      lowStockCount={lowStockCount}
    />
  );
}
