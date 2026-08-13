import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireHousehold } from "@/lib/household-context";
import { ListDetail } from "@/components/ListDetail";

export const dynamic = "force-dynamic";

export default async function ListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const household = await requireHousehold();
  const { id } = await params;
  const [list, catalogItems] = await Promise.all([
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
            item: { select: { id: true, name: true, emoji: true, defaultUnit: true } },
          },
        },
      },
    }),
    prisma.item.findMany({
      where: { householdId: household.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true, emoji: true, defaultUnit: true },
    }),
  ]);
  if (!list) notFound();
  return <ListDetail list={list} catalogItems={catalogItems} />;
}
