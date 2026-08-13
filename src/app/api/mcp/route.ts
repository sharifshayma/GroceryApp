import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { verifyMcpToken } from "@/lib/mcp-token";
import { searchItems, getLists, getNeedToBuy, listTags, listPrices } from "@/lib/mcp-queries";

function hh(extra: unknown): string {
  const id = (extra as { authInfo?: { extra?: { householdId?: string } } })?.authInfo?.extra?.householdId;
  if (!id) throw new Error("No household in auth context");
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
      "list_prices",
      "List recorded prices for this household, newest first, with a cheapest flag per item. Optional itemId filter.",
      { itemId: z.string().optional() },
      async ({ itemId }, extra) => json(await listPrices(hh(extra), itemId)),
    );
  },
  { serverInfo: { name: "grocery", version: "1.0.0" } },
  { basePath: "/api", maxDuration: 60, verboseLogs: true },
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
