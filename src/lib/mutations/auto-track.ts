import { prisma } from "@/lib/prisma";

type Result = { ok: true } | { ok: false; error: string };

export async function setAutoTrackStockCore(
  householdId: string,
  input: { itemId: string; autoTrackStock: boolean },
): Promise<Result> {
  const res = await prisma.item.updateMany({
    where: { id: input.itemId, householdId },
    data: { autoTrackStock: input.autoTrackStock },
  });
  if (res.count === 0) return { ok: false, error: "Item not found" };
  return { ok: true };
}
