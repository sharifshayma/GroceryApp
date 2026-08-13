"use server";

import { auth } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-guard";
import { generateInviteCode } from "@/lib/invite-code";
import {
  signupSchema,
  createHouseholdSchema,
  joinHouseholdSchema,
  type SignupInput,
} from "@/lib/validations";

type Result = { ok: true } | { ok: false; error: string };

export async function signUp(input: SignupInput): Promise<Result> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid signup details" };
  const { email, password, displayName } = parsed.data;
  try {
    const res = await auth.api.signUpEmail({ body: { email, password, name: displayName } });
    await prisma.user.update({ where: { id: res.user.id }, data: { displayName } });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? (e as { body?: { message?: string } }).body?.message ?? e.message : "";
    if (msg.includes("USER_ALREADY_EXISTS")) return { ok: false, error: "That email is already registered" };
    return { ok: false, error: "Could not create the account" };
  }
}

export async function createHousehold(name: string): Promise<Result> {
  const parsed = createHouseholdSchema.safeParse({ name });
  if (!parsed.success) return { ok: false, error: "Please enter a household name" };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  // Retry on the (rare) inviteCode unique collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const hh = await prisma.household.create({
        data: { name: parsed.data.name, inviteCode: generateInviteCode(), createdById: user.id },
      });
      await prisma.user.update({
        where: { id: user.id },
        data: { householdId: hh.id, role: "owner" },
      });
      return { ok: true };
    } catch (e) {
      if (attempt === 4) return { ok: false, error: "Could not create the household" };
    }
  }
  return { ok: false, error: "Could not create the household" };
}

export async function joinHousehold(code: string): Promise<Result> {
  const parsed = joinHouseholdSchema.safeParse({ code });
  if (!parsed.success) return { ok: false, error: "Enter a valid 8-character code" };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Unauthorized" };
  const hh = await prisma.household.findUnique({ where: { inviteCode: parsed.data.code } });
  if (!hh) return { ok: false, error: "No household found for that code" };
  await prisma.user.update({
    where: { id: user.id },
    data: { householdId: hh.id, role: "member" },
  });
  return { ok: true };
}
