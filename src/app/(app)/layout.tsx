import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-guard";
import { getCurrentHousehold } from "@/lib/household-context";
import { LogoutButton } from "@/components/LogoutButton";
import { getDictionary, t } from "@/i18n";

const d = getDictionary("en");

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const household = await getCurrentHousehold();
  if (!household) redirect("/onboarding");

  return (
    <div className="min-h-screen">
      <nav className="flex items-center justify-between border-b border-border bg-white px-4 py-3">
        <span className="font-extrabold">{household.name}</span>
        <LogoutButton label={t(d, "auth.logout")} />
      </nav>
      <main>{children}</main>
    </div>
  );
}
