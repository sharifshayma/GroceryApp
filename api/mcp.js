// MCP server for the grocery app — Streamable HTTP transport on Vercel.
//
// Auth: callers send `Authorization: Bearer <token>`. Two flows are supported:
//   1. Supabase JWT (issued via the OAuth flow at /authorize → /api/oauth/*) —
//      validated by supabase.auth.getUser(); household_id is resolved from
//      the user's profile.
//   2. Static personal token (Profile → Connect to Claude) — SHA-256-hashed
//      and looked up in `mcp_tokens`, which carries household_id and user_id
//      directly. JWT is tried first, static is the fallback.
//
// Either way we end up with a `ctx = { householdId, userId }` and the rest of
// the request runs against a service-role client whose queries filter by
// household_id explicitly (see src/lib/grocery.js).
//
// Each request creates a fresh server + transport (stateless mode) so the
// function can scale horizontally without session state.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { createHash } from 'crypto'
import * as grocery from '../src/lib/grocery.js'

// --- Supabase admin client ---------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

let _supabase = null
function getSupabase() {
  if (_supabase) return _supabase
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars are missing')
  }
  _supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return _supabase
}
// Module-level alias used by the rest of the file. We re-bind below in the
// handler when env is verified, so server cold-starts don't crash on import.
const supabase = new Proxy(
  {},
  {
    get(_t, prop) {
      return getSupabase()[prop]
    },
  }
)

// --- Auth --------------------------------------------------------------------

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

async function authenticateStatic(token) {
  const tokenHash = hashToken(token)
  const { data } = await supabase
    .from('mcp_tokens')
    .select('id, household_id, user_id')
    .eq('token_hash', tokenHash)
    .maybeSingle()
  if (!data) return null
  // Bump last_used_at, fire-and-forget.
  supabase
    .from('mcp_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => {}, () => {})
  return { householdId: data.household_id, userId: data.user_id }
}

// Supabase JWTs always start with `eyJ` (base64-encoded "{...). We use this as
// a cheap heuristic to decide which flow to try first — there's no reason to
// hit Supabase's auth API for a static 64-hex-char personal token.
function looksLikeJwt(token) {
  return token.startsWith('eyJ') && token.split('.').length === 3
}

async function authenticateJwt(token) {
  if (!ANON_KEY) return null
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data, error } = await userClient.auth.getUser()
  if (error || !data?.user) return null
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('household_id')
    .eq('id', data.user.id)
    .maybeSingle()
  if (profileError || !profile?.household_id) return null
  return { householdId: profile.household_id, userId: data.user.id }
}

async function authenticate(token) {
  if (looksLikeJwt(token)) {
    const ctx = await authenticateJwt(token)
    if (ctx) return ctx
  }
  return authenticateStatic(token)
}

// --- Result helper ----------------------------------------------------------

function tx(payload) {
  return { content: [{ type: 'text', text: JSON.stringify(payload) }] }
}

// --- Resolvers --------------------------------------------------------------

async function resolveItem(ctx, query) {
  const trimmed = (query || '').trim()
  if (!trimmed) return { ok: false, error: { error: 'no_match', entity: 'item', query } }
  const items = await grocery.searchItems(supabase, ctx, { query: trimmed, limit: 5 })
  if (items.length === 0) return { ok: false, error: { error: 'no_match', entity: 'item', query: trimmed } }
  const lower = trimmed.toLowerCase()
  const exact = items.find(
    (i) => (i.name || '').toLowerCase() === lower || (i.name_he || '').toLowerCase() === lower
  )
  if (exact) return { ok: true, value: exact }
  if (items.length === 1) return { ok: true, value: items[0] }
  return {
    ok: false,
    error: {
      error: 'ambiguous',
      entity: 'item',
      candidates: items.slice(0, 3).map((i) => ({
        id: i.id,
        name: i.name,
        name_he: i.name_he,
        emoji: i.emoji,
        category: i.categories?.name,
      })),
    },
  }
}

async function resolveOpenList(ctx, query) {
  const trimmed = (query || '').trim()
  if (!trimmed) {
    const lists = await grocery.fetchLists(supabase, ctx, { status: 'open' })
    return { ok: true, value: lists[0] || null }
  }
  const matches = await grocery.searchLists(supabase, ctx, { query: trimmed, statusFilter: 'open' })
  if (matches.length === 0) {
    const open = await grocery.fetchLists(supabase, ctx, { status: 'open' })
    return {
      ok: false,
      error: {
        error: 'no_match',
        entity: 'list',
        query: trimmed,
        open_lists: (open || []).map((l) => ({ name: l.name })),
      },
    }
  }
  const lower = trimmed.toLowerCase()
  const exact = matches.find((l) => (l.name || '').toLowerCase() === lower)
  if (exact) return { ok: true, value: exact }
  if (matches.length === 1) return { ok: true, value: matches[0] }
  return {
    ok: false,
    error: {
      error: 'ambiguous',
      entity: 'list',
      candidates: matches.slice(0, 3).map((l) => ({ id: l.id, name: l.name, status: l.status })),
    },
  }
}

async function resolveAnyList(ctx, query) {
  const trimmed = (query || '').trim()
  if (!trimmed) return { ok: false, error: { error: 'missing_arg', arg: 'list_query' } }
  const matches = await grocery.searchLists(supabase, ctx, { query: trimmed, statusFilter: 'all' })
  if (matches.length === 0) {
    const open = await grocery.fetchLists(supabase, ctx, { status: 'open' })
    return {
      ok: false,
      error: {
        error: 'no_match',
        entity: 'list',
        query: trimmed,
        open_lists: (open || []).map((l) => ({ name: l.name })),
      },
    }
  }
  const lower = trimmed.toLowerCase()
  const exact = matches.find((l) => (l.name || '').toLowerCase() === lower)
  if (exact) return { ok: true, value: exact }
  if (matches.length === 1) return { ok: true, value: matches[0] }
  return {
    ok: false,
    error: {
      error: 'ambiguous',
      entity: 'list',
      candidates: matches.slice(0, 3).map((l) => ({ id: l.id, name: l.name, status: l.status })),
    },
  }
}

async function resolveTag(ctx, name, type) {
  const trimmed = (name || '').trim()
  if (!trimmed) return { ok: false, error: { error: 'no_match', entity: 'tag', query: name } }
  const matches = await grocery.searchTags(supabase, ctx, { name: trimmed, type })
  if (matches.length === 0) return { ok: false, error: { error: 'no_match', entity: 'tag', query: trimmed } }
  const lower = trimmed.toLowerCase()
  const exact = matches.find((t) => (t.name || '').toLowerCase() === lower)
  if (exact) return { ok: true, value: exact }
  if (matches.length === 1) return { ok: true, value: matches[0] }
  return {
    ok: false,
    error: {
      error: 'ambiguous',
      entity: 'tag',
      candidates: matches.slice(0, 3).map((t) => ({ id: t.id, name: t.name, type: t.type })),
    },
  }
}

// --- Server factory ---------------------------------------------------------

function createServer(ctx) {
  const server = new McpServer({ name: 'grocery', version: '1.0.0' })

  // ---- 1. search_items ----
  server.registerTool(
    'search_items',
    {
      title: 'Search items',
      description: `Find items by name in English or Hebrew, case-insensitive. Returns enriched data: current stock state and which lists each item appears on.

Use this whenever the user names an item — to resolve "milk" before mutating it, or to answer "do I have X?" / "is X on my list?". Prefer this over guessing an item's identity.

Returns { items: [{ id, name, name_he, emoji, default_unit, category, in_stock, on_lists }] } or { error: "no_match", query } when nothing matches.`,
      inputSchema: {
        query: z.string().describe('Partial item name in English or Hebrew.'),
        limit: z.number().int().min(1).max(10).optional().describe('Max results, default 5.'),
      },
    },
    async ({ query, limit }) => {
      const items = await grocery.searchItems(supabase, ctx, { query, limit: limit ?? 5 })
      if (items.length === 0) return tx({ error: 'no_match', query })
      const ids = items.map((i) => i.id)
      const { stockByItem, listsByItem } = await grocery.getItemsContext(supabase, ctx, { itemIds: ids })
      return tx({
        items: items.map((i) => {
          const stock = stockByItem.get(i.id)
          return {
            id: i.id,
            name: i.name,
            name_he: i.name_he,
            emoji: i.emoji,
            default_unit: i.default_unit,
            category: i.categories
              ? { id: i.categories.id, name: i.categories.name, emoji: i.categories.emoji }
              : null,
            in_stock: stock
              ? {
                  quantity: stock.quantity,
                  unit: stock.unit,
                  low_threshold: stock.low_threshold,
                  is_low: stock.quantity <= stock.low_threshold,
                }
              : null,
            on_lists: listsByItem.get(i.id) || [],
          }
        }),
      })
    }
  )

  // ---- 2. get_lists ----
  server.registerTool(
    'get_lists',
    {
      title: 'Read grocery lists',
      description: `Read grocery lists. Without list_query, returns summaries of all matching lists. With list_query, returns one list with its items.

Use this for "what's on my list?" or "show all my lists". For the shopping-mode question "what do I need to buy?", prefer get_need_to_buy.

Returns either { lists: [...] } (when listing many) or { list: { ..., items: [...] } } (when fetching one).`,
      inputSchema: {
        list_query: z.string().optional().describe('Fuzzy list name. Omit to list many.'),
        status: z
          .enum(['open', 'draft', 'active', 'completed', 'all'])
          .optional()
          .describe('Filter when listing many. Default "open" = draft + active.'),
        include_bought: z
          .boolean()
          .optional()
          .describe('When fetching one list, whether to include items already marked bought. Default true.'),
      },
    },
    async ({ list_query, status, include_bought }) => {
      if (list_query) {
        const r = await resolveAnyList(ctx, list_query)
        if (!r.ok) return tx(r.error)
        const all = await grocery.fetchLists(supabase, ctx)
        const full = all.find((l) => l.id === r.value.id)
        if (!full) return tx({ error: 'no_match', entity: 'list', query: list_query })
        const items = (full.list_items || [])
          .filter((li) => include_bought !== false || !li.is_bought)
          .map((li) => ({
            list_item_id: li.id,
            item: {
              id: li.item_id,
              name: li.items?.name,
              emoji: li.items?.emoji,
              default_unit: li.items?.default_unit,
            },
            quantity: li.quantity,
            unit: li.unit,
            is_bought: li.is_bought,
          }))
        return tx({ list: { id: full.id, name: full.name, status: full.status, items } })
      }
      const all = await grocery.fetchLists(supabase, ctx, { status: status || 'open' })
      return tx({
        lists: all.map((l) => {
          const items = l.list_items || []
          return {
            id: l.id,
            name: l.name,
            status: l.status,
            item_count: items.length,
            unbought_count: items.filter((li) => !li.is_bought).length,
            created_at: l.created_at,
          }
        }),
      })
    }
  )

  // ---- 3. get_need_to_buy ----
  server.registerTool(
    'get_need_to_buy',
    {
      title: 'What to buy',
      description: `The "what do I need to buy?" view in one call. Combines (a) items low or out of stock (quantity ≤ low_threshold), and (b) unbought items across all open lists. Each entry is tagged with the reason it appears.

Use this for end-user questions like "what do I need to buy?", "what's running low?", or as a one-shot status check at the start of a shopping conversation. Don't use it to read a specific list — get_lists for that.`,
      inputSchema: {},
    },
    async () => tx(await grocery.fetchNeedToBuy(supabase, ctx))
  )

  // ---- 4. add_to_list ----
  server.registerTool(
    'add_to_list',
    {
      title: 'Add item to a list',
      description: `Add an item to a grocery list. If list_query is omitted, defaults to the most recently updated open (draft or active) list, or creates a new list named "Lists — <today's date>" if no open list exists.

Use this for "add X to my list" or "put X on Saturday's list". To mark something as bought, use mark_list_item; to remove, use edit_list_item.`,
      inputSchema: {
        item_query: z.string().describe('Fuzzy item name.'),
        quantity: z.number().positive().optional().describe('List quantity, default 1.'),
        unit: z.string().optional().describe('Unit override. Defaults to the item\'s default_unit.'),
        list_query: z.string().optional().describe('Fuzzy list name. Omit for smart default.'),
      },
    },
    async ({ item_query, quantity, unit, list_query }) => {
      const itemR = await resolveItem(ctx, item_query)
      if (!itemR.ok) return tx(itemR.error)
      const item = itemR.value

      let list
      let wasCreated = false
      if (list_query) {
        const listR = await resolveOpenList(ctx, list_query)
        if (!listR.ok) return tx(listR.error)
        if (!listR.value) return tx({ error: 'no_match', entity: 'list', query: list_query })
        list = listR.value
      } else {
        const listR = await resolveOpenList(ctx, '')
        if (listR.value) {
          list = listR.value
        } else {
          const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          list = await grocery.createList(supabase, ctx, { name: `Lists — ${today}`, items: [] })
          wasCreated = true
        }
      }

      const all = await grocery.fetchLists(supabase, ctx)
      const fullList = all.find((l) => l.id === list.id)
      const existing = (fullList?.list_items || []).find((li) => li.item_id === item.id)
      if (existing) {
        return tx({
          error: 'already_on_list',
          list_name: list.name,
          current_quantity: existing.quantity,
        })
      }

      const li = await grocery.addItemToList(supabase, ctx, {
        listId: list.id,
        itemId: item.id,
        quantity: quantity ?? 1,
        unit: unit || item.default_unit || 'pcs',
      })

      return tx({
        list: { id: list.id, name: list.name, was_created: wasCreated },
        item: { id: item.id, name: item.name },
        list_item_id: li.id,
        quantity: li.quantity,
        unit: li.unit,
      })
    }
  )

  // ---- 5. mark_list_item ----
  server.registerTool(
    'mark_list_item',
    {
      title: 'Mark list item bought / unbought',
      description: `Mark an item on a list as bought or not bought. When marking bought, also_update_stock=true (the default) increments the household's stock by the list quantity, creating a stock row if missing — same behavior as the in-app checkbox.

Use this for "I bought X", "mark milk as bought", "uncheck eggs". Do not use this to add (use add_to_list) or remove (use edit_list_item).`,
      inputSchema: {
        item_query: z.string().describe('Fuzzy item name.'),
        bought: z.boolean().describe('true marks bought, false unmarks.'),
        list_query: z
          .string()
          .optional()
          .describe('Fuzzy list name. Defaults to the most recently updated open list that contains the item.'),
        also_update_stock: z
          .boolean()
          .optional()
          .describe('When bought=true, also increment stock. Default true.'),
      },
    },
    async ({ item_query, bought, list_query, also_update_stock }) => {
      const itemR = await resolveItem(ctx, item_query)
      if (!itemR.ok) return tx(itemR.error)
      const item = itemR.value

      let listIdFilter = null
      let listName = null
      if (list_query) {
        const listR = await resolveOpenList(ctx, list_query)
        if (!listR.ok) return tx(listR.error)
        if (!listR.value) return tx({ error: 'no_match', entity: 'list', query: list_query })
        listIdFilter = listR.value.id
        listName = listR.value.name
      }

      const li = await grocery.findOpenListItemForItem(supabase, ctx, {
        itemId: item.id,
        listId: listIdFilter,
      })
      if (!li) {
        const { listsByItem } = await grocery.getItemsContext(supabase, ctx, { itemIds: [item.id] })
        const onLists = listsByItem.get(item.id) || []
        return tx({
          error: 'not_on_list',
          item_name: item.name,
          open_lists_with_item: onLists
            .filter((l) => l.status === 'draft' || l.status === 'active')
            .map((l) => ({ list_name: l.list_name })),
        })
      }

      await grocery.setListItemBought(supabase, ctx, { listItemId: li.id, isBought: bought })

      let stockAfter = null
      if (bought && also_update_stock !== false) {
        const result = await grocery.adjustStock(supabase, ctx, {
          itemId: item.id,
          deltaQty: li.quantity,
          unit: li.unit,
        })
        stockAfter = { quantity: result.quantity_after, unit: li.unit }
      }

      return tx({
        list_name: listName || li.grocery_lists?.name,
        item: { id: item.id, name: item.name },
        was_bought: bought,
        stock_after: stockAfter,
      })
    }
  )

  // ---- 6. edit_list_item ----
  server.registerTool(
    'edit_list_item',
    {
      title: 'Change quantity or remove a list item',
      description: `Change the quantity of an item on a list, or remove it from the list.

Use for "change milk to 2 in my list" or "remove eggs from my list". To mark bought, use mark_list_item. To add a new item, use add_to_list.

At least one of quantity or remove must be provided.`,
      inputSchema: {
        item_query: z.string().describe('Fuzzy item name.'),
        list_query: z
          .string()
          .optional()
          .describe('Fuzzy list name. Defaults to the most recently updated open list that contains the item.'),
        quantity: z.number().positive().optional().describe('New quantity (must be > 0).'),
        remove: z.boolean().optional().describe('true to delete the list_item; quantity is ignored.'),
      },
    },
    async ({ item_query, list_query, quantity, remove }) => {
      if (quantity === undefined && !remove) return tx({ error: 'missing_change' })

      const itemR = await resolveItem(ctx, item_query)
      if (!itemR.ok) return tx(itemR.error)
      const item = itemR.value

      let listIdFilter = null
      let listName = null
      if (list_query) {
        const listR = await resolveOpenList(ctx, list_query)
        if (!listR.ok) return tx(listR.error)
        if (!listR.value) return tx({ error: 'no_match', entity: 'list', query: list_query })
        listIdFilter = listR.value.id
        listName = listR.value.name
      }

      const li = await grocery.findOpenListItemForItem(supabase, ctx, {
        itemId: item.id,
        listId: listIdFilter,
      })
      if (!li) return tx({ error: 'not_on_list', item_name: item.name })

      if (remove) {
        await grocery.removeItemFromList(supabase, ctx, { listItemId: li.id })
        return tx({
          list_name: listName || li.grocery_lists?.name,
          item: { id: item.id, name: item.name },
          action: 'removed',
        })
      }
      await grocery.updateListItemFields(supabase, ctx, {
        listItemId: li.id,
        updates: { quantity },
      })
      return tx({
        list_name: listName || li.grocery_lists?.name,
        item: { id: item.id, name: item.name },
        action: 'updated',
        quantity,
      })
    }
  )

  // ---- 7. set_stock ----
  server.registerTool(
    'set_stock',
    {
      title: 'Set absolute stock or threshold',
      description: `Set absolute stock quantity, the low-stock threshold, or untrack the item. Creates the stock row if it doesn't exist.

Use for "I have 3 boxes of pasta" (absolute), "alert me when bread is at 2 or fewer" (threshold only), or "stop tracking eggs" (untrack). For relative changes like "I used 1 egg", use adjust_stock instead.

At least one of quantity, low_threshold, or untrack=true must be set.`,
      inputSchema: {
        item_query: z.string().describe('Fuzzy item name.'),
        quantity: z.number().min(0).optional().describe('Absolute new quantity (≥ 0).'),
        unit: z.string().optional().describe('Unit override; defaults to existing or item.default_unit.'),
        low_threshold: z.number().min(0).optional().describe('Alert threshold (≥ 0).'),
        untrack: z
          .boolean()
          .optional()
          .describe('When true, deletes the stock row. Mutually exclusive with quantity / unit / low_threshold.'),
      },
    },
    async ({ item_query, quantity, unit, low_threshold, untrack }) => {
      if (untrack && (quantity !== undefined || unit !== undefined || low_threshold !== undefined)) {
        return tx({ error: 'conflicting_args' })
      }
      if (!untrack && quantity === undefined && low_threshold === undefined && unit === undefined) {
        return tx({ error: 'missing_change' })
      }
      const itemR = await resolveItem(ctx, item_query)
      if (!itemR.ok) return tx(itemR.error)
      const item = itemR.value

      if (untrack) {
        await grocery.deleteStockByItemId(supabase, ctx, { itemId: item.id })
        return tx({ item: { id: item.id, name: item.name }, action: 'untracked' })
      }

      const existing = await grocery.getStockByItemId(supabase, ctx, { itemId: item.id })
      if (existing) {
        const updates = await grocery.updateStockFields(supabase, ctx, {
          stockId: existing.id,
          quantity,
          unit,
          lowThreshold: low_threshold,
        })
        const newQty = updates.quantity ?? existing.quantity
        const newThreshold = updates.low_threshold ?? existing.low_threshold
        const newUnit = updates.unit ?? existing.unit
        return tx({
          item: { id: item.id, name: item.name },
          action: 'updated',
          quantity: newQty,
          unit: newUnit,
          low_threshold: newThreshold,
          is_low: newQty <= newThreshold,
        })
      }
      const created = await grocery.upsertStock(supabase, ctx, {
        itemId: item.id,
        quantity: quantity ?? 0,
        unit: unit || item.default_unit || 'pcs',
        lowThreshold: low_threshold ?? 1,
      })
      return tx({
        item: { id: item.id, name: item.name },
        action: 'created',
        quantity: created.quantity,
        unit: created.unit,
        low_threshold: created.low_threshold,
        is_low: created.quantity <= created.low_threshold,
      })
    }
  )

  // ---- 8. adjust_stock ----
  server.registerTool(
    'adjust_stock',
    {
      title: 'Increment or decrement stock',
      description: `Apply a relative change to stock. Positive delta adds (e.g. "I bought 2 more eggs" → delta: 2); negative subtracts (e.g. "I used 1 egg" → delta: -1). Creates the stock row at the delta value if missing. Final quantity is clamped at 0.

Use this whenever the user describes a change in relative terms. For absolute statements ("I have 3 left"), prefer set_stock.`,
      inputSchema: {
        item_query: z.string().describe('Fuzzy item name.'),
        delta: z.number().describe('Positive to add, negative to subtract. Cannot be 0.'),
      },
    },
    async ({ item_query, delta }) => {
      if (!Number.isFinite(delta) || delta === 0) return tx({ error: 'invalid_delta' })
      const itemR = await resolveItem(ctx, item_query)
      if (!itemR.ok) return tx(itemR.error)
      const item = itemR.value
      const result = await grocery.adjustStock(supabase, ctx, {
        itemId: item.id,
        deltaQty: delta,
        unit: item.default_unit,
      })
      return tx({
        item: { id: item.id, name: item.name },
        ...result,
      })
    }
  )

  // ---- V2 tools ----
  registerV2Tools(server, ctx)

  return server
}

// --- V2 tool group: manage_list, tag_item, list_tags ------------------------

function registerV2Tools(server, ctx) {
  // ---- 9. manage_list ----
  server.registerTool(
    'manage_list',
    {
      title: 'Rename, complete, or delete a list',
      description: `List lifecycle operations: rename, complete (close out a shopping trip), or delete a whole list. For changes inside a list, use the list-item tools.

Use for "rename my list to Saturday", "I'm done shopping" (action: "complete"), "delete the old May list".`,
      inputSchema: {
        action: z.enum(['rename', 'complete', 'delete']),
        list_query: z.string().describe('Fuzzy list name.'),
        name: z.string().optional().describe('Required when action="rename".'),
        confirm: z
          .boolean()
          .optional()
          .describe('Required when action="delete", must be true. The list and all its items are removed.'),
      },
    },
    async ({ action, list_query, name, confirm }) => {
      const listR = await resolveAnyList(ctx, list_query)
      if (!listR.ok) return tx(listR.error)
      const list = listR.value

      if (action === 'rename') {
        if (!name || !name.trim()) return tx({ error: 'missing_arg', arg: 'name' })
        await grocery.updateListName(supabase, ctx, { listId: list.id, name: name.trim() })
        return tx({ list: { id: list.id, name: name.trim(), status: list.status } })
      }
      if (action === 'complete') {
        await grocery.updateListStatus(supabase, ctx, { listId: list.id, status: 'completed' })
        return tx({ list: { id: list.id, name: list.name, status: 'completed' } })
      }
      // delete
      if (confirm !== true) return tx({ error: 'not_confirmed' })
      await grocery.deleteList(supabase, ctx, { listId: list.id })
      return tx({ list: { id: list.id, name: list.name, status: 'deleted' } })
    }
  )

  // ---- 10. tag_item ----
  server.registerTool(
    'tag_item',
    {
      title: 'Add or remove a tag on an item',
      description: `Add or remove a tag on an item. Tags label items by recipe (e.g. "pasta carbonara"), store, or custom group. When adding, the tag is created if it doesn't exist.

Use for "tag eggs with carbonara recipe" or "remove the Walmart tag from milk". For browsing tags, use list_tags.`,
      inputSchema: {
        action: z.enum(['add', 'remove']),
        item_query: z.string().describe('Fuzzy item name.'),
        tag_name: z.string().describe('Tag name.'),
        tag_type: z
          .enum(['recipe', 'store', 'custom'])
          .optional()
          .describe('Only used when adding a new tag. Default "custom".'),
        notes: z.string().optional().describe('Only used when adding (e.g. "2 cups" for a recipe ingredient).'),
      },
    },
    async ({ action, item_query, tag_name, tag_type, notes }) => {
      const itemR = await resolveItem(ctx, item_query)
      if (!itemR.ok) return tx(itemR.error)
      const item = itemR.value

      let tag
      if (action === 'add') {
        const existingR = await resolveTag(ctx, tag_name)
        if (existingR.ok) {
          tag = existingR.value
        } else if (existingR.error.error === 'no_match') {
          // Create the tag
          tag = await grocery.createTag(supabase, ctx, {
            name: tag_name.trim(),
            type: tag_type || 'custom',
          })
        } else {
          return tx(existingR.error)
        }
        await grocery.assignTagToItem(supabase, ctx, {
          itemId: item.id,
          tagId: tag.id,
          notes: notes || null,
        })
        return tx({
          item: { id: item.id, name: item.name },
          tag: { id: tag.id, name: tag.name, type: tag.type },
          action: 'add',
        })
      }
      // remove
      const tagR = await resolveTag(ctx, tag_name)
      if (!tagR.ok) return tx(tagR.error)
      const itemTags = await grocery.fetchItemTags(supabase, ctx, { itemId: item.id })
      const has = itemTags.some((it) => it.tag_id === tagR.value.id)
      if (!has) return tx({ error: 'not_tagged' })
      await grocery.removeTagFromItem(supabase, ctx, { itemId: item.id, tagId: tagR.value.id })
      return tx({
        item: { id: item.id, name: item.name },
        tag: { id: tagR.value.id, name: tagR.value.name, type: tagR.value.type },
        action: 'remove',
      })
    }
  )

  // ---- 11. list_tags ----
  server.registerTool(
    'list_tags',
    {
      title: 'List household tags',
      description: `List the household's tags, optionally filtered by type.

Use for "what recipes do I have?", "what stores are tagged?", or to discover tag names before calling tag_item.`,
      inputSchema: {
        type: z.enum(['recipe', 'store', 'custom', 'all']).optional().describe('Default "all".'),
      },
    },
    async ({ type }) => {
      const tags = await grocery.fetchTagsWithCounts(supabase, ctx, { type })
      return tx({
        tags: tags.map((t) => ({
          id: t.id,
          name: t.name,
          type: t.type,
          color: t.color,
          item_count: t.item_count,
        })),
      })
    }
  )
}

// --- HTTP handler -----------------------------------------------------------

export default async function handler(req, res) {
  if (req.method === 'GET') {
    res.status(200).json({ ok: true, name: 'grocery-mcp', version: '1.0.0' })
    return
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const auth = req.headers.authorization || ''
  const m = /^Bearer\s+(.+)$/.exec(auth)
  if (!m) {
    res.status(401).json({ error: 'Missing Authorization: Bearer <token>' })
    return
  }
  const ctx = await authenticate(m[1].trim())
  if (!ctx) {
    res.status(401).json({ error: 'Invalid token' })
    return
  }

  const server = createServer(ctx)
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })

  res.on('close', () => {
    transport.close()
    server.close()
  })

  try {
    await server.connect(transport)
    await transport.handleRequest(req, res, req.body)
  } catch (e) {
    console.error('[mcp] handler error:', e)
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal MCP error', message: e?.message })
    }
  }
}
