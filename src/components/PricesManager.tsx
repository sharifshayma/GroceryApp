"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { addPriceEntry, updatePriceEntry, deletePriceEntry } from "@/actions/prices";
import { formatPrice } from "@/lib/format-price";
import { getDictionary, t } from "@/i18n";

const d = getDictionary("en");

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

interface PriceEntryRow {
  id: string;
  price: number;
  currency: string;
  store: string | null;
  purchasedAt: string;
}

interface PricedItem {
  item: { id: string; name: string; emoji: string };
  entries: PriceEntryRow[];
  cheapest: { price: number; currency: string; store: string | null; purchasedAt: string } | null;
}

interface CatalogItem {
  id: string;
  name: string;
  emoji: string;
}

export function PricesManager({
  pricedItems,
  catalogItems,
}: {
  pricedItems: PricedItem[];
  catalogItems: CatalogItem[];
}) {
  const router = useRouter();

  // Log-a-price form state
  const [addItemId, setAddItemId] = useState("");
  const [addPrice, setAddPrice] = useState("");
  const [addStore, setAddStore] = useState("");
  const [addDate, setAddDate] = useState(today());
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // Which item's history is expanded
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  // Which entry is being edited, and its edit-form state
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editStore, setEditStore] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Entry id currently running a delete mutation
  const [pendingEntryId, setPendingEntryId] = useState<string | null>(null);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setAddError(null);
    if (!addItemId) {
      setAddError(t(d, "prices.chooseItem"));
      return;
    }
    setAdding(true);
    const result = await addPriceEntry({
      itemId: addItemId,
      price: Number(addPrice),
      store: addStore,
      purchasedAt: addDate,
    });
    setAdding(false);
    if (!result.ok) {
      setAddError(result.error);
      return;
    }
    setAddItemId("");
    setAddPrice("");
    setAddStore("");
    setAddDate(today());
    router.refresh();
  }

  function toggleExpanded(itemId: string) {
    setExpandedItemId((cur) => (cur === itemId ? null : itemId));
    setEditingEntryId(null);
    setEditError(null);
  }

  function startEdit(entry: PriceEntryRow) {
    setEditingEntryId(entry.id);
    setEditPrice(String(entry.price));
    setEditStore(entry.store ?? "");
    setEditDate(entry.purchasedAt);
    setEditError(null);
  }

  function cancelEdit() {
    setEditingEntryId(null);
    setEditError(null);
  }

  async function handleSaveEdit(e: FormEvent, entryId: string) {
    e.preventDefault();
    setEditError(null);
    setSaving(true);
    const result = await updatePriceEntry({
      entryId,
      price: Number(editPrice),
      store: editStore,
      purchasedAt: editDate,
    });
    setSaving(false);
    if (!result.ok) {
      setEditError(result.error);
      return;
    }
    setEditingEntryId(null);
    router.refresh();
  }

  async function handleRemove(entryId: string) {
    if (!confirm(t(d, "prices.removeConfirm"))) return;
    setPendingEntryId(entryId);
    const result = await deletePriceEntry(entryId);
    setPendingEntryId(null);
    if (!result.ok) {
      alert(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-4 sm:p-6">
      <h1 className="text-2xl font-extrabold">{t(d, "prices.title")}</h1>

      {/* Log a price */}
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">{t(d, "prices.logPrice")}</h2>
        <form
          onSubmit={handleAdd}
          className="flex flex-col gap-3 rounded-2xl border border-border bg-white p-4 sm:flex-row sm:items-end sm:gap-2"
        >
          <div className="flex-1">
            <label htmlFor="addPriceItem" className="mb-1.5 block text-sm font-bold text-ink">
              {t(d, "prices.chooseItem")}
            </label>
            <select
              id="addPriceItem"
              value={addItemId}
              onChange={(e) => setAddItemId(e.target.value)}
              className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            >
              <option value="">{t(d, "prices.chooseItem")}</option>
              {catalogItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.emoji} {item.name}
                </option>
              ))}
            </select>
          </div>
          <div className="w-24">
            <Input
              id="addPriceAmount"
              label={t(d, "prices.price")}
              type="number"
              step="0.01"
              min="0"
              value={addPrice}
              onChange={(e) => setAddPrice(e.target.value)}
              required
            />
          </div>
          <div className="flex-1">
            <Input
              id="addPriceStore"
              label={t(d, "prices.store")}
              type="text"
              value={addStore}
              onChange={(e) => setAddStore(e.target.value)}
            />
          </div>
          <div className="w-40">
            <Input
              id="addPriceDate"
              label={t(d, "prices.date")}
              type="date"
              value={addDate}
              onChange={(e) => setAddDate(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={adding}>
            {adding ? t(d, "common.saving") : t(d, "prices.save")}
          </Button>
        </form>
        {addError && <p className="text-sm text-red-600">{addError}</p>}
      </div>

      {/* Priced items */}
      <div className="flex flex-col gap-3">
        {pricedItems.length === 0 ? (
          <p className="text-ink/60">{t(d, "prices.empty")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pricedItems.map((row) => {
              const isExpanded = expandedItemId === row.item.id;
              const cheapest = row.cheapest;

              return (
                <li
                  key={row.item.id}
                  className="rounded-2xl border border-border bg-white p-4"
                >
                  <button
                    type="button"
                    onClick={() => toggleExpanded(row.item.id)}
                    className="flex w-full items-center gap-3 text-left"
                  >
                    <span className="text-2xl">{row.item.emoji}</span>
                    <div className="flex-1">
                      <div className="font-bold">{row.item.name}</div>
                      {cheapest && (
                        <div className="text-sm text-ink/60">
                          {t(d, "prices.cheapest")}: {formatPrice(cheapest.price, cheapest.currency)}
                          {" · "}
                          {cheapest.store ?? t(d, "prices.noStore")}
                          {" · "}
                          {cheapest.purchasedAt}
                        </div>
                      )}
                    </div>
                    <span className="text-sm text-ink/60">
                      {row.entries.length} {t(d, "prices.entriesCount")}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
                      <h3 className="text-sm font-bold text-ink/70">{t(d, "prices.history")}</h3>
                      <ul className="flex flex-col gap-2">
                        {row.entries.map((entry) => {
                          const isEditingEntry = editingEntryId === entry.id;
                          const isPending = pendingEntryId === entry.id;

                          if (isEditingEntry) {
                            return (
                              <li
                                key={entry.id}
                                className="rounded-xl border border-border bg-white p-3"
                              >
                                <form
                                  onSubmit={(e) => handleSaveEdit(e, entry.id)}
                                  className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-2"
                                >
                                  <div className="w-24">
                                    <Input
                                      id={`editPrice-${entry.id}`}
                                      label={t(d, "prices.price")}
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={editPrice}
                                      onChange={(e) => setEditPrice(e.target.value)}
                                      required
                                      autoFocus
                                    />
                                  </div>
                                  <div className="flex-1">
                                    <Input
                                      id={`editStore-${entry.id}`}
                                      label={t(d, "prices.store")}
                                      type="text"
                                      value={editStore}
                                      onChange={(e) => setEditStore(e.target.value)}
                                    />
                                  </div>
                                  <div className="w-40">
                                    <Input
                                      id={`editDate-${entry.id}`}
                                      label={t(d, "prices.date")}
                                      type="date"
                                      value={editDate}
                                      onChange={(e) => setEditDate(e.target.value)}
                                      required
                                    />
                                  </div>
                                  <div className="flex gap-2">
                                    <Button type="submit" disabled={saving}>
                                      {saving ? t(d, "common.saving") : t(d, "prices.save")}
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      disabled={saving}
                                      onClick={cancelEdit}
                                    >
                                      {t(d, "prices.cancel")}
                                    </Button>
                                  </div>
                                </form>
                                {editError && (
                                  <p className="mt-2 text-sm text-red-600">{editError}</p>
                                )}
                              </li>
                            );
                          }

                          return (
                            <li
                              key={entry.id}
                              className="flex items-center gap-3 rounded-xl border border-border bg-white p-3"
                            >
                              <div className="flex-1 text-sm">
                                <span className="font-bold">
                                  {formatPrice(entry.price, entry.currency)}
                                </span>{" "}
                                <span className="text-ink/60">
                                  {entry.store ?? t(d, "prices.noStore")} · {entry.purchasedAt}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  disabled={isPending}
                                  onClick={() => startEdit(entry)}
                                >
                                  {t(d, "prices.edit")}
                                </Button>
                                <Button
                                  type="button"
                                  variant="danger"
                                  size="sm"
                                  disabled={isPending}
                                  onClick={() => handleRemove(entry.id)}
                                >
                                  {t(d, "prices.remove")}
                                </Button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
