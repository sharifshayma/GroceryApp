"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { BottomSheet } from "@/components/BottomSheet";
import { ItemPhotoField } from "@/components/ItemPhotoField";
import { ItemTagPicker } from "@/components/ItemTagPicker";
import { Toggle } from "@/components/Toggle";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useT } from "@/i18n/LocaleProvider";
import { getCategoryName } from "@/lib/i18n-names";
import { createItem, updateItem, deleteItem } from "@/actions/items";

interface CategoryOption {
  id: string;
  name: string;
  nameHe: string | null;
  emoji: string;
}

interface TagOption {
  id: string;
  name: string;
  color: string;
  type: "recipe" | "store" | "custom";
}

interface EditableItem {
  id: string;
  name: string;
  nameHe: string | null;
  emoji: string;
  defaultUnit: string;
  notes: string | null;
  categoryId: string | null;
  autoTrackStock: boolean;
  photoUrl: string | null;
  tags: { notes?: string | null; tag: { id: string } }[];
}

export function AddItemModal({
  item,
  categories,
  tags,
  onClose,
}: {
  item: EditableItem | null;
  categories: CategoryOption[];
  tags: TagOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const { t, locale } = useT();
  const isEdit = !!item;

  const [name, setName] = useState(item?.name ?? "");
  const [nameHe, setNameHe] = useState(item?.nameHe ?? "");
  const [emoji, setEmoji] = useState(item?.emoji ?? "🛒");
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? "");
  const [defaultUnit, setDefaultUnit] = useState(item?.defaultUnit ?? "pcs");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [autoTrackStock, setAutoTrackStock] = useState(item?.autoTrackStock ?? true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);

    // Submit the FULL field set every time (create and edit alike) —
    // updateItemCore nulls/defaults any field that's omitted, so a partial
    // payload here would silently wipe nameHe/notes/emoji/defaultUnit.
    const payload = {
      name: name.trim(),
      nameHe: nameHe.trim(),
      emoji: emoji.trim() || "🛒",
      defaultUnit: defaultUnit.trim() || "pcs",
      notes: notes.trim(),
      categoryId: categoryId || null,
      autoTrackStock,
    };

    const result = isEdit ? await updateItem({ id: item.id, ...payload }) : await createItem(payload);

    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
    onClose();
  }

  async function handleDelete() {
    if (!item) return;
    if (!confirm(t("catalog.items.deleteConfirm"))) return;
    setDeleting(true);
    setError(null);
    const result = await deleteItem(item.id);
    setDeleting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <BottomSheet onClose={onClose}>
      <div className="flex items-center justify-between gap-3 border-b border-neutral/50 px-5 pb-3 pt-5">
        <h2 className="text-lg font-semibold text-text">
          {isEdit ? t("catalog.items.edit") : t("catalog.items.add")}
        </h2>
        <button
          onClick={onClose}
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-neutral/30 text-xl font-medium text-text transition-colors hover:bg-neutral/50"
        >
          ×
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4 pb-20">
        {/* Icon/photo preview + emoji field */}
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-neutral bg-bg text-3xl">
            {item?.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.photoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span>{emoji || "🛒"}</span>
            )}
          </div>
          <div className="flex-1">
            <Input
              id="itemEmoji"
              label={t("catalog.items.emoji")}
              type="text"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              maxLength={4}
            />
          </div>
        </div>

        <Input
          id="itemName"
          label={t("catalog.items.name")}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          required
        />

        <Input
          id="itemNameHe"
          label={t("catalog.items.nameHe")}
          type="text"
          value={nameHe}
          onChange={(e) => setNameHe(e.target.value)}
          dir="rtl"
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="itemCategory" className="text-sm font-bold text-text">
            {t("catalog.items.category")}
          </label>
          <select
            id="itemCategory"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="rounded-xl border border-neutral bg-surface px-4 py-2.5 text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            <option value="">{t("catalog.items.noCategory")}</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.emoji} {getCategoryName(cat, locale)}
              </option>
            ))}
          </select>
        </div>

        <Input
          id="itemUnit"
          label={t("catalog.items.unit")}
          type="text"
          value={defaultUnit}
          onChange={(e) => setDefaultUnit(e.target.value)}
        />

        <Textarea
          id="itemNotes"
          label={t("catalog.items.notes")}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <div className="flex items-center justify-between py-1">
          <span className="text-sm font-bold text-text">{t("catalog.items.autoTrack")}</span>
          <Toggle
            checked={autoTrackStock}
            onChange={() => setAutoTrackStock((v) => !v)}
            ariaLabel={t("catalog.items.autoTrack")}
          />
        </div>

        {/* Photo + tag assignment only apply to items that already exist —
            ItemPhotoField/ItemTagPicker both operate against a real itemId,
            same constraint ItemManager follows (create first, then edit). */}
        {isEdit && item && <ItemPhotoField itemId={item.id} photoUrl={item.photoUrl} />}

        {isEdit && item && (
          <div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setTagPickerOpen(true)}>
              {t("catalog.tags.assign")}
              {item.tags.length > 0 ? ` (${item.tags.length})` : ""}
            </Button>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center gap-2 pt-2">
          {isEdit && (
            <Button type="button" variant="danger" disabled={saving || deleting} onClick={handleDelete}>
              {deleting ? t("common.saving") : t("catalog.items.delete")}
            </Button>
          )}
          <Button type="submit" className="flex-1" disabled={saving || deleting || !name.trim()}>
            {saving ? t("common.saving") : isEdit ? t("catalog.items.save") : t("catalog.items.add")}
          </Button>
        </div>
      </form>

      {isEdit && item && tagPickerOpen && (
        <ItemTagPicker
          itemId={item.id}
          itemName={item.name}
          tags={tags}
          assignedTagIds={item.tags.map(({ tag }) => tag.id)}
          assignedNotes={Object.fromEntries(item.tags.map(({ tag, notes: n }) => [tag.id, n ?? null]))}
          onClose={() => setTagPickerOpen(false)}
        />
      )}
    </BottomSheet>
  );
}
