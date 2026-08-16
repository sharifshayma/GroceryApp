import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-guard";
import { getCurrentHousehold } from "@/lib/household-context";
import { getNeedToBuy } from "@/lib/mcp-queries";
import { LocaleProvider } from "@/i18n/LocaleProvider";
import { TabBar } from "@/components/TabBar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const household = await getCurrentHousehold();
  if (!household) redirect("/onboarding");

  const { lowCount } = await getNeedToBuy(household.id);

  return (
    <LocaleProvider locale={user.language}>
      <div className="min-h-screen bg-bg">
        <main className="max-w-lg mx-auto pb-20">{children}</main>
        <TabBar lowStockCount={lowCount} />
      </div>
    </LocaleProvider>
  );
}
