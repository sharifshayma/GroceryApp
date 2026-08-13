import { prisma } from "@/lib/prisma";
import { computeNeedToBuy } from "@/lib/need-to-buy";
import type { TagType } from "@prisma/client";

type PriceRow = { itemId: string; item: string; price: number; store: string | null; purchasedAt: string };

/** Flag the minimum-price row per itemId (item name is not unique). Pure — unit tested. */
export function markCheapest(rows: PriceRow[]): (PriceRow & { cheapest: boolean })[] {
  const min = new Map<string, number>();
  for (const r of rows) {
    const cur = min.get(r.itemId);
    if (cur === undefined || r.price < cur) min.set(r.itemId, r.price);
  }
  return rows.map((r) => ({ ...r, cheapest: r.price === min.get(r.itemId) }));
}

export async function searchItems(householdId: string, query: string, limit = 10) {
  const items = await prisma.item.findMany({
    where: {
      householdId,
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { nameHe: { contains: query, mode: "insensitive" } },
      ],
    },
    orderBy: { name: "asc" },
    take: Math.min(Math.max(limit, 1), 50),
    select: { id: true, name: true, nameHe: true, emoji: true, category: { select: { name: true } } },
  });
  return items.map((i) => ({
    id: i.id,
    name: i.name,
    nameHe: i.nameHe,
    emoji: i.emoji,
    category: i.category?.name ?? null,
  }));
}

export async function getLists(householdId: string, status: "open" | "all" = "open") {
  const lists = await prisma.groceryList.findMany({
    where: { householdId, ...(status === "open" ? { status: { not: "completed" } } : {}) },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, name: true, status: true,
      items: { select: { id: true, itemId: true, quantity: true, isBought: true, item: { select: { name: true } } } },
    },
  });
  return lists.map((l) => ({
    id: l.id, name: l.name, status: l.status,
    items: l.items.map((li) => ({ listItemId: li.id, itemId: li.itemId, name: li.item?.name ?? "?", quantity: li.quantity, bought: li.isBought })),
  }));
}

export async function getNeedToBuy(householdId: string) {
  const stock = await prisma.stock.findMany({
    where: { householdId },
    select: { itemId: true, quantity: true, lowThreshold: true, item: { select: { id: true, name: true, emoji: true } } },
  });
  const listItems = await prisma.listItem.findMany({
    where: { list: { householdId, status: { not: "completed" } }, isBought: false, itemId: { not: null } },
    select: { quantity: true, item: { select: { id: true, name: true, emoji: true } }, list: { select: { name: true } } },
  });
  const stockRows = stock.map((s) => ({
    itemId: s.itemId, item: s.item, quantity: s.quantity, lowThreshold: s.lowThreshold,
  }));
  const openListItems = listItems
    .filter((li): li is typeof li & { item: NonNullable<typeof li.item> } => li.item != null)
    .map((li) => ({ itemId: li.item.id, item: li.item, listName: li.list?.name ?? "?", quantity: li.quantity }));
  return computeNeedToBuy({ stockRows, openListItems });
}

export async function listTags(householdId: string, type?: string) {
  const tags = await prisma.tag.findMany({
    where: { householdId, ...(type ? { type: type as TagType } : {}) },
    orderBy: { name: "asc" },
    select: { id: true, name: true, type: true, _count: { select: { items: true } } },
  });
  return tags.map((t) => ({ id: t.id, name: t.name, type: t.type, itemCount: t._count.items }));
}

export async function listPrices(householdId: string, itemId?: string) {
  const entries = await prisma.priceHistory.findMany({
    where: { householdId, ...(itemId ? { itemId } : {}) },
    orderBy: { purchasedAt: "desc" },
    select: { price: true, store: true, purchasedAt: true, item: { select: { id: true, name: true } } },
  });
  const rows: PriceRow[] = entries.map((e) => ({
    itemId: e.item.id,
    item: e.item.name,
    price: Number(e.price),
    store: e.store,
    purchasedAt: e.purchasedAt.toISOString().slice(0, 10),
  }));
  return markCheapest(rows);
}
