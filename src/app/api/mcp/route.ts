import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { verifyMcpToken } from "@/lib/mcp-token";
import { searchItems, getLists, getNeedToBuy, listTags, listCategories, listPrices } from "@/lib/mcp-queries";
import { addListItemCore, updateListItemCore, setListItemBoughtCore } from "@/lib/mutations/list-items";
import { createListCore, renameListCore, deleteListCore, duplicateListCore, completeListCore } from "@/lib/mutations/lists";

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
