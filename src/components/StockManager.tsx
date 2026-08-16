"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { setStock, adjustStock, removeStock } from "@/actions/stock";
import { isLowStock } from "@/lib/need-to-buy";
import { getDictionary, t } from "@/i18n";

const d = getDictionary("en");

interface StockRow {
  itemId: string;
  name: string;
  emoji: string;
  quantity: number;
  unit: string;
  lowThreshold: number;
}

interface UntrackedItem {
  id: string;
  name: string;
  emoji: string;
  defaultUnit: string;
}

interface NeedEntry {
  item: { id: string; name: string; emoji: string };
  reason: "low_stock" | "on_list" | "both";
  onLists: { listName: string; quantity: number }[];
  stock: { quantity: number; lowThreshold: number } | null;
}

interface NeedToBuy {
  entries: NeedEntry[];
  lowCount: number;
  onListCount: number;
}

const reasonKey: Record<NeedEntry["reason"], string> = {
  low_stock: "stock.reasonLow",
  on_list: "stock.reasonOnList",
  both: "stock.reasonBoth",
};

export function StockManager({
  stock,
  untrackedItems,
  needToBuy,
}: {
  stock: StockRow[];
  untrackedItems: UntrackedItem[];
  needToBuy: NeedToBuy;
}) {
  const router = useRouter();

  // Which row is being edited, and its edit-form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [editLowThreshold, setEditLowThreshold] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Item id currently running an adjust/remove mutation
  const [pendingId, setPendingId] = useState<string | null>(null);

  // Add-to-stock form state
  const [addItemId, setAddItemId] = useState("");
  const [addQuantity, setAddQuantity] = useState("");
  const [addUnit, setAddUnit] = useState("");
  const [addLowThreshold, setAddLowThreshold] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  function startEdit(row: StockRow) {
    setEditingId(row.itemId);
    setEditQuantity(String(row.quantity));
    setEditUnit(row.unit);
    setEditLowThreshold(String(row.lowThreshold));
    setEditError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError(null);
  }

  async function handleSaveEdit(e: FormEvent, itemId: string) {
    e.preventDefault();
    setEditError(null);
    setSaving(true);
    const result = await setStock({
      itemId,
      quantity: Number(editQuantity),
      unit: editUnit,
      lowThreshold: Number(editLowThreshold),
    });
    setSaving(false);
    if (!result.ok) {
      setEditError(result.error);
      return;
    }
    setEditingId(null);
    router.refresh();
  }

  async function handleAdjust(itemId: string, delta: number) {
    setPendingId(itemId);
    const result = await adjustStock({ itemId, delta });
    setPendingId(null);
    if (!result.ok) {
      alert(result.error);
      return;
    }
    router.refresh();
  }

  async function handleRemove(itemId: string) {
    if (!confirm(t(d, "stock.removeConfirm"))) return;
    setPendingId(itemId);
    const result = await removeStock(itemId);
    setPendingId(null);
    if (!result.ok) {
      alert(result.error);
      return;
    }
    router.refresh();
  }

  function handleChooseAddItem(id: string) {
    setAddItemId(id);
    const item = untrackedItems.find((i) => i.id === id);
    setAddUnit(item?.defaultUnit ?? "");
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setAddError(null);
    if (!addItemId) {
      setAddError(t(d, "stock.chooseItem"));
      return;
    }
    setAdding(true);
    const result = await setStock({
      itemId: addItemId,
      quantity: Number(addQuantity),
      unit: addUnit,
      lowThreshold: Number(addLowThreshold),
    });
    setAdding(false);
    if (!result.ok) {
      setAddError(result.error);
      return;
    }
    setAddItemId("");
    setAddQuantity("");
    setAddUnit("");
    setAddLowThreshold("");
    router.refresh();
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-4 sm:p-6">
      <h1 className="text-2xl font-extrabold">{t(d, "stock.title")}</h1>

      {/* Need to buy */}
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">{t(d, "stock.needToBuy")}</h2>
        {needToBuy.entries.length === 0 ? (
          <p className="text-ink/60">{t(d, "stock.needEmpty")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {needToBuy.entries.map((entry) => (
              <li
                key={entry.item.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-white p-4"
              >
                <span className="text-2xl">{entry.item.emoji}</span>
                <div className="flex-1">
                  <div className="font-bold">{entry.item.name}</div>
                  {entry.onLists.length > 0 && (
                    <div className="text-sm text-ink/60">
                      {t(d, "stock.onLists", {
                        lists: entry.onLists.map((l) => l.listName).join(", "),
                      })}
                    </div>
                  )}
                </div>
                <span className="rounded-full border px-2 py-0.5 text-xs font-bold text-ink/80">
                  {t(d, reasonKey[entry.reason])}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* In stock */}
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">{t(d, "stock.tracked")}</h2>
        {stock.length === 0 && <p className="text-ink/60">{t(d, "stock.trackedEmpty")}</p>}

        <ul className="flex flex-col gap-2">
          {stock.map((row) => {
            const isEditing = editingId === row.itemId;
            const isPending = pendingId === row.itemId;
            const low = isLowStock(row.quantity, row.lowThreshold);

            if (isEditing) {
              return (
                <li key={row.itemId} className="rounded-2xl border border-border bg-white p-4">
                  <form
                    onSubmit={(e) => handleSaveEdit(e, row.itemId)}
                    className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-2"
                  >
                    <div className="w-24">
                      <Input
                        id={`editQuantity-${row.itemId}`}
                        label={t(d, "stock.quantity")}
                        type="number"
                        step="any"
                        value={editQuantity}
                        onChange={(e) => setEditQuantity(e.target.value)}
                        required
                        autoFocus
                      />
                    </div>
                    <div className="flex-1">
                      <Input
                        id={`editUnit-${row.itemId}`}
                        label={t(d, "stock.unit")}
                        type="text"
                        value={editUnit}
                        onChange={(e) => setEditUnit(e.target.value)}
                      />
                    </div>
                    <div className="w-24">
                      <Input
                        id={`editLowThreshold-${row.itemId}`}
                        label={t(d, "stock.lowThreshold")}
                        type="number"
                        step="any"
                        value={editLowThreshold}
                        onChange={(e) => setEditLowThreshold(e.target.value)}
                        required
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" disabled={saving}>
                        {saving ? t(d, "common.saving") : t(d, "stock.save")}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={saving}
                        onClick={cancelEdit}
                      >
                        {t(d, "stock.cancel")}
                      </Button>
                    </div>
                  </form>
                  {editError && <p className="mt-2 text-sm text-red-600">{editError}</p>}
                </li>
              );
            }

            return (
              <li
                key={row.itemId}
                className="flex items-center gap-3 rounded-2xl border border-border bg-white p-4"
              >
                <span className="text-2xl">{row.emoji}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 font-bold">
                    {row.name}
                    {low && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                        {t(d, "stock.low")}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-ink/60">
                    {row.quantity} {row.unit}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label="-"
                    disabled={isPending}
                    onClick={() => handleAdjust(row.itemId, -1)}
                  >
                    −
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label="+"
                    disabled={isPending}
                    onClick={() => handleAdjust(row.itemId, 1)}
                  >
                    ＋
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    onClick={() => startEdit(row)}
                  >
                    {t(d, "stock.edit")}
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleRemove(row.itemId)}
                  >
                    {t(d, "stock.remove")}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Add to stock */}
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">{t(d, "stock.addToStock")}</h2>
        <form
          onSubmit={handleAdd}
          className="flex flex-col gap-3 rounded-2xl border border-border bg-white p-4 sm:flex-row sm:items-end sm:gap-2"
        >
          <div className="flex-1">
            <label htmlFor="addStockItem" className="mb-1.5 block text-sm font-bold text-ink">
              {t(d, "stock.chooseItem")}
            </label>
            <select
              id="addStockItem"
              value={addItemId}
              onChange={(e) => handleChooseAddItem(e.target.value)}
              className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            >
              <option value="">{t(d, "stock.chooseItem")}</option>
              {untrackedItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.emoji} {item.name}
                </option>
              ))}
            </select>
          </div>
          <div className="w-24">
            <Input
              id="addStockQuantity"
              label={t(d, "stock.quantity")}
              type="number"
              step="any"
              value={addQuantity}
              onChange={(e) => setAddQuantity(e.target.value)}
              required
            />
          </div>
          <div className="flex-1">
            <Input
              id="addStockUnit"
              label={t(d, "stock.unit")}
              type="text"
              value={addUnit}
              onChange={(e) => setAddUnit(e.target.value)}
            />
          </div>
          <div className="w-24">
            <Input
              id="addStockLowThreshold"
              label={t(d, "stock.lowThreshold")}
              type="number"
              step="any"
              value={addLowThreshold}
              onChange={(e) => setAddLowThreshold(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={adding}>
            {adding ? t(d, "common.saving") : t(d, "stock.save")}
          </Button>
        </form>
        {addError && <p className="text-sm text-red-600">{addError}</p>}
      </div>
    </div>
  );
}
