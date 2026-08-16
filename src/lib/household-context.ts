import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-guard";
import type { Household } from "@prisma/client";

export const getCurrentHousehold = cache(async (): Promise<Household | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { household: true },
  });
  return row?.household ?? null;
});

export async function requireHousehold(): Promise<Household> {
  const hh = await getCurrentHousehold();
  if (!hh) throw new Error("No household");
  return hh;
}
