"use server";

import { del } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireHousehold } from "@/lib/household-context";
import { isBlobUrl } from "@/lib/blob";

type Result = { ok: true } | { ok: false; error: string };

async function ownedItem(householdId: string, itemId: string) {
  return prisma.item.findFirst({
    where: { id: itemId, householdId },
    select: { id: true, photoUrl: true },
  });
}

export async function setItemPhoto(input: {
  itemId: string;
  url: string;
  pathname: string;
}): Promise<Result> {
  const household = await requireHousehold();
  const item = await ownedItem(household.id, input.itemId);
  if (!item) return { ok: false, error: "Item not found" };
  if (!isBlobUrl(input.url)) return { ok: false, error: "Invalid photo URL" };
  if (item.photoUrl && isBlobUrl(item.photoUrl)) await del(item.photoUrl).catch(() => {});
  await prisma.item.update({
    where: { id: input.itemId },
    data: { photoUrl: input.url, photoPath: input.pathname },
  });
  revalidatePath("/items");
  return { ok: true };
}

export async function removeItemPhoto(itemId: string): Promise<Result> {
  const household = await requireHousehold();
  const item = await ownedItem(household.id, itemId);
  if (!item) return { ok: false, error: "Item not found" };
  if (item.photoUrl && isBlobUrl(item.photoUrl)) await del(item.photoUrl).catch(() => {});
  await prisma.item.update({
    where: { id: itemId },
    data: { photoUrl: null, photoPath: null },
  });
  revalidatePath("/items");
  return { ok: true };
}
