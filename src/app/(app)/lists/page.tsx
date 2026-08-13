import { prisma } from "@/lib/prisma";
import { requireHousehold } from "@/lib/household-context";
import { ListsManager } from "@/components/ListsManager";

export const dynamic = "force-dynamic";

export default async function ListsPage() {
  const household = await requireHousehold();
  const lists = await prisma.groceryList.findMany({
    where: { householdId: household.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      status: true,
      _count: { select: { items: true } },
    },
  });
  const rows = lists.map((l) => ({
    id: l.id,
    name: l.name,
    status: l.status,
    itemCount: l._count.items,
  }));
  return <ListsManager lists={rows} />;
}
