"use server";

import { requireHousehold } from "@/lib/household-context";
import { getCurrentUser } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import {
  createListCore,
  renameListCore,
  deleteListCore,
  duplicateListCore,
  completeListCore,
} from "@/lib/mutations/lists";

type Result = { ok: true } | { ok: false; error: string };
type CreateResult = { ok: true; id: string } | { ok: false; error: string };
type CompleteResult = { ok: true; carriedOverListId?: string } | { ok: false; error: string };

export async function createList({ name }: { name: string }): Promise<CreateResult> {
  const household = await requireHousehold();
  const user = await getCurrentUser();
  const res = await createListCore(household.id, user?.id ?? null, { name });
  if (res.ok) revalidatePath("/lists");
  return res;
}

export async function renameList({ id, name }: { id: string; name: string }): Promise<Result> {
  const household = await requireHousehold();
  const res = await renameListCore(household.id, { id, name });
  if (res.ok) {
    revalidatePath("/lists");
    revalidatePath(`/lists/${id}`);
  }
  return res;
}

export async function deleteList(id: string): Promise<Result> {
  const household = await requireHousehold();
  const res = await deleteListCore(household.id, { id });
  if (res.ok) revalidatePath("/lists");
  return res;
}

export async function duplicateList(id: string): Promise<CreateResult> {
  const household = await requireHousehold();
  const user = await getCurrentUser();
  const res = await duplicateListCore(household.id, user?.id ?? null, { id });
  if (res.ok) revalidatePath("/lists");
  return res;
}

export async function completeList(input: {
  listId: string;
  carryOver: boolean;
}): Promise<CompleteResult> {
  const household = await requireHousehold();
  const user = await getCurrentUser();
  const res = await completeListCore(household.id, user?.id ?? null, input);
  if (res.ok) {
    revalidatePath("/lists");
    revalidatePath(`/lists/${input.listId}`);
  }
  return res;
}
