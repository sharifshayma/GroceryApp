# GroceryApp Migration — Phase 6e (Unit-price fields) design

**Date:** 2026-08-13
**Status:** Design, pending user review
**Depends on:** Phases 1–6d — complete. `PriceHistory.quantityAmount`/`quantityUnit` already in the schema.

## Scope

Let a logged price optionally record **how much you got for that price** — `quantityAmount` + `quantityUnit`
(e.g. "₪6.90 for **1 L**") — and show the derived **unit price** ("₪6.90/L"), so quantities can be compared
across stores/pack-sizes. Wired into the shared price cores, so the web form AND the MCP `log_price`/
`edit_price` tools both gain it, and `list_prices` exposes it. Forward feature (0 rows use it today).

## Decisions

- Both fields **optional** — a price can be just a price. `quantityAmount` accepted only when a finite
  number `> 0` (else stored null); `quantityUnit` trimmed → null if empty.
- **Cheapest stays by total price** (current behavior). Unit price is **informational display only** — no
  automatic unit-price ranking (mixing entries with/without quantities would be inconsistent).
- No schema changes; no change to `markCheapest`.

## Components

### 1. Unit-price helper — `src/lib/unit-price.ts`

Pure `computeUnitPrice(price: number, quantityAmount: number | null | undefined): number | null` — returns
`price / quantityAmount` when `quantityAmount` is a finite number `> 0`, else `null`. Unit-tested.
(Formatting reuses the existing `formatPrice`; the UI renders `formatPrice(unit) + "/" + quantityUnit`.)

### 2. Price cores — `src/lib/mutations/prices.ts`

- `addPriceEntryCore` / `updatePriceEntryCore` inputs gain `quantityAmount?: number | null` and
  `quantityUnit?: string`. In the `data`: `quantityAmount: validAmount(input.quantityAmount)` (a small
  local helper: finite `> 0` → the number, else `null`) and `quantityUnit: clean(input.quantityUnit)`.
  Everything else (price validation, store, purchasedAt, ensureStoreTag) unchanged.

### 3. Actions — `src/actions/prices.ts`

`addPriceEntry` / `updatePriceEntry` input types gain `quantityAmount?: number | null` + `quantityUnit?:
string`, passed straight through to the cores (public return types unchanged).

### 4. UI — `src/components/PricesManager.tsx`

- **Log-price form** + **edit form:** an optional **amount** (number) + **unit** (text) pair next to the
  price (e.g. price `6.90`, amount `1`, unit `L`). Empty amount → not sent (null).
- **Price-history rows / cheapest display:** when an entry has a `quantityAmount`, show the quantity
  (`for {amount} {unit}`) and the **unit price** via `computeUnitPrice` + `formatPrice`
  (`{formatPrice(unit)}/{quantityUnit}`). Entries without a quantity render exactly as today.
- The server page (`/prices`) adds `quantityAmount`/`quantityUnit` to what it reads + passes to the manager
  (the price row/entry types gain the two fields).

### 5. Read tool — `src/lib/mcp-queries.ts` (`listPrices`)

`PriceRow` + `listPrices` output gain `quantityAmount: number | null`, `quantityUnit: string | null`, and
`unitPrice: number | null` (via `computeUnitPrice`). `markCheapest` still keys by `itemId`/total price;
the new fields pass through.

### 6. MCP — `src/app/api/mcp/route.ts`

`log_price` and `edit_price` gain `quantityAmount: z.number().positive().optional()` and `quantityUnit:
z.string().optional()`, passed to the cores. Descriptions note they capture "how much you got for the
price" for unit-price comparison.

## Authorization / integrity rules

- All writes go through the existing `requireHousehold()`-scoped cores (item/entry ownership already
  verified); the new fields add no access surface.
- `quantityAmount` is validated to a finite `> 0` number (else null); `quantityUnit` trimmed. A malformed
  amount never blocks the price write — it just stores null.

## Testing

- **Unit:** `computeUnitPrice` (positive amount → price/amount; 0/negative/NaN/null/undefined → null) and
  the `validAmount` helper if separate.
- **Live smoke (controller):** log a price `₪6.90` amount `1` unit `L` → the row shows "for 1 L" and
  "₪6.90/L"; `list_prices` returns `quantityAmount:1, quantityUnit:"L", unitPrice:6.9`; edit the amount to
  `2` → unit price becomes `₪3.45/L`; a price logged with no amount → no unit-price shown, `unitPrice:null`.
  Via web + MCP.

## Verification

`tsc`/`lint`/`vitest`/`build` clean; live smoke on `PORT=3001 npm run dev` (web + MCP). Branch stays
`next-migration`.
