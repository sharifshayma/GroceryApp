"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { createList, renameList, deleteList, duplicateList } from "@/actions/lists";
import { partitionLists } from "@/lib/partition-lists";
import { getDictionary, t } from "@/i18n";

const d = getDictionary("en");

interface ListRow {
  id: string;
  name: string;
  status: string;
  itemCount: number;
}

export function ListsManager({ lists }: { lists: ListRow[] }) {
  const router = useRouter();

  // Create-list form state
  const [addName, setAddName] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // Which row is being renamed, and its edit-form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Row id currently running a delete/duplicate mutation
  const [pendingId, setPendingId] = useState<string | null>(null);

  const { open, completed } = partitionLists(lists);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setAddError(null);
    setAdding(true);
    const result = await createList({ name: addName });
    setAdding(false);
    if (!result.ok) {
      setAddError(result.error);
      return;
    }
    setAddName("");
    router.push(`/lists/${result.id}`);
  }

  function startEdit(row: ListRow) {
    setEditingId(row.id);
    setEditName(row.name);
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
    const result = await renameList({ id, name: editName });
    setSaving(false);
    if (!result.ok) {
      setEditError(result.error);
      return;
    }
    setEditingId(null);
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm(t(d, "lists.deleteConfirm"))) return;
    setPendingId(id);
    const result = await deleteList(id);
    setPendingId(null);
    if (!result.ok) {
      alert(result.error);
      return;
    }
    router.refresh();
  }

  async function handleDuplicate(id: string) {
    setPendingId(id);
    const result = await duplicateList(id);
    setPendingId(null);
    if (!result.ok) {
      alert(result.error);
      return;
    }
    router.push(`/lists/${result.id}`);
  }

  function renderRow(row: ListRow) {
    const isEditing = editingId === row.id;
    const isPending = pendingId === row.id;

    if (isEditing) {
      return (
        <li key={row.id} className="rounded-2xl border border-border bg-white p-4">
          <form
            onSubmit={(e) => handleSaveEdit(e, row.id)}
            className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-2"
          >
            <div className="flex-1">
              <Input
                id={`editListName-${row.id}`}
                type="text"
                placeholder={t(d, "lists.namePlaceholder")}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? t(d, "common.saving") : t(d, "lists.save")}
              </Button>
              <Button type="button" variant="ghost" disabled={saving} onClick={cancelEdit}>
                {t(d, "lists.cancel")}
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
        <Link href={`/lists/${row.id}`} className="flex-1 font-bold hover:underline">
          {row.name}{" "}
          <span className="font-normal text-ink/60">
            ({row.itemCount} {t(d, "lists.itemsCount")})
          </span>
        </Link>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={() => startEdit(row)}
          >
            {t(d, "lists.rename")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={() => handleDuplicate(row.id)}
          >
            {t(d, "lists.duplicate")}
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            disabled={isPending}
            onClick={() => handleDelete(row.id)}
          >
            {t(d, "lists.delete")}
          </Button>
        </div>
      </li>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-4 sm:p-6">
      <h1 className="text-2xl font-extrabold">{t(d, "lists.title")}</h1>

      <form
        onSubmit={handleAdd}
        className="flex flex-col gap-3 rounded-2xl border border-border bg-white p-4 sm:flex-row sm:items-end sm:gap-2"
      >
        <div className="flex-1">
          <Input
            id="addListName"
            type="text"
            placeholder={t(d, "lists.namePlaceholder")}
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            required
          />
        </div>
        <Button type="submit" disabled={adding}>
          {adding ? t(d, "common.saving") : t(d, "lists.create")}
        </Button>
      </form>
      {addError && <p className="text-sm text-red-600">{addError}</p>}

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">{t(d, "lists.open")}</h2>
        {open.length === 0 ? (
          <p className="text-ink/60">{t(d, "lists.emptyOpen")}</p>
        ) : (
          <ul className="flex flex-col gap-2">{open.map(renderRow)}</ul>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">{t(d, "lists.completed")}</h2>
        {completed.length === 0 ? (
          <p className="text-ink/60">{t(d, "lists.emptyCompleted")}</p>
        ) : (
          <ul className="flex flex-col gap-2">{completed.map(renderRow)}</ul>
        )}
      </div>
    </div>
  );
}
