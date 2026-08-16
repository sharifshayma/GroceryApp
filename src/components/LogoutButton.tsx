"use client";

import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/Button";
import { useT } from "@/i18n/LocaleProvider";

export function LogoutButton({ label }: { label?: string }) {
  const router = useRouter();
  const { t } = useT();

  async function handleLogout() {
    await signOut();
    router.push("/login");
  }

  return (
    <Button variant="ghost" size="sm" onClick={() => void handleLogout()}>
      {label ?? t("auth.logout")}
    </Button>
  );
}
