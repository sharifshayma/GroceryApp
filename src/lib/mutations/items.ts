import { prisma } from "@/lib/prisma";
import { clean } from "./util";

type Result = { ok: true } | { ok: false; error: string };

// Returns the categoryId if it belongs to this household, null if none given,
// or false if a non-null id doesn't belong to the household.
export async function resolveCategoryId(
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

export async function createItemCore(
  householdId: string,
  userId: string | null,
  input: { categoryId?: string | null; name: string; nameHe?: string; emoji?: string; defaultUnit?: string; notes?: string; autoTrackStock?: boolean },
): Promise<Result> {
  const name = clean(input.name);
  if (!name) return { ok: false, error: "Please enter an item name" };
  const categoryId = await resolveCategoryId(householdId, input.categoryId);
  if (categoryId === false) return { ok: false, error: "That category doesn't exist" };
  await prisma.item.create({
    data: {
      householdId,
      categoryId,
      name,
      nameHe: clean(input.nameHe),
      emoji: clean(input.emoji) ?? "🛒",
      defaultUnit: clean(input.defaultUnit) ?? "pcs",
      notes: clean(input.notes),
      autoTrackStock: input.autoTrackStock ?? true,
      createdById: userId,
    },
  });
  return { ok: true };
}

export async function updateItemCore(
  householdId: string,
  input: { id: string; categoryId?: string | null; name: string; nameHe?: string; emoji?: string; defaultUnit?: string; notes?: string; autoTrackStock?: boolean },
): Promise<Result> {
  const name = clean(input.name);
  if (!name) return { ok: false, error: "Please enter an item name" };
  const categoryId = await resolveCategoryId(householdId, input.categoryId);
  if (categoryId === false) return { ok: false, error: "That category doesn't exist" };
  const res = await prisma.item.updateMany({
    where: { id: input.id, householdId },
    data: {
      categoryId,
      name,
      nameHe: clean(input.nameHe),
      emoji: clean(input.emoji) ?? "🛒",
      defaultUnit: clean(input.defaultUnit) ?? "pcs",
      notes: clean(input.notes),
      ...(input.autoTrackStock !== undefined ? { autoTrackStock: input.autoTrackStock } : {}),
    },
  });
  if (res.count === 0) return { ok: false, error: "Item not found" };
  return { ok: true };
}

export async function deleteItemCore(householdId: string, input: { id: string }): Promise<Result> {
  const res = await prisma.item.deleteMany({ where: { id: input.id, householdId } });
  if (res.count === 0) return { ok: false, error: "Item not found" };
  return { ok: true };
}
