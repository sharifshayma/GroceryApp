"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guard";

export async function updateDisplayName(
  name: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Please enter a name" };
  const user = await requireUser();
  await prisma.user.update({ where: { id: user.id }, data: { displayName: trimmed } });
  revalidatePath("/profile");
  return { ok: true };
}
