"use server";

import { prisma } from "@/lib/prisma";
import { requireHousehold } from "@/lib/household-context";
import { getCurrentUser } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";

type Result = { ok: true } | { ok: false; error: string };

function nonNeg(n: number, fallback: number): number {
  return Number.isFinite(n) ? Math.max(0, n) : fallback;
}

// Returns { id, defaultUnit } iff the item belongs to the household, else null.
async function ownedItem(householdId: string, itemId: string) {
  return prisma.item.findFirst({
    where: { id: itemId, householdId },
    select: { id: true, defaultUnit: true },
  });
}

export async function setStock(input: {
  itemId: string;
  quantity: number;
  unit: string;
  lowThreshold: number;
}): Promise<Result> {
  const household = await requireHousehold();
  const user = await getCurrentUser();
  const item = await ownedItem(household.id, input.itemId);
  if (!item) return { ok: false, error: "Item not found" };
  const quantity = nonNeg(input.quantity, 0);
  const lowThreshold = nonNeg(input.lowThreshold, 1);
  const unit = (input.unit ?? "").trim() || item.defaultUnit || "pcs";
  await prisma.stock.upsert({
    where: { householdId_itemId: { householdId: household.id, itemId: input.itemId } },
    update: { quantity, unit, lowThreshold, updatedById: user?.id ?? null },
    create: {
      householdId: household.id,
      itemId: input.itemId,
      quantity,
      unit,
      lowThreshold,
      updatedById: user?.id ?? null,
    },
  });
  revalidatePath("/stock");
  return { ok: true };
}

export async function adjustStock(input: { itemId: string; delta: number }): Promise<Result> {
  const household = await requireHousehold();
  const user = await getCurrentUser();
  const item = await ownedItem(household.id, input.itemId);
  if (!item) return { ok: false, error: "Item not found" };
  const delta = Number.isFinite(input.delta) ? input.delta : 0;
  const existing = await prisma.stock.findUnique({
    where: { householdId_itemId: { householdId: household.id, itemId: input.itemId } },
    select: { quantity: true },
  });
  const newQty = Math.max(0, (existing?.quantity ?? 0) + delta);
  await prisma.stock.upsert({
    where: { householdId_itemId: { householdId: household.id, itemId: input.itemId } },
    update: { quantity: newQty, updatedById: user?.id ?? null },
    create: {
      householdId: household.id,
      itemId: input.itemId,
      quantity: newQty,
      unit: item.defaultUnit || "pcs",
      lowThreshold: 1,
      updatedById: user?.id ?? null,
    },
  });
  revalidatePath("/stock");
  return { ok: true };
}

export async function removeStock(itemId: string): Promise<Result> {
  const household = await requireHousehold();
  const res = await prisma.stock.deleteMany({
    where: { householdId: household.id, itemId },
  });
  if (res.count === 0) return { ok: false, error: "Stock not found" };
  revalidatePath("/stock");
  return { ok: true };
}
