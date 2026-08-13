"use server";

import { requireHousehold } from "@/lib/household-context";
import { getCurrentUser } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import { addPriceEntryCore, updatePriceEntryCore, deletePriceEntryCore } from "@/lib/mutations/prices";

type Result = { ok: true } | { ok: false; error: string };

export async function addPriceEntry(input: {
  itemId: string;
  price: number;
  store?: string;
  purchasedAt?: string;
}): Promise<Result> {
  const household = await requireHousehold();
  const user = await getCurrentUser();
  const res = await addPriceEntryCore(household.id, user?.id ?? null, input);
  if (res.ok) revalidatePath("/prices");
  return res;
}

export async function updatePriceEntry(input: {
  entryId: string;
  price: number;
  store?: string;
  purchasedAt?: string;
}): Promise<Result> {
  const household = await requireHousehold();
  const res = await updatePriceEntryCore(household.id, input);
  if (res.ok) revalidatePath("/prices");
  return res;
}

export async function deletePriceEntry(entryId: string): Promise<Result> {
  const household = await requireHousehold();
  const res = await deletePriceEntryCore(household.id, { entryId });
  if (res.ok) revalidatePath("/prices");
  return res;
}
