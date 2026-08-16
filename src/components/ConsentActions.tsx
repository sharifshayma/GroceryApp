"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { getDictionary, t } from "@/i18n";
import { submitOAuthConsent } from "@/actions/oauth-consent";

const d = getDictionary("en");

export function ConsentActions({ consentCode }: { consentCode: string }) {
  const [pending, startTransition] = useTransition();
  const [action, setAction] = useState<"approve" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);

  function submit(accept: boolean) {
    setError(null);
    setAction(accept ? "approve" : "deny");
    startTransition(async () => {
      const result = await submitOAuthConsent(accept, consentCode);
      // On success submitOAuthConsent redirects server-side and never resolves
      // with a value; a resolved value here means it failed.
      if (result?.error) {
        setError(t(d, result.error));
        setAction(null);
      }
    });
  }

  return (
    <div className="mt-6">
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <div className="flex gap-3">
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={() => submit(false)}
          className="flex-1"
        >
          {pending && action === "deny" ? t(d, "oauth.consent.denying") : t(d, "oauth.consent.deny")}
        </Button>
        <Button type="button" disabled={pending} onClick={() => submit(true)} className="flex-1">
          {pending && action === "approve" ? t(d, "oauth.consent.approving") : t(d, "oauth.consent.approve")}
        </Button>
      </div>
    </div>
  );
}
