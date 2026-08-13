import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireHousehold } from "@/lib/household-context";
import { getDictionary, t } from "@/i18n";

export const dynamic = "force-dynamic";
const d = getDictionary("en");

export default async function DashboardPage() {
  const household = await requireHousehold();
  const [categoryCount, itemCount, tagCount] = await Promise.all([
    prisma.category.count({ where: { householdId: household.id } }),
    prisma.item.count({ where: { householdId: household.id } }),
    prisma.tag.count({ where: { householdId: household.id } }),
  ]);
  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="text-2xl font-extrabold">{t(d, "dashboard.title")}</h1>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Link href="/categories" className="rounded-2xl border border-border bg-white p-5 hover:border-brand">
          <div className="font-bold">{t(d, "catalog.nav.categories")}</div>
          <div className="text-sm text-ink/60">{categoryCount}</div>
        </Link>
        <Link href="/items" className="rounded-2xl border border-border bg-white p-5 hover:border-brand">
          <div className="font-bold">{t(d, "catalog.nav.items")}</div>
          <div className="text-sm text-ink/60">{itemCount}</div>
        </Link>
        <Link href="/tags" className="rounded-2xl border border-border bg-white p-5 hover:border-brand">
          <div className="font-bold">{t(d, "catalog.nav.tags")}</div>
          <div className="text-sm text-ink/60">{tagCount}</div>
        </Link>
      </div>
    </div>
  );
}
