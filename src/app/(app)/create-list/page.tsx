import { prisma } from "@/lib/prisma";
import { requireHousehold } from "@/lib/household-context";
import { CreateListClient } from "@/components/lists/CreateListClient";

export const dynamic = "force-dynamic";

export default async function CreateListPage() {
  const household = await requireHousehold();

  const [items, categories, tags, itemTags] = await Promise.all([
    prisma.item.findMany({
      where: { householdId: household.id },
      select: { id: true, name: true, nameHe: true, emoji: true, defaultUnit: true, categoryId: true },
    }),
    prisma.category.findMany({
      where: { householdId: household.id },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, nameHe: true, emoji: true },
    }),
    prisma.tag.findMany({
      where: { householdId: household.id },
      select: { id: true, name: true, color: true, type: true },
    }),
    prisma.itemTag.findMany({
      where: { tag: { householdId: household.id } },
      select: { tagId: true, itemId: true },
    }),
  ]);

  const tagItemMap: Record<string, string[]> = {};
  for (const { tagId, itemId } of itemTags) {
    if (!tagItemMap[tagId]) tagItemMap[tagId] = [];
    tagItemMap[tagId].push(itemId);
  }

  return <CreateListClient items={items} categories={categories} tags={tags} tagItemMap={tagItemMap} />;
}
