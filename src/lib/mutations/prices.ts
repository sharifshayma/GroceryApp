import { prisma } from "@/lib/prisma";
import { clean } from "./util";

type Result = { ok: true } | { ok: false; error: string };

export function validPrice(n: number): number | null {
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Parse a YYYY-MM-DD string to a Date; invalid/empty → today.
export function parseDate(s: string | undefined): Date {
  if (s) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

async function ownedItem(householdId: string, itemId: string) {
  return prisma.item.findFirst({ where: { id: itemId, householdId }, select: { id: true } });
}

export async function addPriceEntryCore(
  householdId: string,
  userId: string | null,
  input: { itemId: string; price: number; store?: string; purchasedAt?: string },
): Promise<Result> {
  const item = await ownedItem(householdId, input.itemId);
  if (!item) return { ok: false, error: "Item not found" };
  const price = validPrice(input.price);
  if (price === null) return { ok: false, error: "Enter a valid price" };
  await prisma.priceHistory.create({
    data: {
      householdId,
      itemId: input.itemId,
      price,
      store: clean(input.store),
      purchasedAt: parseDate(input.purchasedAt),
      loggedById: userId,
    },
  });
  return { ok: true };
}

export async function updatePriceEntryCore(
  householdId: string,
  input: { entryId: string; price: number; store?: string; purchasedAt?: string },
): Promise<Result> {
  const price = validPrice(input.price);
  if (price === null) return { ok: false, error: "Enter a valid price" };
  const res = await prisma.priceHistory.updateMany({
    where: { id: input.entryId, householdId },
    data: { price, store: clean(input.store), purchasedAt: parseDate(input.purchasedAt) },
  });
  if (res.count === 0) return { ok: false, error: "Price entry not found" };
  return { ok: true };
}

export async function deletePriceEntryCore(
  householdId: string,
  input: { entryId: string },
): Promise<Result> {
  const res = await prisma.priceHistory.deleteMany({ where: { id: input.entryId, householdId } });
  if (res.count === 0) return { ok: false, error: "Price entry not found" };
  return { ok: true };
}
