"use client";

import { useRouter } from "next/navigation";
import { useT } from "@/i18n/LocaleProvider";
import { ListItemPicker } from "@/components/lists/ListItemPicker";
import { createListWithItems } from "@/actions/lists-extra";

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

export function CreateListClient({
  items,
  categories,
  tags,
  tagItemMap,
}: {
  items: Item[];
  categories: Category[];
  tags: Tag[];
  tagItemMap: Record<string, string[]>;
}) {
  const router = useRouter();
  const { t, locale } = useT();

  async function handleSubmit(
    pickedItems: { itemId: string; quantity: number; unit: string; notes?: string }[]
  ) {
    const name = `${t("nav.lists")} — ${new Date().toLocaleDateString(locale === "he" ? "he-IL" : "en-US", {
      month: "short",
      day: "numeric",
    })}`;
    const res = await createListWithItems({ name, items: pickedItems });
    if (res.ok) router.push("/lists");
  }

  return (
    <ListItemPicker
      items={items}
      categories={categories}
      tags={tags}
      tagItemMap={tagItemMap}
      submitLabel={t("lists.create")}
      onSubmit={handleSubmit}
      onBack={() => router.push("/lists")}
    />
  );
}
