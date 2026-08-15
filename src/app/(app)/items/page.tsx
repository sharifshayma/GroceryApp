import { prisma } from "@/lib/prisma";
import { requireHousehold } from "@/lib/household-context";
import { ItemManager } from "@/components/ItemManager";

export const dynamic = "force-dynamic";

export default async function ItemsPage() {
  const household = await requireHousehold();
  const [items, categories, tags] = await Promise.all([
    prisma.item.findMany({
      where: { householdId: household.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, nameHe: true, emoji: true, defaultUnit: true,
        notes: true, categoryId: true, autoTrackStock: true, photoUrl: true,
        category: { select: { name: true, emoji: true } },
        tags: { select: { notes: true, tag: { select: { id: true, name: true, color: true } } } },
      },
    }),
    prisma.category.findMany({
      where: { householdId: household.id },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, emoji: true },
    }),
    prisma.tag.findMany({
      where: { householdId: household.id },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, name: true, type: true, color: true },
    }),
  ]);
  return <ItemManager items={items} categories={categories} tags={tags} />;
}
