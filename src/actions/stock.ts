"use server";

import { requireHousehold } from "@/lib/household-context";
import { getCurrentUser } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import { setStockCore, adjustStockCore, removeStockCore } from "@/lib/mutations/stock";

type Result = { ok: true } | { ok: false; error: string };

export async function setStock(input: {
  itemId: string;
  quantity: number;
  unit: string;
  lowThreshold: number;
}): Promise<Result> {
  const household = await requireHousehold();
  const user = await getCurrentUser();
  const res = await setStockCore(household.id, user?.id ?? null, input);
  if (res.ok) revalidatePath("/stock");
  return res;
}

export async function adjustStock(input: { itemId: string; delta: number }): Promise<Result> {
  const household = await requireHousehold();
  const user = await getCurrentUser();
  const res = await adjustStockCore(household.id, user?.id ?? null, input);
  if (res.ok) revalidatePath("/stock");
  return res;
}

export async function removeStock(itemId: string): Promise<Result> {
  const household = await requireHousehold();
  const res = await removeStockCore(household.id, { itemId });
  if (res.ok) revalidatePath("/stock");
  return res;
}
