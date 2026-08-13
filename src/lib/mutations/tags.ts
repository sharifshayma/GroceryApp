import { prisma } from "@/lib/prisma";

type Result = { ok: true } | { ok: false; error: string };

// True only if BOTH the item and the tag belong to this household.
async function bothOwned(householdId: string, itemId: string, tagId: string): Promise<boolean> {
  const [item, tag] = await Promise.all([
    prisma.item.findFirst({ where: { id: itemId, householdId }, select: { id: true } }),
    prisma.tag.findFirst({ where: { id: tagId, householdId }, select: { id: true } }),
  ]);
  return Boolean(item && tag);
}

export async function assignTagCore(
  householdId: string,
  input: { itemId: string; tagId: string },
): Promise<Result> {
  if (!(await bothOwned(householdId, input.itemId, input.tagId))) {
    return { ok: false, error: "Item or tag not found" };
  }
  await prisma.itemTag.upsert({
    where: { itemId_tagId: { itemId: input.itemId, tagId: input.tagId } },
    update: {},
    create: { itemId: input.itemId, tagId: input.tagId },
  });
  return { ok: true };
}

export async function unassignTagCore(
  householdId: string,
  input: { itemId: string; tagId: string },
): Promise<Result> {
  if (!(await bothOwned(householdId, input.itemId, input.tagId))) {
    return { ok: false, error: "Item or tag not found" };
  }
  await prisma.itemTag.deleteMany({ where: { itemId: input.itemId, tagId: input.tagId } });
  return { ok: true };
}
