import { prisma } from "@/lib/prisma";
import { requireHousehold } from "@/lib/household-context";
import { TagManager } from "@/components/TagManager";

export const dynamic = "force-dynamic";

export default async function TagsPage() {
  const household = await requireHousehold();
  const tags = await prisma.tag.findMany({
    where: { householdId: household.id },
    orderBy: [{ type: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      type: true,
      color: true,
      description: true,
      _count: { select: { items: true } },
    },
  });
  const rows = tags.map((tg) => ({
    id: tg.id,
    name: tg.name,
    type: tg.type,
    color: tg.color,
    description: tg.description,
    itemCount: tg._count.items,
  }));
  return <TagManager tags={rows} />;
}
