# GroceryApp Migration — Phase 4a (Stock) design

**Date:** 2026-08-13
**Status:** Design, pending user review
**Depends on:** Phase 1 + Phase 2 + Phase 3 (lists + shopping) — complete & verified.

## Scope

Home-stock tracking: record how much of an item you have on hand (quantity + unit + low
threshold), adjust it, and see a **"Need to buy"** view combining low-stock items with unbought
items on open lists. Ports the Vite app's `Stock` page + `lib/grocery.js` stock/need-to-buy
functions. **Prices are Phase 4b.**

## Out of scope (later phases / 4b)

Auto-track (marking a list item bought auto-incrementing its stock via `item.autoTrackStock` +
`ListItem.stockUpdated`) — **deferred to a later slice**; the `stockUpdated` flag and
`item.autoTrackStock` are left untouched. Prices (Phase 4b), MCP (Phase 5).

## Data model

Tables already exist from Phase 1 — no schema changes:
- **Stock**: `id, householdId, itemId, quantity (Float, default 0), unit (default "pcs"),
  lowThreshold (Float, default 1), updatedAt, updatedById?`, with `@@unique([householdId, itemId])`.
  FKs `Stock.item`/`Stock.household` are `onDelete: Cascade`.
- **Item.autoTrackStock** exists but is NOT read/written this phase.

**Low stock** is defined as `quantity <= lowThreshold`. An item is "tracked" iff it has a `Stock` row.

## Components

### 1. Stock server actions — `src/actions/stock.ts`

All `"use server"`, `requireHousehold()`-scoped, item ownership verified, returning
`{ ok: true } | { ok: false; error: string }`. A shared helper verifies the item belongs to the
household before any write.
- `setStock({ itemId, quantity, unit, lowThreshold })` — **upsert** the `Stock` row for
  `(householdId, itemId)` (create or update); clamps `quantity`/`lowThreshold` to `>= 0`; sets
  `updatedById`. Used both to start tracking an item and to edit its stock.
- `adjustStock({ itemId, delta })` — add `delta` (may be negative) to the item's stock, clamped at
  `0`; if no `Stock` row exists, create one starting at `max(0, delta)` (unit defaults to the item's
  `defaultUnit`, threshold 1). Sets `updatedById`.
- `removeStock(itemId)` — delete the item's `Stock` row (stop tracking).

### 2. Need-to-buy — pure helper + server read

- Pure `computeNeedToBuy({ lowStock, onList })` in `src/lib/need-to-buy.ts` — given the household's
  low-stock items (from `Stock` rows where `quantity <= lowThreshold`) and the items on open lists
  that are still unbought, produce a deduped list of `{ item, reason: "low_stock" | "on_list" |
  "both", onLists: {listName, quantity}[], stock: {quantity, lowThreshold} | null }`, plus
  `{ lowCount, onListCount }`. Unit-tested.
- The `/stock` server page reads the stock rows + open-list unbought items and feeds the helper.

### 3. `/stock` page + `StockManager`

- **Server page** (`requireHousehold()`-scoped): reads the household's `Stock` rows (with each item's
  `name/emoji/defaultUnit`), the catalog items (for the "add to stock" picker), and the open-list
  unbought items; computes need-to-buy via the helper; passes everything to `StockManager`.
- **`StockManager`** (client):
  - A **"Need to buy"** panel: the computed entries (item + reason badge: low stock / on a list /
    both; showing which lists + the low-stock numbers). Empty state when nothing is needed.
  - The **tracked stock list**: each item shows quantity + unit (+ a **Low** badge when
    `quantity <= lowThreshold`), with **−/＋ adjust** buttons (`adjustStock({ itemId, delta: ±1 })`),
    an **Edit** inline form (set quantity, unit, low threshold → `setStock`), and **Remove**
    (`removeStock`). Empty state when nothing is tracked.
  - An **Add to stock** form: a `<select>` of catalog items **not yet tracked**, an initial quantity,
    unit (prefill from the item's `defaultUnit`), and low threshold → `setStock`.
  - Client conventions match Phase 2/3 (`getDictionary("en")` + `t`, `Button`/`Input`,
    `router.refresh()` on success, errors shown, pending-disable).

### 4. Dashboard + i18n

- Dashboard gains a **low-stock count** card (count of `Stock` rows where `quantity <= lowThreshold`),
  linking to `/stock`. (A Prisma count can't express `quantity <= lowThreshold` directly; compute it
  from the fetched rows or a small `$queryRaw` — the plan will pick the simplest correct approach.)
- Add a `stock` i18n group (+ `catalog.nav.stock`) to both `en.ts` and `he.ts`, identical structure.

## Authorization / integrity rules

- Every stock read/mutation scoped by `requireHousehold()`; no unscoped `prisma.stock`.
- Every stock write verifies the target **item** belongs to the household (an item's stock can never
  be set for another household's item).
- `setStock` upserts on the `@@unique([householdId, itemId])` key (idempotent per item).
- Quantities/thresholds are clamped to `>= 0`. Deleting a catalog item cascades its stock row (FK).

## Testing

- Unit-test the pure pieces: `isLowStock(quantity, lowThreshold)` (boundary: equal → low) and
  `computeNeedToBuy` (low only, on-list only, both, dedup, empty).
- Actions verified by build/typecheck + lint + the manual smoke test: set an item's stock; adjust
  −/＋ (clamps at 0); low badge appears at/below threshold; the item shows in Need-to-buy; put an
  item on an open list (unbought) → it appears in Need-to-buy as on_list; remove stock; scoping holds.
  Against the live Prisma Postgres.

## Verification

Manual smoke test on `npm run dev`: `/stock` add an item to stock (qty 3, threshold 1) → shows
tracked; adjust down to 1 → **Low** badge + appears in **Need to buy** (low_stock); add the same item
to an open list unbought → Need-to-buy shows reason "both"; adjust back up → leaves low; remove
stock; `/dashboard` low-stock count reflects it. Confirm cross-household stock writes are rejected.
