import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-guard";
import { getCurrentHousehold } from "@/lib/household-context";
import { listMcpTokens } from "@/lib/mcp-token";
import { prisma } from "@/lib/prisma";
import { ProfileClient } from "@/components/profile/ProfileClient";
import { McpTokensCard } from "@/components/McpTokensCard";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const household = await getCurrentHousehold();
  if (!household) redirect("/onboarding");

  const [profile, members, tokens] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id }, select: { displayName: true } }),
    prisma.user.findMany({
      where: { householdId: household.id },
      select: { id: true, displayName: true, email: true },
    }),
    listMcpTokens(user.id),
  ]);

  const base = (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  const endpoint = base + "/api/mcp";

  return (
    <div className="px-4 pt-6 pb-8 space-y-6">
      <ProfileClient
        user={{ id: user.id, email: user.email, displayName: profile?.displayName ?? null }}
        household={{ name: household.name, inviteCode: household.inviteCode }}
        members={members}
        currentUserId={user.id}
      />
      <McpTokensCard
        initialTokens={tokens.map((tk) => ({
          id: tk.id,
          name: tk.name,
          lastFour: tk.lastFour,
          createdAt: tk.createdAt.toISOString(),
          lastUsedAt: tk.lastUsedAt ? tk.lastUsedAt.toISOString() : null,
        }))}
        endpoint={endpoint}
      />
    </div>
  );
}
