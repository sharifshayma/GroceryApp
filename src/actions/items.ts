"use server";

import { requireHousehold } from "@/lib/household-context";
import { getCurrentUser } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import { createItemCore, updateItemCore, deleteItemCore } from "@/lib/mutations/items";

type Result = { ok: true } | { ok: false; error: string };

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
  const res = await createItemCore(household.id, user?.id ?? null, input);
  if (res.ok) revalidatePath("/items");
  return res;
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
  const res = await updateItemCore(household.id, input);
  if (res.ok) revalidatePath("/items");
  return res;
}

export async function deleteItem(id: string): Promise<Result> {
  const household = await requireHousehold();
  const res = await deleteItemCore(household.id, { id });
  if (res.ok) revalidatePath("/items");
  return res;
}
