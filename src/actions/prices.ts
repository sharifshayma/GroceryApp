"use server";

import { prisma } from "@/lib/prisma";
import { requireHousehold } from "@/lib/household-context";
import { getCurrentUser } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import { addPriceEntryCore, updatePriceEntryCore, deletePriceEntryCore } from "@/lib/mutations/prices";

type Result = { ok: true } | { ok: false; error: string };

export type ItemPriceEntry = {
  id: string;
  price: number;
  currency: string;
  store: string | null;
  purchasedAt: string; // YYYY-MM-DD
  quantityAmount: number | null;
  quantityUnit: string | null;
};

// Read a single item's purchase-price history, scoped to the caller's
// household, most recent first, plus the cheapest entry on record.
export async function getItemPriceHistory(
  itemId: string,
): Promise<{ entries: ItemPriceEntry[]; cheapest: ItemPriceEntry | null }> {
  const household = await requireHousehold();
  const rows = await prisma.priceHistory.findMany({
    where: { householdId: household.id, itemId },
    orderBy: [{ purchasedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      price: true,
      currency: true,
      store: true,
      purchasedAt: true,
      quantityAmount: true,
      quantityUnit: true,
    },
  });
  const entries: ItemPriceEntry[] = rows.map((r) => ({
    id: r.id,
    price: Number(r.price),
    currency: r.currency,
    store: r.store,
    purchasedAt: r.purchasedAt.toISOString().slice(0, 10),
    quantityAmount: r.quantityAmount,
    quantityUnit: r.quantityUnit,
  }));
  const cheapest = entries.reduce<ItemPriceEntry | null>(
    (min, e) => (min === null || e.price < min.price ? e : min),
    null,
  );
  return { entries, cheapest };
}

export async function addPriceEntry(input: {
  itemId: string;
  price: number;
  store?: string;
  purchasedAt?: string;
  quantityAmount?: number | null;
  quantityUnit?: string;
}): Promise<Result> {
  const household = await requireHousehold();
  const user = await getCurrentUser();
  const res = await addPriceEntryCore(household.id, user?.id ?? null, input);
  if (res.ok) revalidatePath("/prices");
  return res;
}

export async function updatePriceEntry(input: {
  entryId: string;
  price: number;
  store?: string;
  purchasedAt?: string;
  quantityAmount?: number | null;
  quantityUnit?: string;
}): Promise<Result> {
  const household = await requireHousehold();
  const res = await updatePriceEntryCore(household.id, input);
  if (res.ok) revalidatePath("/prices");
  return res;
}

export async function deletePriceEntry(entryId: string): Promise<Result> {
  const household = await requireHousehold();
  const res = await deletePriceEntryCore(household.id, { entryId });
  if (res.ok) revalidatePath("/prices");
  return res;
}
