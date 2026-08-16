"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { renameList, deleteList, duplicateList, completeList } from "@/actions/lists";
import { addListItem, updateListItem, removeListItem, setListItemBought } from "@/actions/list-items";
import { shoppingProgress } from "@/lib/shopping-progress";
import { getDictionary, t } from "@/i18n";

const d = getDictionary("en");

interface CatalogItem {
  id: string;
  name: string;
  emoji: string;
  defaultUnit: string;
}

interface ListItemRow {
  id: string;
  quantity: number;
  unit: string;
  notes: string | null;
  isBought: boolean;
  boughtAt: string | Date | null;
  item: { id: string; name: string; emoji: string; defaultUnit: string } | null;
}

interface ListDetailProps {
  list: {
    id: string;
    name: string;
    status: string;
    items: ListItemRow[];
  };
  catalogItems: CatalogItem[];
}

export function ListDetail({ list, catalogItems }: ListDetailProps) {
  const router = useRouter();

  const isCompleted = list.status === "completed";
  const { bought, total } = shoppingProgress(list.items);

  // Row id currently running a bought-toggle mutation
  const [togglingItemId, setTogglingItemId] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  // Complete-list flow state
  const [showCompleteChoice, setShowCompleteChoice] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  // Rename form state
  const [renaming, setRenaming] = useState(false);
  const [nameValue, setNameValue] = useState(list.name);
  const [nameError, setNameError] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);

  // Duplicate/delete pending state (list-level actions)
  const [listActionPending, setListActionPending] = useState(false);

  // Which list item row is being edited, and its edit-form state
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState("1");
  const [editUnit, setEditUnit] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editItemError, setEditItemError] = useState<string | null>(null);
  const [savingItem, setSavingItem] = useState(false);

  // Row id currently running a remove mutation
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);

  // Add-item form state
  const [addItemId, setAddItemId] = useState("");
  const [addQuantity, setAddQuantity] = useState("1");
  const [addUnit, setAddUnit] = useState("pcs");
  const [addNotes, setAddNotes] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  function startRename() {
    setNameValue(list.name);
    setNameError(null);
    setRenaming(true);
  }

  function cancelRename() {
    setRenaming(false);
    setNameError(null);
  }

  async function handleRename(e: FormEvent) {
    e.preventDefault();
    setNameError(null);
    setSavingName(true);
    const result = await renameList({ id: list.id, name: nameValue });
    setSavingName(false);
    if (!result.ok) {
      setNameError(result.error);
      return;
    }
    setRenaming(false);
    router.refresh();
  }

  async function handleDuplicate() {
    setListActionPending(true);
    const result = await duplicateList(list.id);
    setListActionPending(false);
    if (!result.ok) {
      alert(result.error);
      return;
    }
    router.push(`/lists/${result.id}`);
  }

  async function handleDelete() {
    if (!confirm(t(d, "lists.deleteConfirm"))) return;
    setListActionPending(true);
    const result = await deleteList(list.id);
    setListActionPending(false);
    if (!result.ok) {
      alert(result.error);
      return;
    }
    router.push("/lists");
  }

  function startEditItem(row: ListItemRow) {
    setEditingItemId(row.id);
    setEditQuantity(String(row.quantity));
    setEditUnit(row.unit);
    setEditNotes(row.notes ?? "");
    setEditItemError(null);
  }

  function cancelEditItem() {
    setEditingItemId(null);
    setEditItemError(null);
  }

  async function handleSaveEditItem(e: FormEvent, listItemId: string) {
    e.preventDefault();
    setEditItemError(null);
    setSavingItem(true);
    const result = await updateListItem({
      listItemId,
      quantity: Number(editQuantity),
      unit: editUnit,
      notes: editNotes,
    });
    setSavingItem(false);
    if (!result.ok) {
      setEditItemError(result.error);
      return;
    }
    setEditingItemId(null);
    router.refresh();
  }

  async function handleRemoveItem(listItemId: string) {
    if (!confirm(t(d, "lists.removeConfirm"))) return;
    setPendingItemId(listItemId);
    const result = await removeListItem(listItemId);
    setPendingItemId(null);
    if (!result.ok) {
      alert(result.error);
      return;
    }
    router.refresh();
  }

  function handleSelectCatalogItem(id: string) {
    setAddItemId(id);
    const catalogItem = catalogItems.find((c) => c.id === id);
    setAddUnit(catalogItem?.defaultUnit ?? "pcs");
  }

  async function handleAddItem(e: FormEvent) {
    e.preventDefault();
    setAddError(null);
    if (!addItemId) {
      setAddError(t(d, "lists.chooseItem"));
      return;
    }
    setAdding(true);
    const result = await addListItem({
      listId: list.id,
      itemId: addItemId,
      quantity: Number(addQuantity),
      unit: addUnit,
      notes: addNotes,
    });
    setAdding(false);
    if (!result.ok) {
      setAddError(result.error);
      return;
    }
    setAddItemId("");
    setAddQuantity("1");
    setAddUnit("pcs");
    setAddNotes("");
    router.refresh();
  }

  async function toggleBought(listItemId: string, isBought: boolean) {
    setToggleError(null);
    setTogglingItemId(listItemId);
    const result = await setListItemBought({ listItemId, isBought });
    setTogglingItemId(null);
    if (!result.ok) {
      setToggleError(result.error);
      return;
    }
    router.refresh();
  }

  function handleCompleteClick() {
    if (bought === total) {
      handleComplete(false);
      return;
    }
    setShowCompleteChoice(true);
  }

  async function handleComplete(carryOver: boolean) {
    setCompleteError(null);
    setCompleting(true);
    const result = await completeList({ listId: list.id, carryOver });
    setCompleting(false);
    if (!result.ok) {
      setCompleteError(result.error);
      return;
    }
    if (result.carriedOverListId) {
      router.push(`/lists/${result.carriedOverListId}`);
    } else {
      router.push("/lists");
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-4 sm:p-6">
      <Link href="/lists" className="text-sm font-bold text-brand hover:underline">
        {t(d, "lists.back")}
      </Link>

      <div className="rounded-2xl border border-border bg-white p-4">
        {renaming ? (
          <form
            onSubmit={handleRename}
            className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-2"
          >
            <div className="flex-1">
              <Input
                id="listName"
                type="text"
                placeholder={t(d, "lists.namePlaceholder")}
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={savingName}>
                {savingName ? t(d, "common.saving") : t(d, "lists.save")}
              </Button>
              <Button type="button" variant="ghost" disabled={savingName} onClick={cancelRename}>
                {t(d, "lists.cancel")}
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex items-center gap-3">
            <h1 className="flex-1 text-2xl font-extrabold">{list.name}</h1>
            {isCompleted && (
              <span className="rounded-full bg-black/5 px-3 py-1 text-sm font-bold text-ink/70">
                {t(d, "lists.completedBadge")}
              </span>
            )}
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={listActionPending}
                onClick={startRename}
              >
                {t(d, "lists.rename")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={listActionPending}
                onClick={handleDuplicate}
              >
                {t(d, "lists.duplicate")}
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                disabled={listActionPending}
                onClick={handleDelete}
              >
                {t(d, "lists.delete")}
              </Button>
            </div>
          </div>
        )}
        {nameError && <p className="mt-2 text-sm text-red-600">{nameError}</p>}
      </div>

      {total > 0 && (
        <p className="text-sm font-bold text-ink/70">
          {t(d, "lists.progress", { bought, total })}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {list.items.length === 0 ? (
          <p className="text-ink/60">{t(d, "lists.emptyItems")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {list.items.map((row) => {
              const isEditing = editingItemId === row.id;
              const isPending = pendingItemId === row.id;
              const label = row.item
                ? `${row.item.emoji} ${row.item.name}`
                : t(d, "lists.unknownItem");

              if (isEditing) {
                return (
                  <li key={row.id} className="rounded-2xl border border-border bg-white p-4">
                    <div className="mb-2 font-bold">{label}</div>
                    <form
                      onSubmit={(e) => handleSaveEditItem(e, row.id)}
                      className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-2"
                    >
                      <div className="w-24">
                        <Input
                          id={`editQuantity-${row.id}`}
                          type="number"
                          min="0"
                          step="any"
                          label={t(d, "lists.quantity")}
                          value={editQuantity}
                          onChange={(e) => setEditQuantity(e.target.value)}
                          required
                          autoFocus
                        />
                      </div>
                      <div className="w-24">
                        <Input
                          id={`editUnit-${row.id}`}
                          type="text"
                          label={t(d, "lists.unit")}
                          value={editUnit}
                          onChange={(e) => setEditUnit(e.target.value)}
                        />
                      </div>
                      <div className="flex-1">
                        <Input
                          id={`editNotes-${row.id}`}
                          type="text"
                          label={t(d, "lists.notes")}
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button type="submit" disabled={savingItem}>
                          {savingItem ? t(d, "common.saving") : t(d, "lists.save")}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={savingItem}
                          onClick={cancelEditItem}
                        >
                          {t(d, "lists.cancel")}
                        </Button>
                      </div>
                    </form>
                    {editItemError && (
                      <p className="mt-2 text-sm text-red-600">{editItemError}</p>
                    )}
                  </li>
                );
              }

              const isToggling = togglingItemId === row.id;

              return (
                <li
                  key={row.id}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-white p-4"
                >
                  {!isCompleted && (
                    <input
                      type="checkbox"
                      checked={row.isBought}
                      disabled={isToggling}
                      aria-label={t(d, "lists.markBought")}
                      onChange={() => toggleBought(row.id, !row.isBought)}
                      className="h-5 w-5 shrink-0 accent-brand"
                    />
                  )}
                  <div className="flex-1">
                    <div
                      className={
                        row.isBought
                          ? "font-bold line-through opacity-50"
                          : "font-bold"
                      }
                    >
                      {label}
                    </div>
                    <div
                      className={
                        row.isBought
                          ? "text-sm text-ink/60 line-through opacity-50"
                          : "text-sm text-ink/60"
                      }
                    >
                      {row.quantity} {row.unit}
                      {row.notes ? ` · ${row.notes}` : ""}
                    </div>
                  </div>
                  {!isCompleted && (
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isPending}
                        onClick={() => startEditItem(row)}
                      >
                        {t(d, "lists.edit")}
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleRemoveItem(row.id)}
                      >
                        {t(d, "lists.remove")}
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {toggleError && <p className="text-sm text-red-600">{toggleError}</p>}
      </div>

      {!isCompleted && (
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-white p-4">
          {showCompleteChoice ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-ink/70">{t(d, "lists.completePrompt")}</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" disabled={completing} onClick={() => handleComplete(true)}>
                  {t(d, "lists.carryOver")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={completing}
                  onClick={() => handleComplete(false)}
                >
                  {t(d, "lists.completeAnyway")}
                </Button>
              </div>
            </div>
          ) : (
            <Button type="button" disabled={completing} onClick={handleCompleteClick}>
              {t(d, "lists.complete")}
            </Button>
          )}
          {completeError && <p className="text-sm text-red-600">{completeError}</p>}
        </div>
      )}

      {!isCompleted && (
      <form
        onSubmit={handleAddItem}
        className="flex flex-col gap-3 rounded-2xl border border-border bg-white p-4"
      >
        <h2 className="text-lg font-bold">{t(d, "lists.addItem")}</h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-2">
          <div className="flex-1">
            <label htmlFor="addItemSelect" className="mb-1.5 block text-sm font-bold text-ink">
              {t(d, "lists.chooseItem")}
            </label>
            <select
              id="addItemSelect"
              value={addItemId}
              onChange={(e) => handleSelectCatalogItem(e.target.value)}
              className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            >
              <option value="">{t(d, "lists.chooseItem")}</option>
              {catalogItems.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="w-24">
            <Input
              id="addItemQuantity"
              type="number"
              min="0"
              step="any"
              label={t(d, "lists.quantity")}
              value={addQuantity}
              onChange={(e) => setAddQuantity(e.target.value)}
              required
            />
          </div>
          <div className="w-24">
            <Input
              id="addItemUnit"
              type="text"
              label={t(d, "lists.unit")}
              value={addUnit}
              onChange={(e) => setAddUnit(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <Input
              id="addItemNotes"
              type="text"
              label={t(d, "lists.notes")}
              value={addNotes}
              onChange={(e) => setAddNotes(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={adding}>
            {adding ? t(d, "common.saving") : t(d, "lists.addItem")}
          </Button>
        </div>
        {addError && <p className="text-sm text-red-600">{addError}</p>}
      </form>
      )}
    </div>
  );
}
