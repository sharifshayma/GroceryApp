"use server";

import { revalidatePath } from "next/cache";
import { requireHousehold } from "@/lib/household-context";
import { getCurrentUser } from "@/lib/auth-guard";
import { createListCore } from "@/lib/mutations/lists";
import { addListItemCore } from "@/lib/mutations/list-items";

export async function createListAndAddItem(input: {
  name: string;
  itemId: string;
  quantity: number;
  unit: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const household = await requireHousehold();
  const user = await getCurrentUser();
  const created = await createListCore(household.id, user?.id ?? null, { name: input.name });
  if (!created.ok) return created;
  const added = await addListItemCore(household.id, {
    listId: created.id,
    itemId: input.itemId,
    quantity: input.quantity,
    unit: input.unit,
  });
  if (!added.ok) return added;
  revalidatePath("/");
  revalidatePath("/lists");
  return { ok: true, id: created.id };
}
