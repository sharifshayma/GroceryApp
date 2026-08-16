"use server";

import { prisma } from "@/lib/prisma";
import { requireHousehold } from "@/lib/household-context";
import { revalidatePath } from "next/cache";
import { swapOrder } from "@/lib/reorder";

type Result = { ok: true } | { ok: false; error: string };

function clean(s: string | undefined | null): string | null {
  const v = (s ?? "").trim();
  return v ? v : null;
}

export async function createCategory(input: {
  name: string;
  nameHe?: string;
  emoji?: string;
}): Promise<Result> {
  const household = await requireHousehold();
  const name = clean(input.name);
  if (!name) return { ok: false, error: "Please enter a category name" };
  const max = await prisma.category.aggregate({
    where: { householdId: household.id },
    _max: { sortOrder: true },
  });
  await prisma.category.create({
    data: {
      householdId: household.id,
      name,
      nameHe: clean(input.nameHe),
      emoji: clean(input.emoji) ?? "📦",
      sortOrder: (max._max.sortOrder ?? 0) + 1,
    },
  });
  revalidatePath("/categories");
  revalidatePath("/items");
  return { ok: true };
}

export async function updateCategory(input: {
  id: string;
  name: string;
  nameHe?: string;
  emoji?: string;
}): Promise<Result> {
  const household = await requireHousehold();
  const name = clean(input.name);
  if (!name) return { ok: false, error: "Please enter a category name" };
  const res = await prisma.category.updateMany({
    where: { id: input.id, householdId: household.id },
    data: { name, nameHe: clean(input.nameHe), emoji: clean(input.emoji) ?? "📦" },
  });
  if (res.count === 0) return { ok: false, error: "Category not found" };
  revalidatePath("/categories");
  revalidatePath("/items");
  return { ok: true };
}

export async function deleteCategory(id: string): Promise<Result> {
  const household = await requireHousehold();
  // Items keep existing; their categoryId is nulled by the FK (SetNull).
  const res = await prisma.category.deleteMany({
    where: { id, householdId: household.id },
  });
  if (res.count === 0) return { ok: false, error: "Category not found" };
  revalidatePath("/categories");
  revalidatePath("/items");
  return { ok: true };
}

export async function moveCategory(input: {
  id: string;
  direction: "up" | "down";
}): Promise<Result> {
  const household = await requireHousehold();
  const ordered = await prisma.category.findMany({
    where: { householdId: household.id },
    select: { id: true, sortOrder: true },
    orderBy: { sortOrder: "asc" },
  });
  const updates = swapOrder(ordered, input.id, input.direction);
  if (updates.length === 0) return { ok: true }; // no-op at edge / unknown id
  await prisma.$transaction(
    updates.map((u) =>
      prisma.category.update({
        where: { id: u.id },
        data: { sortOrder: u.sortOrder },
      }),
    ),
  );
  revalidatePath("/categories");
  revalidatePath("/items");
  return { ok: true };
}
