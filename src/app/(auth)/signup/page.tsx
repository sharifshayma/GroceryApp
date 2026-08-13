"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { signIn } from "@/lib/auth-client";
import { signUp } from "@/actions/auth";
import { getDictionary, t } from "@/i18n";

const d = getDictionary("en");

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const result = await signUp({ email, password, displayName });
    if (!result.ok) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    const { error: signInError } = await signIn.email({ email, password });
    setSubmitting(false);
    if (signInError) {
      setError("Account created, but sign-in failed. Please log in.");
      router.push("/login");
      return;
    }
    router.push("/onboarding");
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-border bg-white p-6 shadow-sm"
      >
        <h1 className="text-center text-xl font-extrabold">{t(d, "auth.signup.title")}</h1>
        <Input
          id="displayName"
          type="text"
          label={t(d, "auth.signup.name")}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          autoComplete="name"
          required
          autoFocus
        />
        <Input
          id="email"
          type="email"
          label={t(d, "auth.login.email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <Input
          id="password"
          type="password"
          label={t(d, "auth.login.password")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={submitting}>
          {submitting ? t(d, "common.saving") : t(d, "auth.signup.submit")}
        </Button>
        <p className="text-center text-sm text-ink/60">
          <Link href="/login" className="font-bold text-brand hover:underline">
            {t(d, "auth.signup.haveAccount")}
          </Link>
        </p>
      </form>
    </div>
  );
}
