import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireHousehold } from "@/lib/household-context";
import { EditListClient } from "@/components/lists/EditListClient";

export const dynamic = "force-dynamic";

export default async function EditListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const household = await requireHousehold();
  const { id } = await params;

  const [list, items, categories, tags, itemTags] = await Promise.all([
    prisma.groceryList.findFirst({
      where: { id, householdId: household.id },
      select: {
        id: true,
        name: true,
        status: true,
        items: {
          select: { id: true, itemId: true, quantity: true, unit: true, notes: true },
        },
      },
    }),
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

  if (!list) notFound();

  const tagItemMap: Record<string, string[]> = {};
  for (const { tagId, itemId } of itemTags) {
    if (!tagItemMap[tagId]) tagItemMap[tagId] = [];
    tagItemMap[tagId].push(itemId);
  }

  return (
    <EditListClient
      list={list}
      items={items}
      categories={categories}
      tags={tags}
      tagItemMap={tagItemMap}
    />
  );
}
