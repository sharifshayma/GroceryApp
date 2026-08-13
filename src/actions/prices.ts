"use server";

import { prisma } from "@/lib/prisma";
import { requireHousehold } from "@/lib/household-context";
import { getCurrentUser } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";

type Result = { ok: true } | { ok: false; error: string };

function clean(s: string | undefined | null): string | null {
  const v = (s ?? "").trim();
  return v ? v : null;
}

function validPrice(n: number): number | null {
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Parse a YYYY-MM-DD string to a Date; invalid/empty → today.
function parseDate(s: string | undefined): Date {
  if (s) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

async function ownedItem(householdId: string, itemId: string) {
  return prisma.item.findFirst({ where: { id: itemId, householdId }, select: { id: true } });
}

export async function addPriceEntry(input: {
  itemId: string;
  price: number;
  store?: string;
  purchasedAt?: string;
}): Promise<Result> {
  const household = await requireHousehold();
  const user = await getCurrentUser();
  const item = await ownedItem(household.id, input.itemId);
  if (!item) return { ok: false, error: "Item not found" };
  const price = validPrice(input.price);
  if (price === null) return { ok: false, error: "Enter a valid price" };
  await prisma.priceHistory.create({
    data: {
      householdId: household.id,
      itemId: input.itemId,
      price,
      store: clean(input.store),
      purchasedAt: parseDate(input.purchasedAt),
      loggedById: user?.id ?? null,
    },
  });
  revalidatePath("/prices");
  return { ok: true };
}

export async function updatePriceEntry(input: {
  entryId: string;
  price: number;
  store?: string;
  purchasedAt?: string;
}): Promise<Result> {
  const household = await requireHousehold();
  const price = validPrice(input.price);
  if (price === null) return { ok: false, error: "Enter a valid price" };
  const res = await prisma.priceHistory.updateMany({
    where: { id: input.entryId, householdId: household.id },
    data: {
      price,
      store: clean(input.store),
      purchasedAt: parseDate(input.purchasedAt),
    },
  });
  if (res.count === 0) return { ok: false, error: "Price entry not found" };
  revalidatePath("/prices");
  return { ok: true };
}

export async function deletePriceEntry(entryId: string): Promise<Result> {
  const household = await requireHousehold();
  const res = await prisma.priceHistory.deleteMany({
    where: { id: entryId, householdId: household.id },
  });
  if (res.count === 0) return { ok: false, error: "Price entry not found" };
  revalidatePath("/prices");
  return { ok: true };
}
