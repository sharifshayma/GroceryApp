import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { verifyMcpToken } from "@/lib/mcp-token";
import { searchItems, getLists, getNeedToBuy, listTags, listCategories, listPrices } from "@/lib/mcp-queries";
import { addListItemCore, updateListItemCore, setListItemBoughtCore } from "@/lib/mutations/list-items";
import { createListCore, renameListCore, deleteListCore, duplicateListCore, completeListCore } from "@/lib/mutations/lists";
import { createItemCore, updateItemCore, deleteItemCore } from "@/lib/mutations/items";
import { setStockCore, adjustStockCore } from "@/lib/mutations/stock";
import { addPriceEntryCore, updatePriceEntryCore, deletePriceEntryCore } from "@/lib/mutations/prices";
import { assignTagCore, unassignTagCore } from "@/lib/mutations/tags";

function hh(extra: unknown): string {
  const id = (extra as { authInfo?: { extra?: { householdId?: string } } })?.authInfo?.extra?.householdId;
  if (!id) throw new Error("No household in auth context");
  return id;
}
function uid(extra: unknown): string {
  const id = (extra as { authInfo?: { extra?: { userId?: string } } })?.authInfo?.extra?.userId;
  if (!id) throw new Error("No user in auth context");
  return id;
}
const json = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] });

const baseHandler = createMcpHandler(
  (server) => {
    server.tool(
      "search_items",
      "Search this household's catalog items by name (English or Hebrew). Returns id, name, emoji, category.",
      { query: z.string().describe("substring to match"), limit: z.number().int().positive().optional() },
      async ({ query, limit }, extra) => json(await searchItems(hh(extra), query, limit ?? 10)),
    );
    server.tool(
      "get_lists",
      "Get this household's grocery lists with their items. status 'open' (default) excludes completed lists; 'all' includes them.",
      { status: z.enum(["open", "all"]).optional() },
      async ({ status }, extra) => json(await getLists(hh(extra), status ?? "open")),
    );
    server.tool(
      "get_need_to_buy",
      "Get what this household needs to buy: low-stock items plus unbought items on open lists, deduped with reasons.",
      {},
      async (_args, extra) => json(await getNeedToBuy(hh(extra))),
    );
    server.tool(
      "list_tags",
      "List this household's tags (recipe/store/custom) with item counts. Optional type filter.",
      { type: z.enum(["recipe", "store", "custom"]).optional() },
      async ({ type }, extra) => json(await listTags(hh(extra), type)),
    );
    server.tool(
      "list_categories",
      "List the household's item categories (id, name, emoji). Use a category id with create_item/edit_item.",
      {},
      async (_args, extra) => json(await listCategories(hh(extra))),
    );
    server.tool(
      "list_prices",
      "List recorded prices for this household, newest first, with a cheapest flag per item. Optional itemId filter.",
      { itemId: z.string().optional() },
      async ({ itemId }, extra) => json(await listPrices(hh(extra), itemId)),
    );

    server.tool(
      "add_to_list",
      "Add a catalog item to a grocery list. Get listId from get_lists and itemId from search_items.",
      {
        listId: z.string(),
        itemId: z.string(),
        quantity: z.number().positive().optional(),
        unit: z.string().optional(),
        notes: z.string().optional(),
      },
      async ({ listId, itemId, quantity, unit, notes }, extra) =>
        json(await addListItemCore(hh(extra), { listId, itemId, quantity: quantity ?? 1, unit: unit ?? "pcs", notes })),
    );

    server.tool(
      "mark_list_item",
      "Mark a list line as bought or not bought. Get listItemId from get_lists (a list's items).",
      { listItemId: z.string(), bought: z.boolean() },
      async ({ listItemId, bought }, extra) =>
        json(await setListItemBoughtCore(hh(extra), uid(extra), { listItemId, isBought: bought })),
    );

    server.tool(
      "edit_list_item",
      "Edit a list line's quantity, unit, or notes. Get listItemId from get_lists.",
      {
        listItemId: z.string(),
        quantity: z.number().positive().optional(),
        unit: z.string().optional(),
        notes: z.string().optional(),
      },
      async ({ listItemId, quantity, unit, notes }, extra) =>
        json(await updateListItemCore(hh(extra), { listItemId, quantity: quantity ?? 1, unit: unit ?? "pcs", notes })),
    );

    server.tool(
      "manage_list",
      "Create, rename, complete, delete, or duplicate a grocery list. 'delete' removes the list AND its items. 'complete' with carryOver spawns a new draft holding the unbought items.",
      {
        action: z.enum(["create", "rename", "complete", "delete", "duplicate"]),
        name: z.string().optional(),
        listId: z.string().optional(),
        carryOver: z.boolean().optional(),
      },
      async ({ action, name, listId, carryOver }, extra) => {
        const householdId = hh(extra);
        switch (action) {
          case "create":
            if (!name) return json({ ok: false, error: "name is required to create a list" });
            return json(await createListCore(householdId, uid(extra), { name }));
          case "rename":
            if (!listId || !name) return json({ ok: false, error: "listId and name are required to rename" });
            return json(await renameListCore(householdId, { id: listId, name }));
          case "complete":
            if (!listId) return json({ ok: false, error: "listId is required to complete" });
            return json(await completeListCore(householdId, uid(extra), { listId, carryOver: carryOver ?? false }));
          case "delete":
            if (!listId) return json({ ok: false, error: "listId is required to delete" });
            return json(await deleteListCore(householdId, { id: listId }));
          case "duplicate":
            if (!listId) return json({ ok: false, error: "listId is required to duplicate" });
            return json(await duplicateListCore(householdId, uid(extra), { id: listId }));
        }
      },
    );

    server.tool(
      "create_item",
      "Create a catalog item. Optional categoryId from list_categories.",
      {
        name: z.string(),
        nameHe: z.string().optional(),
        emoji: z.string().optional(),
        defaultUnit: z.string().optional(),
        notes: z.string().optional(),
        categoryId: z.string().optional(),
        autoTrackStock: z.boolean().optional(),
      },
      async ({ name, nameHe, emoji, defaultUnit, notes, categoryId, autoTrackStock }, extra) =>
        json(await createItemCore(hh(extra), uid(extra), { name, nameHe, emoji, defaultUnit, notes, categoryId, autoTrackStock })),
    );

    server.tool(
      "edit_item",
      "Edit a catalog item. Get itemId from search_items; name is required. Optional categoryId from list_categories.",
      {
        itemId: z.string(),
        name: z.string(),
        nameHe: z.string().optional(),
        emoji: z.string().optional(),
        defaultUnit: z.string().optional(),
        notes: z.string().optional(),
        categoryId: z.string().optional(),
        autoTrackStock: z.boolean().optional(),
      },
      async ({ itemId, name, nameHe, emoji, defaultUnit, notes, categoryId, autoTrackStock }, extra) =>
        json(await updateItemCore(hh(extra), { id: itemId, name, nameHe, emoji, defaultUnit, notes, categoryId, autoTrackStock })),
    );

    server.tool(
      "delete_item",
      "Delete a catalog item. This also removes its stock, price history, list lines, and tags. Get itemId from search_items.",
      { itemId: z.string() },
      async ({ itemId }, extra) => json(await deleteItemCore(hh(extra), { id: itemId })),
    );

    server.tool(
      "set_stock",
      "Set an item's stock quantity, unit, and low threshold. Get itemId from search_items.",
      {
        itemId: z.string(),
        quantity: z.number(),
        unit: z.string().optional(),
        lowThreshold: z.number().optional(),
      },
      async ({ itemId, quantity, unit, lowThreshold }, extra) =>
        json(await setStockCore(hh(extra), uid(extra), { itemId, quantity, unit: unit ?? "", lowThreshold: lowThreshold ?? 1 })),
    );

    server.tool(
      "adjust_stock",
      "Add delta (may be negative) to an item's stock, clamped at 0. Get itemId from search_items.",
      { itemId: z.string(), delta: z.number() },
      async ({ itemId, delta }, extra) => json(await adjustStockCore(hh(extra), uid(extra), { itemId, delta })),
    );

    server.tool(
      "log_price",
      "Record a price for an item. Get itemId from search_items. purchasedAt is YYYY-MM-DD (defaults to today).",
      { itemId: z.string(), price: z.number(), store: z.string().optional(), purchasedAt: z.string().optional() },
      async ({ itemId, price, store, purchasedAt }, extra) =>
        json(await addPriceEntryCore(hh(extra), uid(extra), { itemId, price, store, purchasedAt })),
    );

    server.tool(
      "edit_price",
      "Edit a recorded price. Get entryId from list_prices. purchasedAt is YYYY-MM-DD.",
      { entryId: z.string(), price: z.number(), store: z.string().optional(), purchasedAt: z.string().optional() },
      async ({ entryId, price, store, purchasedAt }, extra) =>
        json(await updatePriceEntryCore(hh(extra), { entryId, price, store, purchasedAt })),
    );

    server.tool(
      "delete_price",
      "Delete a recorded price. Get entryId from list_prices.",
      { entryId: z.string() },
      async ({ entryId }, extra) => json(await deletePriceEntryCore(hh(extra), { entryId })),
    );

    server.tool(
      "tag_item",
      "Attach a tag to an item (or detach with attach:false); optionally set a note on the tag link. Get itemId from search_items and tagId from list_tags.",
      { itemId: z.string(), tagId: z.string(), attach: z.boolean().optional(), notes: z.string().optional() },
      async ({ itemId, tagId, attach, notes }, extra) =>
        json(attach === false
          ? await unassignTagCore(hh(extra), { itemId, tagId })
          : await assignTagCore(hh(extra), { itemId, tagId, note: notes })),
    );
  },
  { serverInfo: { name: "grocery", version: "1.0.0" } },
  { basePath: "/api", maxDuration: 60, verboseLogs: process.env.NODE_ENV !== "production" },
);

const authedHandler = withMcpAuth(
  baseHandler,
  async (_req: Request, bearer?: string) => {
    if (!bearer) return undefined;
    const v = await verifyMcpToken(bearer);
    if (!v) return undefined;
    return { token: bearer, scopes: [], clientId: v.tokenId, extra: { householdId: v.householdId, userId: v.userId } };
  },
  { required: true },
);

export { authedHandler as GET, authedHandler as POST };
