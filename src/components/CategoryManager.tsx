"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/LocaleProvider";
import { getCategoryName } from "@/lib/i18n-names";
import { IconBack, IconEdit, IconTrash, IconChevronUp, IconChevronDown } from "@/components/Icons";
import {
  createCategory,
  updateCategory,
  deleteCategory,
  moveCategory,
} from "@/actions/categories";

interface CategoryRow {
  id: string;
  name: string;
  nameHe: string | null;
  emoji: string;
  sortOrder: number;
}

const EMOJI_OPTIONS = [
  "📦", "🥬", "🥜", "🥚", "🧀", "🥩", "🥗", "🍞", "🫙", "🍫",
  "🍪", "🍦", "🧊", "☕", "🥤", "🍷", "🍼", "🐾", "🧹", "🧴",
  "💊", "👕", "🛒", "🍽️", "🧂", "🫒", "🥫", "🧃", "🏠", "✨",
];

export function CategoryManager({ categories }: { categories: CategoryRow[] }) {
  const { t, locale } = useT();
  const router = useRouter();

  const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [nameHe, setNameHe] = useState("");
  const [emoji, setEmoji] = useState("📦");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const isFormOpen = adding || editingId !== null;

  function resetForm() {
    setName("");
    setNameHe("");
    setEmoji("📦");
    setShowEmojiPicker(false);
    setAdding(false);
    setEditingId(null);
    setError(null);
  }

  function startEdit(row: CategoryRow) {
    setEditingId(row.id);
    setName(row.name);
    setNameHe(row.nameHe ?? "");
    setEmoji(row.emoji);
    setAdding(false);
    setShowEmojiPicker(false);
    setError(null);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    const result = editingId
      ? await updateCategory({ id: editingId, name, nameHe, emoji })
      : await createCategory({ name, nameHe, emoji });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    resetForm();
    router.refresh();
  }

  async function handleDelete(row: CategoryRow) {
    if (!confirm(t("catalog.categories.deleteConfirm"))) return;
    setPendingId(row.id);
    const result = await deleteCategory(row.id);
    setPendingId(null);
    if (!result.ok) {
      alert(result.error);
      return;
    }
    router.refresh();
  }

  async function handleMove(id: string, direction: "up" | "down") {
    setPendingId(id);
    const result = await moveCategory({ id, direction });
    setPendingId(null);
    if (!result.ok) {
      alert(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="px-4 pt-4 pb-8 max-w-lg mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="w-10 h-10 rounded-xl bg-surface border border-neutral flex items-center justify-center text-text-secondary hover:text-text transition-colors"
        >
          <IconBack />
        </button>
        <h1 className="text-xl font-semibold">{t("catalog.categories.manageTitle")}</h1>
      </div>

      {/* Add / Edit form */}
      {isFormOpen && (
        <form
          onSubmit={handleSave}
          className="bg-surface rounded-2xl border border-neutral p-4 mb-4 animate-fade-in space-y-3"
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowEmojiPicker((v) => !v)}
              className="w-12 h-12 rounded-xl bg-bg border border-neutral text-2xl flex items-center justify-center flex-shrink-0"
            >
              {emoji}
            </button>
            <div className="flex-1 space-y-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("catalog.categories.namePlaceholder")}
                required
                autoFocus
                className="w-full px-3 py-2 rounded-xl border border-neutral bg-bg text-text text-sm placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <input
                type="text"
                value={nameHe}
                onChange={(e) => setNameHe(e.target.value)}
                placeholder={t("catalog.categories.nameHePlaceholder")}
                dir="rtl"
                className="w-full px-3 py-2 rounded-xl border border-neutral bg-bg text-text text-sm placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>

          {showEmojiPicker && (
            <div className="grid grid-cols-8 gap-1.5 p-3 bg-bg rounded-xl border border-neutral/40">
              {EMOJI_OPTIONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => {
                    setEmoji(e);
                    setShowEmojiPicker(false);
                  }}
                  className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center hover:bg-surface transition-colors ${
                    emoji === e ? "bg-primary/10 ring-2 ring-primary" : ""
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          )}

          {error && <p className="text-danger text-sm">{error}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="flex-1 py-2.5 rounded-xl bg-primary text-white font-semibold text-sm disabled:opacity-50 min-h-[44px]"
            >
              {saving ? t("common.saving") : t("common.save")}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2.5 rounded-xl text-text-secondary font-semibold text-sm min-h-[44px]"
            >
              {t("common.cancel")}
            </button>
          </div>
        </form>
      )}

      {/* Add button */}
      {!isFormOpen && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="w-full py-3 rounded-xl border-2 border-dashed border-primary/40 text-primary font-semibold mb-4 hover:bg-primary/5 transition-colors"
        >
          + {t("catalog.categories.add")}
        </button>
      )}

      {/* Category list */}
      {sorted.length === 0 ? (
        <p className="text-text-secondary text-sm text-center py-6">
          {t("catalog.categories.empty")}
        </p>
      ) : (
        <div className="space-y-2">
          {sorted.map((row, idx) => {
            const isPending = pendingId === row.id;
            return (
              <div
                key={row.id}
                className={`bg-white rounded-xl border shadow-sm p-3.5 flex items-center gap-3 transition-colors ${
                  editingId === row.id ? "border-primary" : "border-neutral/20"
                }`}
              >
                {/* Reorder arrows */}
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => handleMove(row.id, "up")}
                    disabled={idx === 0 || isPending}
                    aria-label={t("catalog.categories.moveUp")}
                    className="w-9 h-9 rounded-lg text-text-secondary hover:text-text hover:bg-neutral/20 disabled:opacity-20 flex items-center justify-center transition-colors"
                  >
                    <IconChevronUp />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(row.id, "down")}
                    disabled={idx === sorted.length - 1 || isPending}
                    aria-label={t("catalog.categories.moveDown")}
                    className="w-9 h-9 rounded-lg text-text-secondary hover:text-text hover:bg-neutral/20 disabled:opacity-20 flex items-center justify-center transition-colors"
                  >
                    <IconChevronDown />
                  </button>
                </div>

                <span className="text-2xl">{row.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{getCategoryName(row, locale)}</p>
                </div>

                {/* Actions */}
                <button
                  type="button"
                  onClick={() => startEdit(row)}
                  disabled={isPending}
                  className="w-10 h-10 rounded-lg text-text-secondary hover:text-primary hover:bg-primary/10 flex items-center justify-center transition-colors disabled:opacity-40"
                >
                  <IconEdit />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(row)}
                  disabled={isPending}
                  className="w-10 h-10 rounded-lg text-text-secondary hover:text-danger hover:bg-danger/10 flex items-center justify-center transition-colors disabled:opacity-40"
                >
                  <IconTrash />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
