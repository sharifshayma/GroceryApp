import { prisma } from "@/lib/prisma";
import { clean, normalizeQuantity } from "./util";
import { computeAutoTrack } from "@/lib/auto-track";

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
  // Household-scoped load also serves as the ownership gate.
  const line = await prisma.listItem.findFirst({
    where: { id: input.listItemId, list: { householdId } },
    select: {
      listId: true,
      itemId: true,
      quantity: true,
      stockUpdated: true,
      item: { select: { autoTrackStock: true, defaultUnit: true } },
    },
  });
  if (!line) return { ok: false, error: "List item not found" };

  const track =
    line.itemId && line.item
      ? computeAutoTrack({
          isBought: input.isBought,
          autoTrackStock: line.item.autoTrackStock,
          stockUpdated: line.stockUpdated,
          quantity: line.quantity,
        })
      : { stockDelta: null, stockUpdated: line.stockUpdated };

  await prisma.$transaction(async (tx) => {
    await tx.listItem.update({
      where: { id: input.listItemId },
      data: {
        isBought: input.isBought,
        boughtById: input.isBought ? userId : null,
        boughtAt: input.isBought ? new Date() : null,
        stockUpdated: track.stockUpdated,
      },
    });
    if (track.stockDelta !== null && line.itemId) {
      const existing = await tx.stock.findUnique({
        where: { householdId_itemId: { householdId, itemId: line.itemId } },
        select: { quantity: true },
      });
      const newQty = Math.max(0, (existing?.quantity ?? 0) + track.stockDelta);
      await tx.stock.upsert({
        where: { householdId_itemId: { householdId, itemId: line.itemId } },
        update: { quantity: newQty, updatedById: userId },
        create: {
          householdId,
          itemId: line.itemId,
          quantity: newQty,
          unit: line.item?.defaultUnit || "pcs",
          lowThreshold: 1,
          updatedById: userId,
        },
      });
    }
  });

  return { ok: true, listId: line.listId };
}
