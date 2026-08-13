# GroceryApp Migration — Phase 5b-ii (MCP catalog/stock/price/tag write tools) design

**Date:** 2026-08-13
**Status:** Design, pending user review
**Depends on:** Phase 5a (MCP foundation + read tools) + Phase 5b-i (list write tools + shared-core pattern) — complete & pushed.

## Scope

Complete the MCP write surface with the remaining **9 tools** across catalog/stock/price/tag, using the
same **extract-shared-core** pattern established in 5b-i (each web action's household-scoped body moves
to a `src/lib/mutations/*` core taking explicit `(householdId, userId, input)`; the action becomes a
thin session wrapper; the MCP tool calls the core with the token's household/user). Also adds the two
**read-tool seams** these writes require: a new `list_categories` read tool (so `create_item`/`edit_item`
can obtain a category id) and exposing the price **entry id** in `list_prices` (so `edit_price`/
`delete_price` are reachable). After this phase the MCP server has **6 read + 13 write tools**.

The 9 write tools: `create_item`, `edit_item`, `delete_item`, `set_stock`, `adjust_stock`, `log_price`,
`edit_price`, `delete_price`, `tag_item`.

## Decisions (carried from 5b-i unless noted)

- **ID-based** tools; `create_item` takes a name (it creates). Category is ID-based via a new
  `list_categories` read tool + the existing `resolveCategoryId` (chosen over name-resolution/omission).
- **Extract cores** for items/stock/prices fully; for tags, extract **only** `assignTag`/`unassignTag`
  (tag CRUD — `createTag`/`updateTag`/`deleteTag` — has no MCP tool this phase and stays inline).
- **`tag_item`** covers both attach and detach via an `attach: boolean` (default `true`) → `assignTagCore`
  / `unassignTagCore`.
- `userId` (`createdById`/`loggedById`) comes only from the token context (`uid(extra)`), never input.
- **Trust the token** for destructive tools (`delete_item` cascades stock/prices/list-items/item-tags;
  `delete_price`); descriptions warn. **Deferrals stay:** no auto-track stock, no `ensureStoreTag`, no
  unit-price fields (`quantityAmount`/`quantityUnit` untouched).
- `edit_item` requires `name` (parity with the `updateItem` action, which always sets name) — Claude
  supplies it from `search_items`. Not changing action semantics this phase.

## Data model

No schema changes. Uses existing `Item` (`categoryId?`, `name`, `nameHe?`, `emoji` default 🛒,
`defaultUnit` default pcs, `notes?`, `createdById?`, `autoTrackStock` untouched), `Category`
(`name`, `nameHe?`, `emoji` default 📦, `sortOrder`, `isDefault`), `Stock`
(`@@unique([householdId,itemId])`, `quantity`, `unit`, `lowThreshold`, `updatedById?`), `PriceHistory`
(`price Decimal`, `currency`, `store?`, `purchasedAt @db.Date`, `loggedById?`), `Tag`, `ItemTag`.

## Components

### 1. Shared write-cores (new, under `src/lib/mutations/`)

Each mirrors the existing action body exactly, keyed by explicit ids, no `"use server"`/`revalidatePath`.
Reuse `clean` from `src/lib/mutations/util.ts` (5b-i). Small validation helpers stay local to each core.

- **`items.ts`** — `resolveCategoryId(householdId, categoryId)` (`null` | id | `false` for a foreign id);
  `createItemCore(householdId, userId, input)`, `updateItemCore(householdId, input)`,
  `deleteItemCore(householdId, { id })`.
- **`stock.ts`** — `nonNeg(n, fallback)`; `ownedItem(householdId, itemId)` (returns `{ id, defaultUnit }`);
  `setStockCore(householdId, userId, input)` (upsert on `householdId_itemId`),
  `adjustStockCore(householdId, userId, { itemId, delta })` (clamp ≥0, create-if-missing),
  `removeStockCore(householdId, { itemId })` (no MCP tool; keeps the web action wrapper-based).
- **`prices.ts`** — `validPrice(n)`, `parseDate(s)`, `ownedItem(householdId, itemId)`;
  `addPriceEntryCore(householdId, userId, input)`, `updatePriceEntryCore(householdId, { entryId, … })`,
  `deletePriceEntryCore(householdId, { entryId })`.
- **`tags.ts`** — `bothOwned(householdId, itemId, tagId)`; `assignTagCore(householdId, input)` (upsert on
  `itemId_tagId`), `unassignTagCore(householdId, input)`. (`createTag`/`updateTag`/`deleteTag` stay inline
  in the action — no core, no MCP tool.)

### 2. Thin action wrappers (rewrite the used functions)

`src/actions/{items,stock,prices}.ts` are rewritten so each exported function resolves
`requireHousehold()` (+ `getCurrentUser()` where the core needs `userId`), calls its core, and on success
runs the same `revalidatePath(...)` it runs today — keeping **exact public signatures + return types**
(`ListsManager`/`ItemManager`/`StockManager`/`PricesManager`/`TagManager` untouched). `src/actions/tags.ts`
changes only `assignTag`/`unassignTag` to delegate to the cores; `createTag`/`updateTag`/`deleteTag` are
left as-is.

### 3. Read-tool seams — `src/lib/mcp-queries.ts` + route.ts

- **`listCategories(householdId)`** (new query) → `{ id, name, nameHe, emoji }[]` ordered by
  `sortOrder`; registered as read tool **`list_categories`** ("List the household's item categories with
  ids, for create_item/edit_item"). This is the 6th read tool.
- **`listPrices` fix** — add the price row's `id` to the select and an `entryId` field to each output
  row (and `PriceRow`), so `list_prices` exposes the entry id `edit_price`/`delete_price` need.
  `markCheapest` still keys by `itemId` (unchanged).

### 4. MCP write tools — `src/app/api/mcp/route.ts`

Register 9 tools after the read tools, reusing `hh(extra)`/`uid(extra)`/`json(...)` (5b-i). Each returns
`json(coreResult)`:
- **`create_item`** `{ name, nameHe?, emoji?, defaultUnit?, notes?, categoryId? }` → `createItemCore(hh, uid, …)`.
- **`edit_item`** `{ itemId, name, nameHe?, emoji?, defaultUnit?, notes?, categoryId? }` → `updateItemCore(hh, { id: itemId, … })`.
- **`delete_item`** `{ itemId }` → `deleteItemCore(hh, { id: itemId })`. Description warns it removes the item and its stock/prices/list-lines/tags.
- **`set_stock`** `{ itemId, quantity, unit?, lowThreshold? }` → `setStockCore(hh, uid, { itemId, quantity, unit: unit ?? "", lowThreshold: lowThreshold ?? 1 })`.
- **`adjust_stock`** `{ itemId, delta }` → `adjustStockCore(hh, uid, { itemId, delta })`.
- **`log_price`** `{ itemId, price, store?, purchasedAt? }` → `addPriceEntryCore(hh, uid, …)`.
- **`edit_price`** `{ entryId, price, store?, purchasedAt? }` → `updatePriceEntryCore(hh, { entryId, … })`.
- **`delete_price`** `{ entryId }` → `deletePriceEntryCore(hh, { entryId })`.
- **`tag_item`** `{ itemId, tagId, attach? }` → `attach === false ? unassignTagCore(hh, …) : assignTagCore(hh, …)`.

## Authorization / integrity rules

- Every core mutation scoped by `householdId`; ownership gates (`resolveCategoryId`, `ownedItem`,
  `bothOwned`, scoped `updateMany`/`deleteMany`) reject cross-household ids with a not-found error.
  `set_stock`/`adjust_stock`/`log_price` verify the item; `tag_item` verifies BOTH item and tag;
  `create_item`/`edit_item` reject a foreign `categoryId`.
- `userId` only from `uid(extra)`. Deletes cascade per existing FKs (item → stock/prices/list-items/
  item-tags; nothing new).
- Action wrappers preserve public return types — web UI behaviorally unchanged (tsc across consumers
  proves it).

## Testing

- **Unit:** the pure bits worth covering — `validPrice` (>0 finite else null), `parseDate` (valid
  YYYY-MM-DD vs invalid/empty → today), `nonNeg` (clamp). (`clean`/`normalizeQuantity` already tested.)
- **Refactor safety:** `tsc --noEmit` + `npm run lint` + `vitest` + `next build` all clean; unchanged
  public action types.
- **Live smoke (controller, Prisma Postgres):** seed a household + user + token + a category + items;
  then via MCP: `list_categories` returns the category id; `create_item` (with categoryId) → item
  created; `edit_item` → fields updated; `set_stock`/`adjust_stock` → stock upserted/clamped;
  `log_price` twice → entries; `list_prices` exposes `entryId`; `edit_price`/`delete_price` by entryId;
  `tag_item attach` then `attach:false` → ItemTag added/removed; `delete_item` → item + its stock/
  prices/tags gone. Cross-household id on each → not-found. Cleanup after.

## Verification

Manual live smoke as above on `PORT=3001 npm run dev` via `curl`/fetch against `/api/mcp` with a seeded
bearer (the 5a/5b-i pattern), then cleanup. Branch stays `next-migration`. This completes the MCP write
surface (Phase 5 minus the deferred OAuth connector + the standing deferrals).
