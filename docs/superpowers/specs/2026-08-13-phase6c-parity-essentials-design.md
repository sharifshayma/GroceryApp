# GroceryApp Migration — Phase 6c (Parity essentials) design

**Date:** 2026-08-13
**Status:** Design, pending user review
**Depends on:** Phases 1–6b — complete. Uses the shared write-cores from Phase 5b.

## Scope

Restore three behaviors the old Vite app had that were deferred during the rebuild, wiring each into the
**shared mutation cores** (`src/lib/mutations/*`) so both the web app AND the MCP tools gain them:

1. **Auto-track stock** — marking a list line bought increments the item's on-hand stock (and un-marking
   reverses it), gated by the item's `autoTrackStock` flag + the line's `stockUpdated` guard.
2. **Item-tag notes** — a per-assignment note on `ItemTag` (16 of the migrated household's links already
   carry one), editable in the UI and settable over MCP.
3. **ensureStoreTag** — logging a price at a store name with no matching `store`-type tag auto-creates one.

## Out of scope

Item photos (Phase 6d), unit-price fields (6e), MCP OAuth (6f). No schema changes — `autoTrackStock`,
`ListItem.stockUpdated`, `ItemTag.notes`, and the `Tag`/`store` type all already exist.

## Components

### 1. Auto-track stock

**Pure helper** `src/lib/auto-track.ts` — `computeAutoTrack({ isBought, autoTrackStock, stockUpdated,
quantity }): { stockDelta: number | null; stockUpdated: boolean }`:
- marking bought (`isBought` true) & `autoTrackStock` & not already `stockUpdated` → `{ stockDelta: +quantity, stockUpdated: true }`
- un-marking (`isBought` false) & currently `stockUpdated` → `{ stockDelta: -quantity, stockUpdated: false }`
- otherwise → `{ stockDelta: null, stockUpdated: <unchanged> }` (no stock change)
Unit-tested (both directions, the `autoTrackStock=false` no-op, the double-mark guard).

**`setListItemBoughtCore`** (`mutations/list-items.ts`) — extended: load the line's `itemId`, `quantity`,
`stockUpdated`, and the item's `autoTrackStock`; call `computeAutoTrack`; in a `$transaction`, update the
line (`isBought`/`boughtById`/`boughtAt` **and** the new `stockUpdated`), and when `stockDelta != null`
**upsert** the item's `Stock` row by `(householdId,itemId)` — `quantity = max(0, existing + stockDelta)`
(create at `max(0, stockDelta)`, unit from the item's `defaultUnit`, `lowThreshold` 1 — mirroring
`adjustStockCore`). No-op when `itemId` is null. MCP `mark_list_item` inherits this (it calls the core).

**Item `autoTrackStock` toggle** — `createItemCore`/`updateItemCore` gain an optional `autoTrackStock?:
boolean` (write it when provided; else leave the schema default `true`). The item form (`ItemManager`)
gets a checkbox ("Auto-update stock when bought", default on). MCP `create_item`/`edit_item` gain an
optional `autoTrackStock` param.

### 2. Item-tag notes

**`assignTagCore`** (`mutations/tags.ts`) — signature gains `note?: string`; the `upsert` sets
`notes: clean(note)` on BOTH `create` and `update` (so re-assigning an already-linked tag updates its
note without un/re-toggling). Ownership gate unchanged.

**`ItemTagPicker`** — for each **assigned** tag, render a small inline note input (prefilled from the
existing note); saving calls `assignTag({ itemId, tagId, note })`. The picker already receives assigned
tag ids; it additionally receives each assigned tag's current `notes` (server page passes them). Toggling
a tag off still unassigns (dropping the note).

**MCP `tag_item`** — gains an optional `notes` param passed to `assignTagCore` (only meaningful on attach).

### 3. ensureStoreTag

**Helper** `ensureStoreTag(householdId, store)` (in `mutations/tags.ts`): if `store` is non-empty and no
`Tag` with `{ householdId, name: store, type: "store" }` exists, create it; idempotent (find-then-create).

**`addPriceEntryCore`** (and `updatePriceEntryCore` for parity) — after the price write, call
`ensureStoreTag(householdId, clean(store))`. MCP `log_price`/`edit_price` inherit it. A failure to create
the tag must not fail the price write (best-effort, wrapped).

## Authorization / integrity rules

- All three land in cores already scoped by `householdId`; no new unscoped access. Auto-track upserts stock
  only for the line's own household+item; `ensureStoreTag` creates a tag only in the price's household.
- Auto-track is **idempotent per line** via `stockUpdated` — marking bought twice can't double-count;
  un-marking only refunds if it was counted. Quantities clamp at 0.
- Item-tag note writes go through the existing `bothOwned` gate.

## Testing

- **Unit:** `computeAutoTrack` (mark→+qty; unmark→−qty; autoTrackStock=false→no-op; already-stockUpdated
  mark→no-op; already-not mark→applies). `ensureStoreTag`'s decision is DB-bound (covered by smoke).
- **Live smoke (controller):** on a seeded household — mark a list line bought → the item's stock rises by
  the line quantity and `stockUpdated` flips; un-mark → stock falls back; toggling an item's
  `autoTrackStock` off → marking bought no longer moves stock. Log a price with a new store name → a
  `store` tag appears (logging again at the same store → no duplicate). Assign a tag with a note via the
  UI and via MCP `tag_item` → the note persists and shows. Confirm the migrated 16 item-tag notes render.

## Verification

Manual live smoke as above on `PORT=3001 npm run dev` (web + a `curl`/fetch MCP pass), plus
`tsc`/`lint`/`vitest`/`build`. Branch stays `next-migration`.
