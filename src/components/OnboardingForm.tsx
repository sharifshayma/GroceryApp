"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { createHousehold, joinHousehold } from "@/actions/auth";
import { getDictionary, t } from "@/i18n";

const d = getDictionary("en");

export function OnboardingForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    const result = await createHousehold(name);
    setCreating(false);
    if (!result.ok) {
      setCreateError(result.error);
      return;
    }
    router.push("/");
  }

  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    setJoinError(null);
    setJoining(true);
    const result = await joinHousehold(code);
    setJoining(false);
    if (!result.ok) {
      setJoinError(result.error);
      return;
    }
    router.push("/");
  }

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 p-4 sm:grid-cols-2">
      <form
        onSubmit={handleCreate}
        className="flex flex-col gap-4 rounded-2xl border border-border bg-white p-6 shadow-sm"
      >
        <h2 className="text-lg font-extrabold">{t(d, "onboarding.create.heading")}</h2>
        <Input
          id="householdName"
          type="text"
          label={t(d, "onboarding.create.name")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
        />
        {createError && <p className="text-sm text-red-600">{createError}</p>}
        <Button type="submit" disabled={creating}>
          {creating ? t(d, "common.saving") : t(d, "onboarding.create.submit")}
        </Button>
      </form>

      <form
        onSubmit={handleJoin}
        className="flex flex-col gap-4 rounded-2xl border border-border bg-white p-6 shadow-sm"
      >
        <h2 className="text-lg font-extrabold">{t(d, "onboarding.join.heading")}</h2>
        <Input
          id="inviteCode"
          type="text"
          label={t(d, "onboarding.join.code")}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={8}
          required
        />
        {joinError && <p className="text-sm text-red-600">{joinError}</p>}
        <Button type="submit" disabled={joining}>
          {joining ? t(d, "common.saving") : t(d, "onboarding.join.submit")}
        </Button>
      </form>
    </div>
  );
}
