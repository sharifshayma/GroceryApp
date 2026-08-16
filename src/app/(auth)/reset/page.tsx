"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { authClient } from "@/lib/auth-client";
import { getDictionary, t } from "@/i18n";

const d = getDictionary("en");

export default function ResetPage() {
  const router = useRouter();
  const [stage, setStage] = useState<"request" | "confirm">("request");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function sendCode() {
    setError(null);
    setSubmitting(true);
    const { error: sendError } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "forget-password",
    });
    setSubmitting(false);
    if (sendError) {
      setError("Could not send the reset code");
      return;
    }
    setStage("confirm");
  }

  function handleSendCode(e: FormEvent) {
    e.preventDefault();
    void sendCode();
  }

  async function handleResetPassword(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: resetError } = await authClient.emailOtp.resetPassword({
      email,
      otp,
      password,
    });
    setSubmitting(false);
    if (resetError) {
      setError("Invalid or expired code");
      return;
    }
    router.push("/login");
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form
        onSubmit={stage === "request" ? handleSendCode : handleResetPassword}
        className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-border bg-white p-6 shadow-sm"
      >
        <h1 className="text-center text-xl font-extrabold">{t(d, "auth.reset.title")}</h1>

        {stage === "request" ? (
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
        ) : (
          <>
            <Input
              id="otp"
              type="text"
              inputMode="numeric"
              label={t(d, "auth.reset.code")}
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              required
              autoFocus
            />
            <Input
              id="password"
              type="password"
              label={t(d, "auth.reset.newPassword")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={submitting}>
          {submitting
            ? t(d, "common.saving")
            : stage === "request"
              ? t(d, "auth.reset.sendCode")
              : t(d, "auth.reset.submit")}
        </Button>
        {stage === "confirm" && (
          <button
            type="button"
            disabled={submitting}
            onClick={() => void sendCode()}
            className="text-center text-sm font-bold text-ink/60 hover:text-ink"
          >
            {t(d, "auth.reset.sendCode")}
          </button>
        )}
      </form>
    </div>
  );
}
