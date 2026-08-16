"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireHousehold } from "@/lib/household-context";
import { getCurrentUser } from "@/lib/auth-guard";
import { createListCore } from "@/lib/mutations/lists";
import { addListItemCore } from "@/lib/mutations/list-items";
import { setListStatusCore } from "@/lib/mutations/list-status";

export async function activateList(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const household = await requireHousehold();
  // Enforce a single active list per household: demote any other currently-active list to draft.
  await prisma.groceryList.updateMany({
    where: { householdId: household.id, status: "active", id: { not: id } },
    data: { status: "draft" },
  });
  const res = await setListStatusCore(household.id, { id, status: "active" });
  if (res.ok) { revalidatePath("/lists"); revalidatePath(`/lists/${id}`); }
  return res;
}

export async function createListWithItems(input: {
  name: string;
  items: { itemId: string; quantity: number; unit: string; notes?: string }[];
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const household = await requireHousehold();
  const user = await getCurrentUser();
  const created = await createListCore(household.id, user?.id ?? null, { name: input.name });
  if (!created.ok) return created;
  for (const it of input.items) {
    const added = await addListItemCore(household.id, { listId: created.id, itemId: it.itemId, quantity: it.quantity, unit: it.unit, notes: it.notes });
    if (!added.ok) return added;
  }
  revalidatePath("/lists");
  revalidatePath("/");
  return { ok: true, id: created.id };
}
