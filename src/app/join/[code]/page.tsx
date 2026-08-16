import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-guard";
import { getCurrentHousehold } from "@/lib/household-context";
import { joinHousehold } from "@/actions/auth";
import { getDictionary, t } from "@/i18n";

export const dynamic = "force-dynamic";

const d = getDictionary("en");

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const household = await getCurrentHousehold();
  if (household) redirect("/");

  const res = await joinHousehold(code);
  if (res.ok) redirect("/");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bg p-4 text-center">
      <h1 className="text-2xl font-extrabold text-text">{t(d, "onboarding.inviteFailed.heading")}</h1>
      <p className="text-text-secondary">{res.error}</p>
      <Link
        href="/onboarding"
        className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-6 py-2.5 text-base font-bold text-white transition-colors hover:bg-primary-dark"
      >
        {t(d, "onboarding.inviteFailed.cta")}
      </Link>
    </div>
  );
}
