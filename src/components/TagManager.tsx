"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { createTag, updateTag, deleteTag } from "@/actions/tags";
import { getDictionary, t } from "@/i18n";
import { groupTagsByType } from "@/lib/group-tags";

const d = getDictionary("en");

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

const DEFAULT_COLOR = "#3B82F6";

interface TagRow {
  id: string;
  name: string;
  type: string;
  color: string;
  itemCount: number;
}

export function TagManager({ tags }: { tags: TagRow[] }) {
  const router = useRouter();

  // Add-tag form state
  const [addName, setAddName] = useState("");
  const [addType, setAddType] = useState("custom");
  const [addColor, setAddColor] = useState(DEFAULT_COLOR);
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // Which row is being edited, and its edit-form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("custom");
  const [editColor, setEditColor] = useState(DEFAULT_COLOR);
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Row id currently running a delete mutation
  const [pendingId, setPendingId] = useState<string | null>(null);

  const groups = groupTagsByType(tags);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setAddError(null);
    setAdding(true);
    const result = await createTag({
      name: addName,
      type: addType,
      color: addColor,
    });
    setAdding(false);
    if (!result.ok) {
      setAddError(result.error);
      return;
    }
    setAddName("");
    setAddType("custom");
    setAddColor(DEFAULT_COLOR);
    router.refresh();
  }

  function startEdit(row: TagRow) {
    setEditingId(row.id);
    setEditName(row.name);
    setEditType(row.type);
    setEditColor(row.color);
    setEditError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError(null);
  }

  async function handleSaveEdit(e: FormEvent, id: string) {
    e.preventDefault();
    setEditError(null);
    setSaving(true);
    const result = await updateTag({
      id,
      name: editName,
      type: editType,
      color: editColor,
    });
    setSaving(false);
    if (!result.ok) {
      setEditError(result.error);
      return;
    }
    setEditingId(null);
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm(t(d, "catalog.tags.deleteConfirm"))) return;
    setPendingId(id);
    const result = await deleteTag(id);
    setPendingId(null);
    if (!result.ok) {
      alert(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-4 sm:p-6">
      <h1 className="text-2xl font-extrabold">{t(d, "catalog.tags.title")}</h1>

      <form
        onSubmit={handleAdd}
        className="flex flex-col gap-3 rounded-2xl border border-border bg-white p-4 sm:flex-row sm:items-end sm:gap-2"
      >
        <div className="flex-1">
          <Input
            id="addTagName"
            type="text"
            placeholder={t(d, "catalog.tags.namePlaceholder")}
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            required
          />
        </div>
        <div className="flex-1">
          <select
            id="addTagType"
            value={addType}
            onChange={(e) => setAddType(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-white px-3"
          >
            <option value="recipe">{t(d, "catalog.tags.typeRecipe")}</option>
            <option value="store">{t(d, "catalog.tags.typeStore")}</option>
            <option value="custom">{t(d, "catalog.tags.typeCustom")}</option>
          </select>
        </div>
        <div className="w-16">
          <input
            id="addTagColor"
            type="color"
            aria-label={t(d, "catalog.tags.color")}
            value={addColor}
            onChange={(e) => setAddColor(e.target.value)}
            className="h-10 w-full cursor-pointer rounded-lg border border-border bg-white p-1"
          />
        </div>
        <Button type="submit" disabled={adding}>
          {adding ? t(d, "common.saving") : t(d, "catalog.tags.add")}
        </Button>
      </form>
      {addError && <p className="text-sm text-red-600">{addError}</p>}

      {groups.length === 0 && <p className="text-ink/60">{t(d, "catalog.tags.empty")}</p>}

      {groups.map((group) => (
        <div key={group.type} className="flex flex-col gap-2">
          <h2 className="flex items-center gap-2 text-sm font-bold text-ink/60">
            <span>{TYPE_ICON[group.type]}</span>
            <span>{t(d, TYPE_LABEL_KEY[group.type])}</span>
          </h2>
          <ul className="flex flex-col gap-2">
            {group.tags.map((row) => {
              const isEditing = editingId === row.id;
              const isPending = pendingId === row.id;

              if (isEditing) {
                return (
                  <li
                    key={row.id}
                    className="rounded-2xl border border-border bg-white p-4"
                  >
                    <form
                      onSubmit={(e) => handleSaveEdit(e, row.id)}
                      className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-2"
                    >
                      <div className="flex-1">
                        <Input
                          id={`editTagName-${row.id}`}
                          type="text"
                          placeholder={t(d, "catalog.tags.namePlaceholder")}
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          required
                          autoFocus
                        />
                      </div>
                      <div className="flex-1">
                        <select
                          id={`editTagType-${row.id}`}
                          value={editType}
                          onChange={(e) => setEditType(e.target.value)}
                          className="h-10 w-full rounded-lg border border-border bg-white px-3"
                        >
                          <option value="recipe">{t(d, "catalog.tags.typeRecipe")}</option>
                          <option value="store">{t(d, "catalog.tags.typeStore")}</option>
                          <option value="custom">{t(d, "catalog.tags.typeCustom")}</option>
                        </select>
                      </div>
                      <div className="w-16">
                        <input
                          id={`editTagColor-${row.id}`}
                          type="color"
                          aria-label={t(d, "catalog.tags.color")}
                          value={editColor}
                          onChange={(e) => setEditColor(e.target.value)}
                          className="h-10 w-full cursor-pointer rounded-lg border border-border bg-white p-1"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button type="submit" disabled={saving}>
                          {saving ? t(d, "common.saving") : t(d, "catalog.tags.save")}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={saving}
                          onClick={cancelEdit}
                        >
                          {t(d, "catalog.tags.cancel")}
                        </Button>
                      </div>
                    </form>
                    {editError && <p className="mt-2 text-sm text-red-600">{editError}</p>}
                  </li>
                );
              }

              return (
                <li
                  key={row.id}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-white p-4"
                >
                  <span
                    aria-hidden
                    className="h-5 w-5 shrink-0 rounded-full border border-border"
                    style={{ backgroundColor: row.color }}
                  />
                  <div className="flex-1">
                    <div className="font-bold">{row.name}</div>
                    <div className="text-sm text-ink/60">
                      {row.itemCount} {t(d, "catalog.tags.items")}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isPending}
                      onClick={() => startEdit(row)}
                    >
                      {t(d, "catalog.tags.edit")}
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      disabled={isPending}
                      onClick={() => handleDelete(row.id)}
                    >
                      {t(d, "catalog.tags.delete")}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
