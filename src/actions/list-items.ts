"use server";

import { prisma } from "@/lib/prisma";
import { requireHousehold } from "@/lib/household-context";
import { revalidatePath } from "next/cache";

type Result = { ok: true } | { ok: false; error: string };

function clean(s: string | undefined | null): string | null {
  const v = (s ?? "").trim();
  return v ? v : null;
}

// True iff the list belongs to the household.
async function listOwned(householdId: string, listId: string): Promise<boolean> {
  const list = await prisma.groceryList.findFirst({
    where: { id: listId, householdId },
    select: { id: true },
  });
  return Boolean(list);
}

// Returns the list_item's listId iff its parent list belongs to the household, else null.
async function listItemListId(householdId: string, listItemId: string): Promise<string | null> {
  const li = await prisma.listItem.findFirst({
    where: { id: listItemId, list: { householdId } },
    select: { listId: true },
  });
  return li?.listId ?? null;
}

export async function addListItem(input: {
  listId: string;
  itemId: string;
  quantity: number;
  unit: string;
  notes?: string;
}): Promise<Result> {
  const household = await requireHousehold();
  if (!(await listOwned(household.id, input.listId))) return { ok: false, error: "List not found" };
  const item = await prisma.item.findFirst({
    where: { id: input.itemId, householdId: household.id },
    select: { id: true },
  });
  if (!item) return { ok: false, error: "Item not found" };
  await prisma.listItem.create({
    data: {
      listId: input.listId,
      itemId: input.itemId,
      quantity: Number.isFinite(input.quantity) && input.quantity > 0 ? input.quantity : 1,
      unit: clean(input.unit) ?? "pcs",
      notes: clean(input.notes),
    },
  });
  revalidatePath(`/lists/${input.listId}`);
  revalidatePath("/lists");
  return { ok: true };
}

export async function updateListItem(input: {
  listItemId: string;
  quantity: number;
  unit: string;
  notes?: string;
}): Promise<Result> {
  const household = await requireHousehold();
  const listId = await listItemListId(household.id, input.listItemId);
  if (!listId) return { ok: false, error: "List item not found" };
  await prisma.listItem.update({
    where: { id: input.listItemId },
    data: {
      quantity: Number.isFinite(input.quantity) && input.quantity > 0 ? input.quantity : 1,
      unit: clean(input.unit) ?? "pcs",
      notes: clean(input.notes),
    },
  });
  revalidatePath(`/lists/${listId}`);
  return { ok: true };
}

export async function removeListItem(listItemId: string): Promise<Result> {
  const household = await requireHousehold();
  const listId = await listItemListId(household.id, listItemId);
  if (!listId) return { ok: false, error: "List item not found" };
  await prisma.listItem.delete({ where: { id: listItemId } });
  revalidatePath(`/lists/${listId}`);
  return { ok: true };
}
