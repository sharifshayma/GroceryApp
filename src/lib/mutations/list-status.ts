import { prisma } from "@/lib/prisma";
import type { ListStatus } from "@prisma/client";

type Result = { ok: true } | { ok: false; error: string };

export async function setListStatusCore(
  householdId: string,
  input: { id: string; status: ListStatus },
): Promise<Result> {
  // Household-scoped update in one query (matches renameListCore's pattern).
  const res = await prisma.groceryList.updateMany({
    where: { id: input.id, householdId },
    data: { status: input.status },
  });
  if (res.count === 0) return { ok: false, error: "List not found" };
  return { ok: true };
}
