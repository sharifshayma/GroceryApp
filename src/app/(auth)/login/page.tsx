"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { logIn } from "@/actions/auth";
import { getDictionary, t } from "@/i18n";

const d = getDictionary("en");

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // On success logIn() redirects server-side (to "/", or back into
      // an in-progress OAuth /authorize flow) via next/navigation's redirect(),
      // which is handled entirely on the server — the client call below simply
      // never resolves to a handled value in that case, so there's nothing to
      // do here but let the navigation happen.
      const result = await logIn(email, password);
      if (result && !result.ok) {
        setError(result.error);
        setSubmitting(false);
      }
    } catch (e) {
      // On success logIn() calls next/navigation's redirect(), which throws a
      // NEXT_REDIRECT control-flow signal. When the action is awaited
      // imperatively (as here), that signal surfaces on the client and MUST be
      // re-thrown so Next performs the navigation — otherwise we'd flash a
      // bogus error just before the page redirects. unstable_rethrow re-throws
      // framework signals (redirect/notFound) and returns for everything else.
      unstable_rethrow(e);
      // A real failure (e.g. a DB hiccup logIn() couldn't handle): show the
      // generic error so the button doesn't stay stuck disabled.
      setError(t(d, "auth.login.genericError"));
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-border bg-white p-6 shadow-sm"
      >
        <h1 className="text-center text-xl font-extrabold">{t(d, "auth.login.title")}</h1>
        <Input
          id="email"
          type="email"
          label={t(d, "auth.login.email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          autoFocus
        />
        <Input
          id="password"
          type="password"
          label={t(d, "auth.login.password")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={submitting}>
          {submitting ? t(d, "common.saving") : t(d, "auth.login.submit")}
        </Button>
        <p className="text-center text-sm text-ink/60">
          <Link href="/signup" className="font-bold text-brand hover:underline">
            {t(d, "auth.login.noAccount")}
          </Link>
        </p>
        <p className="text-center text-sm text-ink/60">
          <Link href="/reset" className="font-bold text-brand hover:underline">
            {t(d, "auth.reset.title")}
          </Link>
        </p>
      </form>
    </div>
  );
}
