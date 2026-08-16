import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-guard";
import { getCurrentHousehold } from "@/lib/household-context";
import { prisma } from "@/lib/prisma";
import { ProfileClient } from "@/components/profile/ProfileClient";
import { McpTokensCard } from "@/components/McpTokensCard";
import { LogoutButton } from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const household = await getCurrentHousehold();
  if (!household) redirect("/onboarding");

  const [profile, members] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id }, select: { displayName: true } }),
    prisma.user.findMany({
      where: { householdId: household.id },
      select: { id: true, displayName: true, email: true },
    }),
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
      <McpTokensCard endpoint={endpoint} />
      {/* Sign out — kept at the very bottom of the profile page */}
      <div className="flex justify-center pt-2">
        <LogoutButton />
      </div>
    </div>
  );
}
