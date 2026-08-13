"use server";

import { prisma } from "@/lib/prisma";
import { requireHousehold } from "@/lib/household-context";
import { revalidatePath } from "next/cache";
import type { TagType } from "@prisma/client";
import { assignTagCore, unassignTagCore } from "@/lib/mutations/tags";

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

export async function assignTag(input: { itemId: string; tagId: string }): Promise<Result> {
  const household = await requireHousehold();
  const res = await assignTagCore(household.id, input);
  if (res.ok) revalidatePath("/items");
  return res;
}

export async function unassignTag(input: { itemId: string; tagId: string }): Promise<Result> {
  const household = await requireHousehold();
  const res = await unassignTagCore(household.id, input);
  if (res.ok) revalidatePath("/items");
  return res;
}
