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

// Returns the categoryId if it belongs to this household, null if none given,
// or false if a non-null id doesn't belong to the household.
async function resolveCategoryId(
  householdId: string,
  categoryId: string | null | undefined,
): Promise<string | null | false> {
  if (!categoryId) return null;
  const cat = await prisma.category.findFirst({
    where: { id: categoryId, householdId },
    select: { id: true },
  });
  return cat ? cat.id : false;
}

export async function createItem(input: {
  categoryId?: string | null;
  name: string;
  nameHe?: string;
  emoji?: string;
  defaultUnit?: string;
  notes?: string;
}): Promise<Result> {
  const household = await requireHousehold();
  const user = await getCurrentUser();
  const name = clean(input.name);
  if (!name) return { ok: false, error: "Please enter an item name" };
  const categoryId = await resolveCategoryId(household.id, input.categoryId);
  if (categoryId === false) return { ok: false, error: "That category doesn't exist" };
  await prisma.item.create({
    data: {
      householdId: household.id,
      categoryId,
      name,
      nameHe: clean(input.nameHe),
      emoji: clean(input.emoji) ?? "🛒",
      defaultUnit: clean(input.defaultUnit) ?? "pcs",
      notes: clean(input.notes),
      createdById: user?.id ?? null,
    },
  });
  revalidatePath("/items");
  return { ok: true };
}

export async function updateItem(input: {
  id: string;
  categoryId?: string | null;
  name: string;
  nameHe?: string;
  emoji?: string;
  defaultUnit?: string;
  notes?: string;
}): Promise<Result> {
  const household = await requireHousehold();
  const name = clean(input.name);
  if (!name) return { ok: false, error: "Please enter an item name" };
  const categoryId = await resolveCategoryId(household.id, input.categoryId);
  if (categoryId === false) return { ok: false, error: "That category doesn't exist" };
  const res = await prisma.item.updateMany({
    where: { id: input.id, householdId: household.id },
    data: {
      categoryId,
      name,
      nameHe: clean(input.nameHe),
      emoji: clean(input.emoji) ?? "🛒",
      defaultUnit: clean(input.defaultUnit) ?? "pcs",
      notes: clean(input.notes),
    },
  });
  if (res.count === 0) return { ok: false, error: "Item not found" };
  revalidatePath("/items");
  return { ok: true };
}

export async function deleteItem(id: string): Promise<Result> {
  const household = await requireHousehold();
  const res = await prisma.item.deleteMany({
    where: { id, householdId: household.id },
  });
  if (res.count === 0) return { ok: false, error: "Item not found" };
  revalidatePath("/items");
  return { ok: true };
}
