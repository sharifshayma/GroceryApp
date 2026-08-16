import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

export function generateRawToken(): string {
  return "grocery_" + randomBytes(24).toString("base64url");
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function lastFour(raw: string): string {
  return raw.slice(-4);
}

export async function createMcpToken(
  userId: string,
  householdId: string,
  name: string | null,
): Promise<{ raw: string; id: string }> {
  const raw = generateRawToken();
  const row = await prisma.mcpToken.create({
    data: {
      tokenHash: hashToken(raw),
      householdId,
      userId,
      name: name?.trim() || null,
      lastFour: lastFour(raw),
    },
    select: { id: true },
  });
  return { raw, id: row.id };
}

export async function verifyMcpToken(
  rawBearer: string,
): Promise<{ householdId: string; userId: string; tokenId: string } | null> {
  const trimmed = rawBearer.trim();
  if (!trimmed) return null;
  const row = await prisma.mcpToken.findUnique({
    where: { tokenHash: hashToken(trimmed) },
    select: { id: true, householdId: true, userId: true },
  });
  if (!row) return null;
  // best-effort last-used update; never block the request on it
  void prisma.mcpToken
    .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});
  return { householdId: row.householdId, userId: row.userId, tokenId: row.id };
}

export async function listMcpTokens(userId: string) {
  return prisma.mcpToken.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, lastFour: true, createdAt: true, lastUsedAt: true },
  });
}

export async function revokeMcpToken(id: string, userId: string): Promise<boolean> {
  const res = await prisma.mcpToken.deleteMany({ where: { id, userId } });
  return res.count > 0;
}
