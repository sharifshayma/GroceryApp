# GroceryApp Migration — Phase 5b-i (MCP list/shopping write tools) design

**Date:** 2026-08-13
**Status:** Design, pending user review
**Depends on:** Phase 5a (MCP foundation + 5 read tools) — complete & pushed.

## Scope

Give the MCP server its first **write** capability: the 4 list/shopping tools —
`add_to_list`, `mark_list_item`, `edit_list_item`, `manage_list` — each scoped to the token's
household, plus the reusable **MCP-write pattern** (tool → shared mutation core, `userId` sourced from
the token) that Phase 5b-ii will repeat for catalog/stock/price/tag writes. To do this without
duplicating validation, this phase **extracts the list + list-item write logic** out of the
session-based server actions into a shared core that both the web actions and the MCP tools call.

## Out of scope (5b-ii / deferred)

The 9 catalog/stock/price/tag write tools (`create_item`, `edit_item`, `delete_item`, `set_stock`,
`adjust_stock`, `log_price`, `edit_price`, `delete_price`, `tag_item`) → **Phase 5b-ii**. Auto-track
stock on mark-bought, `ensureStoreTag`, unit-price fields → **stay deferred** (parity with the app).
**No remove-a-line MCP tool** this phase (removing a whole line is not exposed to MCP; `manage_list`
covers list-level delete). Name-resolution of ids → deferred (tools are ID-based; Claude chains from
the 5a read tools).

## Architecture

### The shared write-core pattern

Every existing write action has the shape: `requireHousehold()` + `getCurrentUser()` (session) →
validate → household-scoped Prisma mutation → `revalidatePath()` → `Result`. Only the session
resolution and `revalidatePath` are web-specific. This phase pulls the middle (validation + mutation,
parameterized by explicit `householdId` and `userId`) into a **core module**, so:

- **Web actions** become thin wrappers: resolve session → call core → `revalidatePath` → return.
  Their **public return types are unchanged** (UI consumers keep working).
- **MCP tools** call the same core directly with the token's `householdId`/`userId`. No
  `revalidatePath` (meaningless for MCP).

This gives **one audited household-ownership boundary** (the `listOwned`/`listItemListId` gates live in
the core, not copied), and makes the core unit-testable.

### MCP-write foundation (route.ts)

The 5a auth verify callback already puts **both** `householdId` and `userId` into the tool context
(`extra.authInfo.extra`). This phase adds a `uid(extra)` helper alongside the existing `hh(extra)`, so
write tools can set `boughtById`/`createdById`. No change to the auth wrapper itself.

## Data model

No schema changes. Uses existing `GroceryList` (status enum `draft|active|completed`, `completedAt`)
and `ListItem` (`quantity Float`, `unit`, `isBought`, `boughtById?`, `boughtAt?`, `notes?`, nullable
`itemId`) from Phase 1.

## Components

### 1. `src/lib/mutations/lists.ts` (new core — no `"use server"`, no `revalidatePath`)

Extracted from `src/actions/lists.ts`, keyed by explicit ids. A shared `clean(s)` helper (trim → null).
- `createListCore(householdId, userId, { name }): { ok: true; id } | { ok: false; error }` — validates non-empty name; creates `status: "draft"`, `createdById: userId`.
- `renameListCore(householdId, { id, name }): Result` — scoped `updateMany` by `{ id, householdId }`; empty name / `count===0` → error.
- `deleteListCore(householdId, { id }): Result` — scoped `deleteMany` (ListItems cascade); `count===0` → error.
- `duplicateListCore(householdId, userId, { id }): { ok: true; id } | { ok: false; error }` — household-scoped source load; copies items into a new `"<name> (copy)"` draft.
- `completeListCore(householdId, userId, { listId, carryOver }): { ok: true; carriedOverListId? } | { ok: false; error }` — household-scoped load; `$transaction`: mark `completed`+`completedAt`, and if `carryOver` and there are unbought items, create a `"<name> (carried over)"` draft with the unbought items.

### 2. `src/lib/mutations/list-items.ts` (new core)

Extracted from `src/actions/list-items.ts`. Ownership helpers `listOwned(householdId, listId)` and
`listItemListId(householdId, listItemId)` move here. A pure `normalizeQuantity(n)` helper
(`Number.isFinite(n) && n > 0 ? n : 1`) is extracted and **unit-tested**.
- `addListItemCore(householdId, { listId, itemId, quantity, unit, notes }): Result` — verifies the list AND the item belong to the household; creates the line (`normalizeQuantity`, `unit` → `clean ?? "pcs"`, `notes` cleaned).
- `updateListItemCore(householdId, { listItemId, quantity, unit, notes }): { ok: true; listId } | { ok: false; error }` — resolves the list-item's `listId` via the household-scoped gate; updates; returns `listId` (the wrapper uses it to revalidate, the tool ignores it).
- `setListItemBoughtCore(householdId, userId, { listItemId, isBought }): { ok: true; listId } | { ok: false; error }` — scoped gate; sets `isBought`, and `boughtById`/`boughtAt` (to `userId`/`now` when marking bought, both null when un-marking).

(`removeListItemCore` is extracted too for parity/wrapper reuse, returning `{ ok: true; listId } | …`, even though no MCP tool exposes it this phase — the web UI's remove-line still needs it.)

### 3. Thin action wrappers — `src/actions/lists.ts` + `src/actions/list-items.ts`

Rewritten to call the cores. Each keeps its **exact current public signature and return type** (so
`ListsManager`/`ListDetail` are untouched): resolve `requireHousehold()` (+ `getCurrentUser()` where
the core needs `userId`), call the core, and on success call the same `revalidatePath(...)` it calls
today (using `input`/the core-returned `listId`), then return the result mapped to the action's
existing public type (dropping any internal `listId`).

### 4. MCP write tools — `src/app/api/mcp/route.ts`

Add a `uid(extra)` helper (mirrors `hh`), then register 4 tools inside `createMcpHandler` (keeping the
5 read tools + the `server.tool()` overload for consistency). Each returns `json(result)`:
- **`add_to_list`** `{ listId, itemId, quantity?, unit?, notes? }` → `addListItemCore(hh, { listId, itemId, quantity: quantity ?? 1, unit: unit ?? "pcs", notes })`. Description: "Add a catalog item to a grocery list. Get listId from get_lists and itemId from search_items."
- **`mark_list_item`** `{ listItemId, bought }` → `setListItemBoughtCore(hh, uid, { listItemId, isBought: bought })`.
- **`edit_list_item`** `{ listItemId, quantity?, unit?, notes? }` → `updateListItemCore(hh, { listItemId, quantity: quantity ?? 1, unit: unit ?? "pcs", notes })`.
- **`manage_list`** `{ action: "create"|"rename"|"complete"|"delete"|"duplicate", name?, listId?, carryOver? }` → dispatches: `create`→`createListCore(hh, uid, { name })`; `rename`→`renameListCore(hh, { id: listId, name })`; `complete`→`completeListCore(hh, uid, { listId, carryOver: carryOver ?? false })`; `delete`→`deleteListCore(hh, { id: listId })`; `duplicate`→`duplicateListCore(hh, uid, { id: listId })`. Validates required params per action (e.g. `create` needs `name`; the others need `listId`), returning `{ ok: false, error }` otherwise. **Destructive** (`delete`) is trusted per the token; the description warns it deletes the list and its items.

## Authorization / integrity rules

- Every core mutation is scoped by `householdId`; the `listOwned`/`listItemListId` gates (now single
  copies) reject cross-household ids with an `{ ok: false, error: "…not found" }` — a token can never
  mutate another household's list or line. `add_to_list` verifies BOTH the list and the item belong to
  the household.
- `userId` for `createdById`/`boughtById` comes only from the token context (`uid(extra)`), never from
  tool input.
- Action wrappers preserve their existing public return types, so the web UI is behaviorally unchanged;
  a regression there would be a spec violation.
- Deleting a list cascades its `ListItem`s (existing FK). No new destructive surface beyond parity.

## Testing

- **Unit:** `normalizeQuantity` (positive → itself; 0/negative/NaN/Infinity → 1). (`clean` is trivial;
  cover if extracted to a shared util.)
- **Refactor safety:** `npx tsc --noEmit && npm run lint && npx vitest run` all clean; a build. The
  action wrappers' public types must not change (tsc across the UI consumers proves it).
- **Live smoke (controller, against Prisma Postgres):** seed a household + user + token + a list + two
  items; then via MCP with the bearer: `add_to_list` (item→list) → line appears; `mark_list_item`
  bought → `isBought`+`boughtById`/`boughtAt` set; `edit_list_item` → quantity/unit/notes updated;
  `manage_list create/rename/duplicate/complete(carryOver)/delete` → each reflected in the DB
  (complete with carryOver spawns a draft with the unbought items; delete cascades lines). Confirm a
  list/line id from another household is rejected. Also confirm the web actions still work (a quick
  action-path check or reliance on unchanged types + a page render).

## Verification

Manual live smoke as above on `PORT=3001 npm run dev`, driven by `curl` against `/api/mcp` with a
seeded bearer (the Phase 5a smoke pattern), then cleanup. The branch stays `next-migration`.
