"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { createItem, updateItem, deleteItem } from "@/actions/items";
import { ItemTagPicker } from "@/components/ItemTagPicker";
import { getDictionary, t } from "@/i18n";

const d = getDictionary("en");

interface ItemRow {
  id: string;
  name: string;
  nameHe: string | null;
  emoji: string;
  defaultUnit: string;
  notes: string | null;
  categoryId: string | null;
  autoTrackStock: boolean;
  category: { name: string; emoji: string } | null;
  tags: { notes: string | null; tag: { id: string; name: string; color: string } }[];
}

interface CategoryOption {
  id: string;
  name: string;
  emoji: string;
}

interface TagOption {
  id: string;
  name: string;
  type: string;
  color: string;
}

interface ItemFormValues {
  categoryId: string;
  name: string;
  nameHe: string;
  emoji: string;
  defaultUnit: string;
  notes: string;
  autoTrackStock: boolean;
}

const emptyForm: ItemFormValues = {
  categoryId: "",
  name: "",
  nameHe: "",
  emoji: "",
  defaultUnit: "",
  notes: "",
  autoTrackStock: true,
};

export function ItemManager({
  items,
  categories,
  tags,
}: {
  items: ItemRow[];
  categories: CategoryOption[];
  tags: TagOption[];
}) {
  const router = useRouter();

  // Modal state: whether it's open, which item (if any) is being edited, and its form values.
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ItemFormValues>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Row id currently running a delete mutation
  const [pendingId, setPendingId] = useState<string | null>(null);

  // Item currently showing the Tags picker modal (null = closed)
  const [tagPickerItemId, setTagPickerItemId] = useState<string | null>(null);
  const tagPickerItem = items.find((row) => row.id === tagPickerItemId) ?? null;

  const firstFieldRef = useRef<HTMLSelectElement>(null);

  function openAddModal() {
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  }

  function openEditModal(row: ItemRow) {
    setEditingId(row.id);
    setForm({
      categoryId: row.categoryId ?? "",
      name: row.name,
      nameHe: row.nameHe ?? "",
      emoji: row.emoji,
      defaultUnit: row.defaultUnit,
      notes: row.notes ?? "",
      autoTrackStock: row.autoTrackStock,
    });
    setFormError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setFormError(null);
  }

  useEffect(() => {
    if (!modalOpen) return;
    firstFieldRef.current?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeModal();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [modalOpen]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    const payload = {
      categoryId: form.categoryId || null,
      name: form.name,
      nameHe: form.nameHe,
      emoji: form.emoji,
      defaultUnit: form.defaultUnit,
      notes: form.notes,
      autoTrackStock: form.autoTrackStock,
    };
    const result = editingId
      ? await updateItem({ id: editingId, ...payload })
      : await createItem(payload);
    setSaving(false);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    setModalOpen(false);
    setEditingId(null);
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm(t(d, "catalog.items.deleteConfirm"))) return;
    setPendingId(id);
    const result = await deleteItem(id);
    setPendingId(null);
    if (!result.ok) {
      alert(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">{t(d, "catalog.items.title")}</h1>
        <Button type="button" onClick={openAddModal}>
          {t(d, "catalog.items.add")}
        </Button>
      </div>

      {items.length === 0 && (
        <p className="text-ink/60">{t(d, "catalog.items.empty")}</p>
      )}

      <ul className="flex flex-col gap-2">
        {items.map((row) => {
          const isPending = pendingId === row.id;
          const categoryLabel = row.category
            ? `${row.category.emoji} ${row.category.name}`
            : t(d, "catalog.items.uncategorized");
          return (
            <li
              key={row.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-white p-4"
            >
              <span className="text-2xl">{row.emoji}</span>
              <div className="flex-1">
                <div className="font-bold">{row.name}</div>
                {row.nameHe && <div className="text-sm text-ink/60">{row.nameHe}</div>}
                <div className="text-sm text-ink/60">
                  {categoryLabel} · {row.defaultUnit}
                </div>
                {row.tags.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {row.tags.map(({ tag }) => (
                      <span
                        key={tag.id}
                        className="rounded-full border px-2 py-0.5 text-xs font-bold"
                        style={{
                          backgroundColor: `${tag.color}22`,
                          borderColor: tag.color,
                          color: tag.color,
                        }}
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isPending}
                  onClick={() => setTagPickerItemId(row.id)}
                >
                  {t(d, "catalog.tags.assign")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isPending}
                  onClick={() => openEditModal(row)}
                >
                  {t(d, "catalog.items.edit")}
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  disabled={isPending}
                  onClick={() => handleDelete(row.id)}
                >
                  {t(d, "catalog.items.delete")}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={closeModal}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="itemFormTitle"
            className="relative flex w-full max-w-md flex-col gap-3 rounded-2xl border border-border bg-white p-5"
          >
            <h2 id="itemFormTitle" className="text-lg font-extrabold">
              {editingId ? t(d, "catalog.items.edit") : t(d, "catalog.items.add")}
            </h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="itemCategory" className="text-sm font-bold text-ink">
                  {t(d, "catalog.items.category")}
                </label>
                <select
                  id="itemCategory"
                  ref={firstFieldRef}
                  value={form.categoryId}
                  onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                  className="rounded-xl border border-border bg-white px-4 py-2.5 text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                >
                  <option value="">{t(d, "catalog.items.noCategory")}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.emoji} {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <Input
                id="itemName"
                label={t(d, "catalog.items.name")}
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />

              <Input
                id="itemNameHe"
                label={t(d, "catalog.items.nameHe")}
                type="text"
                value={form.nameHe}
                onChange={(e) => setForm({ ...form, nameHe: e.target.value })}
              />

              <Input
                id="itemEmoji"
                label={t(d, "catalog.items.emoji")}
                type="text"
                value={form.emoji}
                onChange={(e) => setForm({ ...form, emoji: e.target.value })}
              />

              <Input
                id="itemUnit"
                label={t(d, "catalog.items.unit")}
                type="text"
                value={form.defaultUnit}
                onChange={(e) => setForm({ ...form, defaultUnit: e.target.value })}
              />

              <Textarea
                id="itemNotes"
                label={t(d, "catalog.items.notes")}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.autoTrackStock}
                  onChange={(e) => setForm({ ...form, autoTrackStock: e.target.checked })}
                  className="h-4 w-4"
                />
                {t(d, "catalog.items.autoTrack")}
              </label>

              {formError && <p className="text-sm text-red-600">{formError}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" disabled={saving} onClick={closeModal}>
                  {t(d, "catalog.items.cancel")}
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? t(d, "common.saving") : t(d, "catalog.items.save")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {tagPickerItem && (
        <ItemTagPicker
          itemId={tagPickerItem.id}
          itemName={tagPickerItem.name}
          tags={tags}
          assignedTagIds={tagPickerItem.tags.map(({ tag }) => tag.id)}
          assignedNotes={Object.fromEntries(
            tagPickerItem.tags.map(({ tag, notes }) => [tag.id, notes]),
          )}
          onClose={() => setTagPickerItemId(null)}
        />
      )}
    </div>
  );
}
