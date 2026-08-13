import { prisma } from "@/lib/prisma";
import { requireHousehold } from "@/lib/household-context";
import { CategoryManager } from "@/components/CategoryManager";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const household = await requireHousehold();
  const categories = await prisma.category.findMany({
    where: { householdId: household.id },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, nameHe: true, emoji: true, sortOrder: true },
  });
  return <CategoryManager categories={categories} />;
}
