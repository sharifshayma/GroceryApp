"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/LocaleProvider";
import { ListItemPicker } from "@/components/lists/ListItemPicker";
import { addListItem, updateListItem, removeListItem } from "@/actions/list-items";

type Item = {
  id: string;
  name: string;
  nameHe: string | null;
  emoji: string;
  defaultUnit: string;
  categoryId: string | null;
};

type Category = { id: string; name: string; nameHe: string | null; emoji: string };
type Tag = { id: string; name: string; color: string; type: "recipe" | "store" | "custom" };

type ListItemRow = {
  id: string;
  itemId: string | null;
  quantity: number;
  unit: string;
  notes: string | null;
};

type List = {
  id: string;
  name: string;
  status: string;
  items: ListItemRow[];
};

export function EditListClient({
  list,
  items,
  categories,
  tags,
  tagItemMap,
}: {
  list: List;
  items: Item[];
  categories: Category[];
  tags: Tag[];
  tagItemMap: Record<string, string[]>;
}) {
  const router = useRouter();
  const { t } = useT();

  const initialSelected = useMemo(() => {
    const map: Record<string, { quantity: number; unit: string; notes?: string }> = {};
    for (const li of list.items) {
      if (!li.itemId) continue;
      map[li.itemId] = {
        quantity: li.quantity,
        unit: li.unit,
        notes: li.notes ?? undefined,
      };
    }
    return map;
  }, [list.items]);

  async function handleSubmit(
    pickedItems: { itemId: string; quantity: number; unit: string; notes?: string }[]
  ) {
    const original = new Map<
      string,
      { listItemId: string; quantity: number; unit: string; notes: string | null }
    >();
    for (const li of list.items) {
      if (!li.itemId) continue;
      original.set(li.itemId, {
        listItemId: li.id,
        quantity: li.quantity,
        unit: li.unit,
        notes: li.notes,
      });
    }

    const submittedItemIds = new Set(pickedItems.map((p) => p.itemId));

    for (const picked of pickedItems) {
      const existing = original.get(picked.itemId);
      if (!existing) {
        const res = await addListItem({
          listId: list.id,
          itemId: picked.itemId,
          quantity: picked.quantity,
          unit: picked.unit,
          notes: picked.notes ?? undefined,
        });
        if (!res.ok) return;
      } else if (
        existing.quantity !== picked.quantity ||
        existing.unit !== picked.unit ||
        (existing.notes ?? undefined) !== picked.notes
      ) {
        const res = await updateListItem({
          listItemId: existing.listItemId,
          quantity: picked.quantity,
          unit: picked.unit,
          notes: picked.notes ?? undefined,
        });
        if (!res.ok) return;
      }
    }

    for (const [itemId, existing] of original) {
      if (!submittedItemIds.has(itemId)) {
        const res = await removeListItem(existing.listItemId);
        if (!res.ok) return;
      }
    }

    router.push("/lists");
  }

  return (
    <ListItemPicker
      items={items}
      categories={categories}
      tags={tags}
      tagItemMap={tagItemMap}
      initialSelected={initialSelected}
      submitLabel={t("lists.save")}
      onSubmit={handleSubmit}
      onBack={() => router.push("/lists")}
    />
  );
}
