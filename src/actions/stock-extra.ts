"use server";

import { revalidatePath } from "next/cache";
import { requireHousehold } from "@/lib/household-context";
import { setAutoTrackStockCore } from "@/lib/mutations/auto-track";

export async function setAutoTrackStock(
  itemId: string,
  autoTrackStock: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const household = await requireHousehold();
  const res = await setAutoTrackStockCore(household.id, { itemId, autoTrackStock });
  if (res.ok) {
    revalidatePath("/stock");
    revalidatePath("/");
  }
  return res;
}
