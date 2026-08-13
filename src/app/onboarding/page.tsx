import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-guard";
import { getCurrentHousehold } from "@/lib/household-context";
import { OnboardingForm } from "@/components/OnboardingForm";
import { getDictionary, t } from "@/i18n";

const d = getDictionary("en");

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const household = await getCurrentHousehold();
  if (household) redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <h1 className="text-center text-2xl font-extrabold">{t(d, "onboarding.title")}</h1>
      <OnboardingForm />
    </div>
  );
}
