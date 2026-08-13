"use server";

import { prisma } from "@/lib/prisma";
import { requireHousehold } from "@/lib/household-context";
import { getCurrentUser } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";

type Result = { ok: true } | { ok: false; error: string };
type CreateResult = { ok: true; id: string } | { ok: false; error: string };

function clean(s: string | undefined | null): string | null {
  const v = (s ?? "").trim();
  return v ? v : null;
}

export async function createList({ name }: { name: string }): Promise<CreateResult> {
  const household = await requireHousehold();
  const user = await getCurrentUser();
  const cleaned = clean(name);
  if (!cleaned) return { ok: false, error: "Please enter a list name" };
  const list = await prisma.groceryList.create({
    data: { householdId: household.id, name: cleaned, status: "draft", createdById: user?.id ?? null },
    select: { id: true },
  });
  revalidatePath("/lists");
  return { ok: true, id: list.id };
}

export async function renameList({ id, name }: { id: string; name: string }): Promise<Result> {
  const household = await requireHousehold();
  const cleaned = clean(name);
  if (!cleaned) return { ok: false, error: "Please enter a list name" };
  const res = await prisma.groceryList.updateMany({
    where: { id, householdId: household.id },
    data: { name: cleaned },
  });
  if (res.count === 0) return { ok: false, error: "List not found" };
  revalidatePath("/lists");
  revalidatePath(`/lists/${id}`);
  return { ok: true };
}

export async function deleteList(id: string): Promise<Result> {
  const household = await requireHousehold();
  // ListItem rows cascade via the FK.
  const res = await prisma.groceryList.deleteMany({ where: { id, householdId: household.id } });
  if (res.count === 0) return { ok: false, error: "List not found" };
  revalidatePath("/lists");
  return { ok: true };
}

export async function duplicateList(id: string): Promise<CreateResult> {
  const household = await requireHousehold();
  const user = await getCurrentUser();
  const source = await prisma.groceryList.findFirst({
    where: { id, householdId: household.id },
    select: {
      name: true,
      items: { select: { itemId: true, quantity: true, unit: true, notes: true } },
    },
  });
  if (!source) return { ok: false, error: "List not found" };
  const copy = await prisma.groceryList.create({
    data: {
      householdId: household.id,
      name: `${source.name} (copy)`,
      status: "draft",
      createdById: user?.id ?? null,
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
  revalidatePath("/lists");
  return { ok: true, id: copy.id };
}

type CompleteResult =
  | { ok: true; carriedOverListId?: string }
  | { ok: false; error: string };

export async function completeList(input: {
  listId: string;
  carryOver: boolean;
}): Promise<CompleteResult> {
  const household = await requireHousehold();
  const user = await getCurrentUser();
  // Household-scoped load confirms ownership before we mutate by id below.
  const list = await prisma.groceryList.findFirst({
    where: { id: input.listId, householdId: household.id },
    select: {
      name: true,
      items: {
        select: { itemId: true, quantity: true, unit: true, notes: true, isBought: true },
      },
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
        householdId: household.id,
        name: `${list.name} (carried over)`,
        status: "draft",
        createdById: user?.id ?? null,
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

  revalidatePath("/lists");
  revalidatePath(`/lists/${input.listId}`);
  return { ok: true, carriedOverListId };
}
