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
      createdAt: true,
      items: {
        select: {
          id: true,
          isBought: true,
          quantity: true,
          unit: true,
          notes: true,
          item: { select: { emoji: true, name: true, nameHe: true } },
        },
      },
    },
  });
  const nowMs = Date.now();
  return <ListsManager lists={lists} nowMs={nowMs} />;
}
