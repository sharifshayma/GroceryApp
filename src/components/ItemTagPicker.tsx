"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { assignTag, unassignTag } from "@/actions/tags";
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

interface TagOption {
  id: string;
  name: string;
  type: string;
  color: string;
}

export function ItemTagPicker({
  itemId,
  itemName,
  tags,
  assignedTagIds,
  assignedNotes,
  onClose,
}: {
  itemId: string;
  itemName: string;
  tags: TagOption[];
  assignedTagIds: string[];
  assignedNotes: Record<string, string | null>;
  onClose: () => void;
}) {
  const router = useRouter();
  const [assigned, setAssigned] = useState<Set<string>>(() => new Set(assignedTagIds));
  const [pendingTagId, setPendingTagId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(assignedNotes).map(([k, v]) => [k, v ?? ""])),
  );

  async function saveNote(tagId: string) {
    const res = await assignTag({ itemId, tagId, note: notes[tagId] ?? "" });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const groups = groupTagsByType(tags);

  async function handleToggle(tagId: string, isAssigned: boolean) {
    setError(null);
    setPendingTagId(tagId);

    // Optimistically flip the toggle so the checkbox responds immediately
    // and stays correct even if an unrelated parent re-render occurs
    // while the request is in flight.
    setAssigned((prev) => {
      const next = new Set(prev);
      if (isAssigned) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });

    const result = isAssigned
      ? await unassignTag({ itemId, tagId })
      : await assignTag({ itemId, tagId });
    setPendingTagId(null);
    if (!result.ok) {
      // Revert the optimistic change.
      setAssigned((prev) => {
        const next = new Set(prev);
        if (isAssigned) {
          next.add(tagId);
        } else {
          next.delete(tagId);
        }
        return next;
      });
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="itemTagPickerTitle"
        className="relative flex w-full max-w-md flex-col gap-3 rounded-2xl border border-border bg-white p-5"
      >
        <h2 id="itemTagPickerTitle" className="text-lg font-extrabold">
          {t(d, "catalog.tags.pickerTitle", { name: itemName })}
        </h2>

        {groups.length === 0 && <p className="text-ink/60">{t(d, "catalog.tags.empty")}</p>}

        <div className="flex max-h-80 flex-col gap-4 overflow-y-auto">
          {groups.map((group) => (
            <div key={group.type} className="flex flex-col gap-2">
              <h3 className="flex items-center gap-2 text-sm font-bold text-ink/60">
                <span>{TYPE_ICON[group.type]}</span>
                <span>{t(d, TYPE_LABEL_KEY[group.type])}</span>
              </h3>
              <ul className="flex flex-col gap-1.5">
                {group.tags.map((tag) => {
                  const isAssigned = assigned.has(tag.id);
                  const isPending = pendingTagId === tag.id;
                  return (
                    <li key={tag.id}>
                      <label
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border p-2.5 ${
                          isAssigned ? "border-brand bg-brand/10" : "border-border bg-white"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isAssigned}
                          disabled={isPending}
                          onChange={() => handleToggle(tag.id, isAssigned)}
                          className="h-4 w-4"
                        />
                        <span
                          aria-hidden
                          className="h-4 w-4 shrink-0 rounded-full border border-border"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="flex-1">{tag.name}</span>
                      </label>
                      {isAssigned && (
                        <input
                          type="text"
                          value={notes[tag.id] ?? ""}
                          onChange={(e) => setNotes((n) => ({ ...n, [tag.id]: e.target.value }))}
                          onBlur={() => saveNote(tag.id)}
                          placeholder={t(d, "catalog.tags.notePlaceholder")}
                          className="mt-1 w-full rounded-lg border border-border px-2 py-1 text-sm"
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end pt-2">
          <Button type="button" onClick={onClose}>
            {t(d, "catalog.tags.done")}
          </Button>
        </div>
      </div>
    </div>
  );
}
