import { prisma } from "@/lib/prisma";
import { clean, normalizeQuantity } from "./util";

type Result = { ok: true } | { ok: false; error: string };
type ResultWithList = { ok: true; listId: string } | { ok: false; error: string };

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

export async function addListItemCore(
  householdId: string,
  input: { listId: string; itemId: string; quantity: number; unit: string; notes?: string },
): Promise<Result> {
  if (!(await listOwned(householdId, input.listId))) return { ok: false, error: "List not found" };
  const item = await prisma.item.findFirst({
    where: { id: input.itemId, householdId },
    select: { id: true },
  });
  if (!item) return { ok: false, error: "Item not found" };
  await prisma.listItem.create({
    data: {
      listId: input.listId,
      itemId: input.itemId,
      quantity: normalizeQuantity(input.quantity),
      unit: clean(input.unit) ?? "pcs",
      notes: clean(input.notes),
    },
  });
  return { ok: true };
}

export async function updateListItemCore(
  householdId: string,
  input: { listItemId: string; quantity: number; unit: string; notes?: string },
): Promise<ResultWithList> {
  const listId = await listItemListId(householdId, input.listItemId);
  if (!listId) return { ok: false, error: "List item not found" };
  await prisma.listItem.update({
    where: { id: input.listItemId },
    data: {
      quantity: normalizeQuantity(input.quantity),
      unit: clean(input.unit) ?? "pcs",
      notes: clean(input.notes),
    },
  });
  return { ok: true, listId };
}

export async function removeListItemCore(
  householdId: string,
  input: { listItemId: string },
): Promise<ResultWithList> {
  const listId = await listItemListId(householdId, input.listItemId);
  if (!listId) return { ok: false, error: "List item not found" };
  await prisma.listItem.delete({ where: { id: input.listItemId } });
  return { ok: true, listId };
}

export async function setListItemBoughtCore(
  householdId: string,
  userId: string | null,
  input: { listItemId: string; isBought: boolean },
): Promise<ResultWithList> {
  const listId = await listItemListId(householdId, input.listItemId);
  if (!listId) return { ok: false, error: "List item not found" };
  await prisma.listItem.update({
    where: { id: input.listItemId },
    data: {
      isBought: input.isBought,
      boughtById: input.isBought ? userId : null,
      boughtAt: input.isBought ? new Date() : null,
    },
  });
  return { ok: true, listId };
}
