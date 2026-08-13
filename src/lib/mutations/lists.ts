import { prisma } from "@/lib/prisma";
import { clean } from "./util";

type Result = { ok: true } | { ok: false; error: string };
type CreateResult = { ok: true; id: string } | { ok: false; error: string };
type CompleteResult = { ok: true; carriedOverListId?: string } | { ok: false; error: string };

export async function createListCore(
  householdId: string,
  userId: string | null,
  input: { name: string },
): Promise<CreateResult> {
  const cleaned = clean(input.name);
  if (!cleaned) return { ok: false, error: "Please enter a list name" };
  const list = await prisma.groceryList.create({
    data: { householdId, name: cleaned, status: "draft", createdById: userId },
    select: { id: true },
  });
  return { ok: true, id: list.id };
}

export async function renameListCore(
  householdId: string,
  input: { id: string; name: string },
): Promise<Result> {
  const cleaned = clean(input.name);
  if (!cleaned) return { ok: false, error: "Please enter a list name" };
  const res = await prisma.groceryList.updateMany({
    where: { id: input.id, householdId },
    data: { name: cleaned },
  });
  if (res.count === 0) return { ok: false, error: "List not found" };
  return { ok: true };
}

export async function deleteListCore(
  householdId: string,
  input: { id: string },
): Promise<Result> {
  // ListItem rows cascade via the FK.
  const res = await prisma.groceryList.deleteMany({ where: { id: input.id, householdId } });
  if (res.count === 0) return { ok: false, error: "List not found" };
  return { ok: true };
}

export async function duplicateListCore(
  householdId: string,
  userId: string | null,
  input: { id: string },
): Promise<CreateResult> {
  const source = await prisma.groceryList.findFirst({
    where: { id: input.id, householdId },
    select: {
      name: true,
      items: { select: { itemId: true, quantity: true, unit: true, notes: true } },
    },
  });
  if (!source) return { ok: false, error: "List not found" };
  const copy = await prisma.groceryList.create({
    data: {
      householdId,
      name: `${source.name} (copy)`,
      status: "draft",
      createdById: userId,
      items: {
        create: source.items.map((li) => ({
          itemId: li.itemId,
          quantity: li.quantity,
          unit: li.unit,
          notes: li.notes,
        })),
      },
    },
    select: { id: true },
  });
  return { ok: true, id: copy.id };
}

export async function completeListCore(
  householdId: string,
  userId: string | null,
  input: { listId: string; carryOver: boolean },
): Promise<CompleteResult> {
  const list = await prisma.groceryList.findFirst({
    where: { id: input.listId, householdId },
    select: {
      name: true,
      items: { select: { itemId: true, quantity: true, unit: true, notes: true, isBought: true } },
    },
  });
  if (!list) return { ok: false, error: "List not found" };

  const unbought = list.items.filter((li) => !li.isBought);
  const shouldCarry = input.carryOver && unbought.length > 0;

  const carriedOverListId = await prisma.$transaction(async (tx) => {
    await tx.groceryList.update({
      where: { id: input.listId },
      data: { status: "completed", completedAt: new Date() },
    });
    if (!shouldCarry) return undefined as string | undefined;
    const copy = await tx.groceryList.create({
      data: {
        householdId,
        name: `${list.name} (carried over)`,
        status: "draft",
        createdById: userId,
        items: {
          create: unbought.map((li) => ({
            itemId: li.itemId,
            quantity: li.quantity,
            unit: li.unit,
            notes: li.notes,
          })),
        },
      },
      select: { id: true },
    });
    return copy.id;
  });

  return { ok: true, carriedOverListId };
}
