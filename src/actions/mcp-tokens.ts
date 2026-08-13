"use server";

import { requireUser } from "@/lib/auth-guard";
import { requireHousehold } from "@/lib/household-context";
import { createMcpToken, revokeMcpToken } from "@/lib/mcp-token";

export async function generateMcpToken({
  name,
}: {
  name: string;
}): Promise<{ ok: true; raw: string } | { ok: false; error: string }> {
  const user = await requireUser();
  const household = await requireHousehold();
  const clean = name.trim();
  if (!clean) return { ok: false, error: "Name is required" };
  if (clean.length > 60) return { ok: false, error: "Name is too long" };
  const { raw } = await createMcpToken(user.id, household.id, clean);
  return { ok: true, raw };
}

export async function revokeMcpTokenAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  const ok = await revokeMcpToken(id, user.id);
  if (!ok) return { ok: false, error: "Token not found" };
  return { ok: true };
}
