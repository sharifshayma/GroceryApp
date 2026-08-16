"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/LocaleProvider";
import { updateDisplayName } from "@/actions/profile";
import { LanguageToggle } from "@/components/LanguageToggle";
import { LogoutButton } from "@/components/LogoutButton";

type ProfileUser = {
  id: string;
  email: string;
  displayName: string | null;
};

type ProfileHousehold = {
  name: string;
  inviteCode: string;
};

type ProfileMember = {
  id: string;
  displayName: string | null;
  email: string;
};

export function ProfileClient({
  user,
  household,
  members,
  currentUserId,
}: {
  user: ProfileUser;
  household: ProfileHousehold;
  members: ProfileMember[];
  currentUserId: string;
}) {
  const { t } = useT();
  const router = useRouter();

  const [editingName, setEditingName] = useState(false);
  const [displayName, setDisplayName] = useState(user.displayName ?? "");
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  async function saveName() {
    setSaving(true);
    setNameError(null);
    const result = await updateDisplayName(displayName);
    setSaving(false);
    if (!result.ok) {
      setNameError(result.error);
      return;
    }
    setEditingName(false);
    router.refresh();
  }

  function cancelEdit() {
    setEditingName(false);
    setDisplayName(user.displayName ?? "");
    setNameError(null);
  }

  async function handleInvite() {
    const url = `${window.location.origin}/join/${household.inviteCode}`;
    const text = `${t("household.inviteMessage")} ${household.inviteCode}\n${url}`;
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        // user cancelled or share failed — fall back to clipboard
      }
    }
    await navigator.clipboard.writeText(text);
    alert(t("household.codeCopied"));
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-semibold">{t("profile.title")}</h1>

      {/* User info */}
      <div className="bg-surface rounded-2xl p-5 border border-neutral space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border border-neutral bg-bg text-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => void saveName()}
                    disabled={saving}
                    className="px-3 py-2 rounded-xl bg-primary text-white font-semibold text-sm disabled:opacity-50"
                  >
                    {saving ? t("common.saving") : t("common.save")}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="px-3 py-2 rounded-xl text-text-secondary font-semibold text-sm"
                  >
                    {t("common.cancel")}
                  </button>
                </div>
                {nameError && <p className="text-sm text-danger">{nameError}</p>}
              </div>
            ) : (
              <div>
                <p className="text-lg font-medium">{user.displayName || user.email}</p>
                <p className="text-text-secondary text-sm">{user.email}</p>
              </div>
            )}
          </div>
          {!editingName && (
            <button
              type="button"
              onClick={() => setEditingName(true)}
              className="text-primary font-semibold text-sm"
            >
              {t("common.edit")}
            </button>
          )}
        </div>
      </div>

      {/* Language */}
      <div className="bg-surface rounded-2xl p-5 border border-neutral">
        <div className="flex items-center justify-between">
          <span className="font-semibold">{t("profile.language")}</span>
          <LanguageToggle />
        </div>
      </div>

      {/* Household */}
      <div className="bg-surface rounded-2xl p-5 border border-neutral space-y-4">
        <div className="flex items-center justify-between">
          <span className="font-semibold">{household.name}</span>
          <button
            type="button"
            onClick={() => void handleInvite()}
            className="text-primary font-semibold text-sm"
          >
            {t("household.inviteMembers")}
          </button>
        </div>

        {members.length > 0 && (
          <div className="space-y-2">
            <p className="text-text-secondary text-xs font-semibold uppercase">
              {t("household.members")}
            </p>
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 py-1">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm">
                  {(m.displayName || m.email || "?")[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold">{m.displayName || m.email}</p>
                  {m.id === currentUserId && (
                    <span className="text-xs text-text-secondary">({t("common.you")})</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sign out */}
      <div className="flex justify-center pt-2">
        <LogoutButton label={t("auth.logout")} />
      </div>
    </div>
  );
}
