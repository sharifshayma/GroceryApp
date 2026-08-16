"use server";

import { requireHousehold } from "@/lib/household-context";
import { getCurrentUser } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import {
  addListItemCore,
  updateListItemCore,
  removeListItemCore,
  setListItemBoughtCore,
} from "@/lib/mutations/list-items";

type Result = { ok: true } | { ok: false; error: string };

export async function addListItem(input: {
  listId: string;
  itemId: string;
  quantity: number;
  unit: string;
  notes?: string;
}): Promise<Result> {
  const household = await requireHousehold();
  const res = await addListItemCore(household.id, input);
  if (res.ok) {
    revalidatePath(`/lists/${input.listId}`);
    revalidatePath("/lists");
  }
  return res;
}

export async function updateListItem(input: {
  listItemId: string;
  quantity: number;
  unit: string;
  notes?: string;
}): Promise<Result> {
  const household = await requireHousehold();
  const res = await updateListItemCore(household.id, input);
  if (!res.ok) return res;
  revalidatePath(`/lists/${res.listId}`);
  return { ok: true };
}

export async function removeListItem(listItemId: string): Promise<Result> {
  const household = await requireHousehold();
  const res = await removeListItemCore(household.id, { listItemId });
  if (!res.ok) return res;
  revalidatePath(`/lists/${res.listId}`);
  return { ok: true };
}

export async function setListItemBought(input: {
  listItemId: string;
  isBought: boolean;
}): Promise<Result> {
  const household = await requireHousehold();
  const user = await getCurrentUser();
  const res = await setListItemBoughtCore(household.id, user?.id ?? null, input);
  if (!res.ok) return res;
  revalidatePath(`/lists/${res.listId}`);
  return { ok: true };
}
