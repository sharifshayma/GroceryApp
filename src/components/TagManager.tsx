"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/LocaleProvider";
import { IconBack, IconEdit, IconTrash } from "@/components/Icons";
import { createTag, updateTag, deleteTag } from "@/actions/tags";

const TAG_TYPES = ["recipe", "store", "custom"] as const;

const TYPE_ICON: Record<string, string> = {
  recipe: "🍽️",
  store: "🏪",
  custom: "🏷️",
};

const TYPE_LABEL_KEY: Record<string, string> = {
  recipe: "catalog.tags.typeRecipe",
  store: "catalog.tags.typeStore",
  custom: "catalog.tags.typeCustom",
};

const COLOR_OPTIONS = [
  "#F28B30",
  "#E8C840",
  "#8BC34A",
  "#5A9E3E",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#EF4444",
  "#6B7280",
  "#D4C48A",
];

const DEFAULT_COLOR = COLOR_OPTIONS[0];

interface TagRow {
  id: string;
  name: string;
  type: "recipe" | "store" | "custom";
  color: string;
  description: string | null;
  itemCount: number;
}

export function TagManager({ tags }: { tags: TagRow[] }) {
  const { t } = useT();
  const router = useRouter();

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<(typeof TAG_TYPES)[number]>("recipe");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const isFormOpen = adding || editingId !== null;

  const groups = TAG_TYPES.map((tp) => ({
    key: tp,
    icon: TYPE_ICON[tp],
    labelKey: TYPE_LABEL_KEY[tp],
    rows: tags.filter((row) => row.type === tp),
  }));

  function resetForm() {
    setName("");
    setType("recipe");
    setDescription("");
    setColor(DEFAULT_COLOR);
    setAdding(false);
    setEditingId(null);
    setError(null);
  }

  function startEdit(row: TagRow) {
    setEditingId(row.id);
    setName(row.name);
    setType(row.type);
    setDescription(row.description ?? "");
    setColor(row.color || DEFAULT_COLOR);
    setAdding(false);
    setError(null);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    const result = editingId
      ? await updateTag({ id: editingId, name, type, color, description })
      : await createTag({ name, type, color, description });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    resetForm();
    router.refresh();
  }

  async function handleDelete(row: TagRow) {
    if (!confirm(t("catalog.tags.deleteConfirm"))) return;
    setPendingId(row.id);
    const result = await deleteTag(row.id);
    setPendingId(null);
    if (!result.ok) {
      alert(result.error);
      return;
    }
    if (editingId === row.id) resetForm();
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
        <h1 className="text-xl font-semibold">{t("catalog.tags.manageTitle")}</h1>
      </div>

      {/* Add / Edit form */}
      {isFormOpen && (
        <form
          onSubmit={handleSave}
          className="bg-surface rounded-2xl border border-neutral p-4 mb-4 animate-fade-in space-y-3"
        >
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("catalog.tags.namePlaceholder")}
            required
            autoFocus
            className="w-full px-3 py-2.5 rounded-xl border border-neutral bg-bg text-text placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />

          {/* Type selector */}
          <div className="flex gap-2">
            {TAG_TYPES.map((tp) => (
              <button
                key={tp}
                type="button"
                onClick={() => setType(tp)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors min-h-[44px] ${
                  type === tp
                    ? "bg-primary text-white"
                    : "bg-bg border border-neutral/40 text-text-secondary"
                }`}
              >
                {TYPE_ICON[tp]} {t(TYPE_LABEL_KEY[tp])}
              </button>
            ))}
          </div>

          {/* Description */}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("catalog.tags.descriptionPlaceholder")}
            rows={2}
            className="w-full px-3 py-2 rounded-xl border border-neutral bg-bg text-text text-sm placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
          />

          {/* Color picker */}
          <div className="flex gap-2.5 flex-wrap">
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={t("catalog.tags.color")}
                onClick={() => setColor(c)}
                className={`w-10 h-10 rounded-full transition-transform ${
                  color === c ? "ring-2 ring-offset-2 ring-primary scale-110" : ""
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

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
          + {t("catalog.tags.add")}
        </button>
      )}

      {/* Tags grouped by type */}
      {groups.map((group) => (
        <div key={group.key} className="mb-5">
          <h3 className="text-sm font-medium text-text-secondary mb-2 flex items-center gap-1.5">
            <span>{group.icon}</span>
            <span>{t(group.labelKey)}</span>
            <span className="text-xs font-normal">({group.rows.length})</span>
          </h3>

          {group.rows.length === 0 ? (
            <p className="text-xs text-text-secondary ps-6 mb-2">{t("catalog.tags.empty")}</p>
          ) : (
            <div className="space-y-2">
              {group.rows.map((row) => {
                const isPending = pendingId === row.id;
                return (
                  <div
                    key={row.id}
                    className={`bg-white rounded-xl border shadow-sm p-3.5 flex items-center gap-3 transition-colors ${
                      editingId === row.id ? "border-primary" : "border-neutral/20"
                    }`}
                  >
                    <span
                      aria-hidden
                      className="w-5 h-5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: row.color || DEFAULT_COLOR }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-text truncate">{row.name}</p>
                      {row.description && (
                        <p className="text-xs text-text-secondary truncate">{row.description}</p>
                      )}
                      <p className="text-xs text-text-secondary">
                        {row.itemCount} {t("catalog.tags.items")}
                      </p>
                    </div>
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
      ))}
    </div>
  );
}
