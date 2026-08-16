"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guard";
import type { Locale } from "@/i18n";

export async function setLanguage(locale: Locale): Promise<void> {
  if (locale !== "en" && locale !== "he") return;
  const user = await requireUser();
  await prisma.user.update({ where: { id: user.id }, data: { language: locale } });
  revalidatePath("/", "layout");
}
