"use server";

import { prisma } from "@/lib/prisma";
import { requireHousehold } from "@/lib/household-context";
import { revalidatePath } from "next/cache";
import type { TagType } from "@prisma/client";

type Result = { ok: true } | { ok: false; error: string };

const TAG_TYPES = ["recipe", "store", "custom"] as const;
function isTagType(x: string): x is TagType {
  return (TAG_TYPES as readonly string[]).includes(x);
}
function clean(s: string | undefined | null): string | null {
  const v = (s ?? "").trim();
  return v ? v : null;
}

export async function createTag(input: {
  name: string;
  type: string;
  color?: string;
}): Promise<Result> {
  const household = await requireHousehold();
  const name = clean(input.name);
  if (!name) return { ok: false, error: "Please enter a tag name" };
  if (!isTagType(input.type)) return { ok: false, error: "Invalid tag type" };
  await prisma.tag.create({
    data: {
      householdId: household.id,
      name,
      type: input.type,
      color: clean(input.color) ?? "#3B82F6",
    },
  });
  revalidatePath("/tags");
  revalidatePath("/items");
  return { ok: true };
}

export async function updateTag(input: {
  id: string;
  name: string;
  type: string;
  color?: string;
}): Promise<Result> {
  const household = await requireHousehold();
  const name = clean(input.name);
  if (!name) return { ok: false, error: "Please enter a tag name" };
  if (!isTagType(input.type)) return { ok: false, error: "Invalid tag type" };
  const res = await prisma.tag.updateMany({
    where: { id: input.id, householdId: household.id },
    data: { name, type: input.type, color: clean(input.color) ?? "#3B82F6" },
  });
  if (res.count === 0) return { ok: false, error: "Tag not found" };
  revalidatePath("/tags");
  revalidatePath("/items");
  return { ok: true };
}

export async function deleteTag(id: string): Promise<Result> {
  const household = await requireHousehold();
  // ItemTag rows cascade away via the FK (onDelete: Cascade).
  const res = await prisma.tag.deleteMany({ where: { id, householdId: household.id } });
  if (res.count === 0) return { ok: false, error: "Tag not found" };
  revalidatePath("/tags");
  revalidatePath("/items");
  return { ok: true };
}

// True only if BOTH the item and the tag belong to this household.
async function bothOwned(householdId: string, itemId: string, tagId: string): Promise<boolean> {
  const [item, tag] = await Promise.all([
    prisma.item.findFirst({ where: { id: itemId, householdId }, select: { id: true } }),
    prisma.tag.findFirst({ where: { id: tagId, householdId }, select: { id: true } }),
  ]);
  return Boolean(item && tag);
}

export async function assignTag(input: { itemId: string; tagId: string }): Promise<Result> {
  const household = await requireHousehold();
  if (!(await bothOwned(household.id, input.itemId, input.tagId))) {
    return { ok: false, error: "Item or tag not found" };
  }
  await prisma.itemTag.upsert({
    where: { itemId_tagId: { itemId: input.itemId, tagId: input.tagId } },
    update: {},
    create: { itemId: input.itemId, tagId: input.tagId },
  });
  revalidatePath("/items");
  return { ok: true };
}

export async function unassignTag(input: { itemId: string; tagId: string }): Promise<Result> {
  const household = await requireHousehold();
  if (!(await bothOwned(household.id, input.itemId, input.tagId))) {
    return { ok: false, error: "Item or tag not found" };
  }
  await prisma.itemTag.deleteMany({
    where: { itemId: input.itemId, tagId: input.tagId },
  });
  revalidatePath("/items");
  return { ok: true };
}
