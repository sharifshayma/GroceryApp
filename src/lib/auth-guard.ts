import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import type { Locale } from "@/i18n";

export type CurrentUser = { id: string; email: string; name: string; language: Locale };

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const { id, email, name } = session.user;
  const row = await prisma.user.findUnique({ where: { id }, select: { language: true } });
  return { id, email, name, language: (row?.language ?? "en") as Locale };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}
