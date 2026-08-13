# GroceryApp Migration — Phase 4b (Prices) design

**Date:** 2026-08-13
**Status:** Design, pending user review
**Depends on:** Phase 1 + Phase 2 + Phase 3 + Phase 4a (stock) — complete & verified.

## Scope

Price tracking: log what you paid for an item (price + store + date), view an item's price history,
and see the **cheapest** recorded price per item. Ports the Vite app's price functions
(`fetchPriceHistory`, `addPriceEntry`, `updatePriceEntry`, `deletePriceEntry`, `fetchCheapestPrices`).
This completes the catalog subsystems (Phase 4 / the "off-Supabase feature parity" work minus the
deferred integrations).

## Decisions & deferrals

- **Log price = price + store + date.** The optional **unit-price fields** (`quantityAmount` /
  `quantityUnit`, e.g. "₪6.90 for 1 L") are **deferred** — they stay in the schema, unused, for a
  later unit-price slice.
- **Auto-create-a-store-tag** (`ensureStoreTag`: logging a price at a new store auto-creating a
  `store` tag for autocomplete) is **deferred** — `store` is a free-text field this phase; the
  price↔tag link comes later.
- **`barcode` / `description`** exist in the original Supabase `price_history` but were **not carried
  into the Phase-1 Prisma schema**. Not added here; if the original values must be preserved, that's
  a small schema addition handled at **data migration (Phase 6)** — flagged there.

## Data model

Table already exists from Phase 1 — no schema changes:
- **PriceHistory**: `id, itemId, householdId, price (Decimal), currency (default "ILS"), store?,
  quantityAmount (Float?), quantityUnit?, purchasedAt (Date), loggedById?, createdAt`. FKs
  `PriceHistory.item`/`PriceHistory.household` are `onDelete: Cascade`.
- Phase 4b sets `itemId, householdId, price, store?, purchasedAt, loggedById` (currency stays
  default "ILS"; `quantityAmount`/`quantityUnit` untouched).

**Decimal:** `price` is a Prisma `Decimal`. Server pages convert it to a plain `number` (`Number(...)`)
before passing to client components (a `Decimal` can't cross the RSC boundary cleanly). Actions
accept `price` as a `number`.

## Components

### 1. Price server actions — `src/actions/prices.ts`

All `"use server"`, `requireHousehold()`-scoped, returning `{ ok: true } | { ok: false; error: string }`.
- `addPriceEntry({ itemId, price, store, purchasedAt })` — verify the **item** belongs to the
  household; `price` must be a finite number `> 0` (else error); `store` trimmed → null if empty;
  `purchasedAt` is a date (default today); sets `householdId` + `loggedById`.
- `updatePriceEntry({ entryId, price, store, purchasedAt })` — scoped `updateMany` by `{ id: entryId,
  householdId }` (PriceHistory carries `householdId` directly), `count===0` → not found; same
  validation/trim.
- `deletePriceEntry(entryId)` — scoped `deleteMany` by `{ id, householdId }`.

### 2. Cheapest helper — `src/lib/cheapest-price.ts`

Pure `cheapestByItem(entries: { itemId: string; price: number; store: string | null; purchasedAt:
string | Date }[]): Map<string, { price, store, purchasedAt }>` — the min-price entry per item
(items with no entries absent). Unit-tested.

### 3. `/prices` page + `PricesManager`

- **Server page** (`requireHousehold()`-scoped): reads the household's price entries (with each item's
  `name/emoji`) and the catalog items (for the log-price picker). Converts each `price` to a number.
  Groups entries by item and computes cheapest via the helper; passes to `PricesManager`.
- **`PricesManager`** (client):
  - A **"Log a price"** form: a `<select>` of catalog items, a price input (number), a store input
    (text), a date input (default today) → `addPriceEntry`. On ok `router.refresh()` + reset.
  - A list of **items with prices**: each row shows `emoji name` + the **cheapest** price (with its
    store + date) + an entry count, and expands to the item's full **history** (newest first). Each
    history entry shows price + store + date with **Edit** (inline: price/store/date →
    `updatePriceEntry`) and **Delete** (`confirm()` → `deletePriceEntry`). Empty state when no prices.
  - Client conventions match Phase 2/3/4a (`getDictionary("en")` + `t`, `Button`/`Input`,
    `router.refresh()` on success, errors shown, pending-disable, no `useEffect` state-sync).
  - Money is shown via a small `formatPrice(price, currency)` (e.g. `₪6.90`) — a tiny formatter used
    consistently.

### 4. Dashboard + i18n

- Dashboard gains a **Prices** nav card (count of price entries, or items priced), linking to
  `/prices`. Grid widened to fit six (or wraps).
- Add a `prices` i18n group (+ `catalog.nav.prices`) to both `en.ts` and `he.ts`, identical structure.

## Authorization / integrity rules

- Every price read/mutation scoped by `requireHousehold()`; no unscoped `prisma.priceHistory`.
- `addPriceEntry` verifies the **item** belongs to the household (a price can never be logged against
  a foreign item). `updatePriceEntry`/`deletePriceEntry` scope by `{ id, householdId }` directly
  (PriceHistory has `householdId`).
- `price` validated to a finite `> 0` number. Deleting a catalog item cascades its price entries (FK).

## Testing

- Unit-test `cheapestByItem` (single item multiple entries → min; multiple items; ties; empty) and a
  `formatPrice` helper if extracted (currency symbol, 2 decimals).
- Actions verified by build/typecheck + lint + the manual smoke test: log two prices for an item at
  different stores → the cheaper shows as "cheapest"; view history; edit a price; delete one; scoping
  holds. Against the live Prisma Postgres.

## Verification

Manual smoke test on `npm run dev`: `/prices` log ₪7.50 (Store A) and ₪6.90 (Store B) for Milk →
Milk shows cheapest ₪6.90 @ Store B; expand history shows both (newest first); edit the ₪7.50 entry
to ₪7.00; delete one entry; `/dashboard` prices count reflects it. Confirm logging a price against
another household's item id is rejected.
