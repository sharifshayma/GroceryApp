"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import {
  createCategory,
  updateCategory,
  deleteCategory,
  moveCategory,
} from "@/actions/categories";
import { getDictionary, t } from "@/i18n";

const d = getDictionary("en");

interface CategoryRow {
  id: string;
  name: string;
  nameHe: string | null;
  emoji: string;
  sortOrder: number;
}

export function CategoryManager({ categories }: { categories: CategoryRow[] }) {
  const router = useRouter();

  // Add-category form state
  const [addName, setAddName] = useState("");
  const [addNameHe, setAddNameHe] = useState("");
  const [addEmoji, setAddEmoji] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // Which row is being edited, and its edit-form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editNameHe, setEditNameHe] = useState("");
  const [editEmoji, setEditEmoji] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Row id currently running a delete/move mutation
  const [pendingId, setPendingId] = useState<string | null>(null);

  const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setAddError(null);
    setAdding(true);
    const result = await createCategory({
      name: addName,
      nameHe: addNameHe,
      emoji: addEmoji,
    });
    setAdding(false);
    if (!result.ok) {
      setAddError(result.error);
      return;
    }
    setAddName("");
    setAddNameHe("");
    setAddEmoji("");
    router.refresh();
  }

  function startEdit(row: CategoryRow) {
    setEditingId(row.id);
    setEditName(row.name);
    setEditNameHe(row.nameHe ?? "");
    setEditEmoji(row.emoji);
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
    const result = await updateCategory({
      id,
      name: editName,
      nameHe: editNameHe,
      emoji: editEmoji,
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
    if (!confirm(t(d, "catalog.categories.deleteConfirm"))) return;
    setPendingId(id);
    const result = await deleteCategory(id);
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
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-4 sm:p-6">
      <h1 className="text-2xl font-extrabold">{t(d, "catalog.categories.title")}</h1>

      <form
        onSubmit={handleAdd}
        className="flex flex-col gap-3 rounded-2xl border border-border bg-white p-4 sm:flex-row sm:items-end sm:gap-2"
      >
        <div className="flex-1">
          <Input
            id="addCategoryName"
            type="text"
            placeholder={t(d, "catalog.categories.namePlaceholder")}
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            required
          />
        </div>
        <div className="flex-1">
          <Input
            id="addCategoryNameHe"
            type="text"
            placeholder={t(d, "catalog.categories.nameHePlaceholder")}
            value={addNameHe}
            onChange={(e) => setAddNameHe(e.target.value)}
          />
        </div>
        <div className="w-24">
          <Input
            id="addCategoryEmoji"
            type="text"
            placeholder={t(d, "catalog.categories.emojiPlaceholder")}
            value={addEmoji}
            onChange={(e) => setAddEmoji(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={adding}>
          {adding ? t(d, "common.saving") : t(d, "catalog.categories.add")}
        </Button>
      </form>
      {addError && <p className="text-sm text-red-600">{addError}</p>}

      {sorted.length === 0 && (
        <p className="text-ink/60">{t(d, "catalog.categories.empty")}</p>
      )}

      <ul className="flex flex-col gap-2">
        {sorted.map((row, idx) => {
          const isEditing = editingId === row.id;
          const isPending = pendingId === row.id;
          const isFirst = idx === 0;
          const isLast = idx === sorted.length - 1;

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
                      id={`editName-${row.id}`}
                      type="text"
                      placeholder={t(d, "catalog.categories.namePlaceholder")}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                  <div className="flex-1">
                    <Input
                      id={`editNameHe-${row.id}`}
                      type="text"
                      placeholder={t(d, "catalog.categories.nameHePlaceholder")}
                      value={editNameHe}
                      onChange={(e) => setEditNameHe(e.target.value)}
                    />
                  </div>
                  <div className="w-24">
                    <Input
                      id={`editEmoji-${row.id}`}
                      type="text"
                      placeholder={t(d, "catalog.categories.emojiPlaceholder")}
                      value={editEmoji}
                      onChange={(e) => setEditEmoji(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={saving}>
                      {saving ? t(d, "common.saving") : t(d, "catalog.categories.save")}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={saving}
                      onClick={cancelEdit}
                    >
                      {t(d, "catalog.categories.cancel")}
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
              <span className="text-2xl">{row.emoji}</span>
              <div className="flex-1">
                <div className="font-bold">{row.name}</div>
                {row.nameHe && <div className="text-sm text-ink/60">{row.nameHe}</div>}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={t(d, "catalog.categories.moveUp")}
                  disabled={isFirst || isPending}
                  onClick={() => handleMove(row.id, "up")}
                >
                  ▲
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={t(d, "catalog.categories.moveDown")}
                  disabled={isLast || isPending}
                  onClick={() => handleMove(row.id, "down")}
                >
                  ▼
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isPending}
                  onClick={() => startEdit(row)}
                >
                  {t(d, "catalog.categories.edit")}
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  disabled={isPending}
                  onClick={() => handleDelete(row.id)}
                >
                  {t(d, "catalog.categories.delete")}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
