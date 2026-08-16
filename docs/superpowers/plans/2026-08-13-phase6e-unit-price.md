# GroceryApp Phase 6e — Unit-price Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a logged price optionally carry `quantityAmount` + `quantityUnit` (e.g. "₪6.90 for 1 L") and show the derived unit price, in the web app and MCP.

**Architecture:** A pure `computeUnitPrice` helper + the two price cores/actions gain the optional fields + the `PricesManager` form/display + `list_prices`/MCP `log_price`/`edit_price` gain them. No schema changes.

**Tech Stack:** Next.js 16, Prisma 6, Zod 4, Vitest 4, TypeScript.

## Global Constraints

- Branch `next-migration`, never `main`. Personal git identity (`sharifshayma`). Never commit `.env`.
- Lint is **`npm run lint`**. No schema changes (`PriceHistory.quantityAmount Float?`, `quantityUnit String?` exist). Cores stay under `src/lib/mutations/` (no `"use server"`/`revalidatePath`); action wrappers keep public return types; MCP reuses `hh(extra)`/`uid(extra)`/`json`.
- Both fields optional: `quantityAmount` stored only when a finite number `> 0` (else null); `quantityUnit` trimmed → null. A malformed amount never blocks the price write.
- **`markCheapest`/`cheapestByItem` UNCHANGED** — cheapest stays by total price; unit price is display-only.
- i18n `he: typeof en` parity for new keys. `Result = { ok: true } | { ok: false; error: string }`.

---

## File Structure

- `src/lib/unit-price.ts` (+ test) — `computeUnitPrice` (Task 1).
- `src/lib/mutations/prices.ts` — cores gain the fields + `validAmount` (Task 1).
- `src/actions/prices.ts` — action input types (Task 1).
- `src/app/(app)/prices/page.tsx`, `src/components/PricesManager.tsx`, `src/i18n/dictionaries/{en,he}.ts` — UI (Task 2).
- `src/lib/mcp-queries.ts`, `src/app/api/mcp/route.ts` — read tool + MCP (Task 3).

---

## Task 1: `computeUnitPrice` + cores + actions

**Files:** Create `src/lib/unit-price.ts`, `src/lib/unit-price.test.ts`; Modify `src/lib/mutations/prices.ts`, `src/actions/prices.ts`.

**Interfaces — Produces:** `computeUnitPrice(price, quantityAmount): number | null`; cores/actions accept `quantityAmount?: number | null` + `quantityUnit?: string`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/unit-price.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeUnitPrice } from "./unit-price";

describe("computeUnitPrice", () => {
  it("price / amount for a positive amount", () => {
    expect(computeUnitPrice(6.9, 1)).toBeCloseTo(6.9);
    expect(computeUnitPrice(6.9, 2)).toBeCloseTo(3.45);
  });
  it("null for 0 / negative / NaN amount", () => {
    expect(computeUnitPrice(6.9, 0)).toBeNull();
    expect(computeUnitPrice(6.9, -1)).toBeNull();
    expect(computeUnitPrice(6.9, Number.NaN)).toBeNull();
  });
  it("null when amount is null/undefined", () => {
    expect(computeUnitPrice(6.9, null)).toBeNull();
    expect(computeUnitPrice(6.9, undefined)).toBeNull();
  });
  it("null for a non-finite price", () => {
    expect(computeUnitPrice(Number.NaN, 1)).toBeNull();
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npx vitest run src/lib/unit-price.test.ts`
Expected: FAIL (cannot resolve `./unit-price`).

- [ ] **Step 3: Write the helper**

Create `src/lib/unit-price.ts`:

```ts
export function computeUnitPrice(
  price: number,
  quantityAmount: number | null | undefined,
): number | null {
  if (quantityAmount == null || !Number.isFinite(quantityAmount) || quantityAmount <= 0) return null;
  if (!Number.isFinite(price)) return null;
  return price / quantityAmount;
}
```

- [ ] **Step 4: Run → pass**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npx vitest run src/lib/unit-price.test.ts`
Expected: PASS.

- [ ] **Step 5: Cores accept the fields**

In `src/lib/mutations/prices.ts`, add a local helper near `validPrice`:

```ts
function validAmount(n: number | null | undefined): number | null {
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;
}
```

- `addPriceEntryCore` input type → add `quantityAmount?: number | null; quantityUnit?: string`. In its `create` `data`, add:
  ```ts
  quantityAmount: validAmount(input.quantityAmount),
  quantityUnit: clean(input.quantityUnit),
  ```
- `updatePriceEntryCore` input type → add the same two fields. In its `updateMany` `data`, add the same two lines.

(Everything else — price validation, store, purchasedAt, ensureStoreTag — unchanged.)

- [ ] **Step 6: Actions accept the fields**

In `src/actions/prices.ts`, add `quantityAmount?: number | null; quantityUnit?: string;` to BOTH the `addPriceEntry` and `updatePriceEntry` input types. (The wrappers already pass `input` whole into the cores — no body change.)

- [ ] **Step 7: Verify + commit**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npx vitest run src/lib/unit-price.test.ts && npx tsc --noEmit && npm run lint`
Expected: test PASS; no type/lint errors.

```bash
cd /Users/balanceshayma/Documents/GitHub/GroceryApp
git add src/lib/unit-price.ts src/lib/unit-price.test.ts src/lib/mutations/prices.ts src/actions/prices.ts
git commit -m "feat(prices): unit-price fields (quantityAmount/quantityUnit) in cores + actions"
```

---

## Task 2: Price form + unit-price display

**Files:** Modify `src/app/(app)/prices/page.tsx`, `src/components/PricesManager.tsx`, `src/i18n/dictionaries/{en,he}.ts`.

**Interfaces — Consumes:** `computeUnitPrice` (Task 1), `formatPrice`.

- [ ] **Step 1: Page fetch**

In `src/app/(app)/prices/page.tsx`:
- Add `quantityAmount: true,` and `quantityUnit: true,` to the `priceHistory.findMany` `select`.
- In the `.map((e) => ({ ... }))` that builds `rows`, add `quantityAmount: e.quantityAmount,` and `quantityUnit: e.quantityUnit,`.

- [ ] **Step 2: PricesManager — types + state + handlers**

In `src/components/PricesManager.tsx`:
- Add `import { computeUnitPrice } from "@/lib/unit-price";`
- `PriceEntryRow` gains: `quantityAmount: number | null; quantityUnit: string | null;`
- Add-form state: `const [addAmount, setAddAmount] = useState(""); const [addUnit, setAddUnit] = useState("");`
- Edit-form state: `const [editAmount, setEditAmount] = useState(""); const [editUnit, setEditUnit] = useState("");`
- In `handleAdd`, extend the `addPriceEntry({...})` call with:
  ```ts
  quantityAmount: addAmount.trim() ? Number(addAmount) : null,
  quantityUnit: addUnit,
  ```
  and on success reset: `setAddAmount(""); setAddUnit("");`
- In `startEdit(entry)`, add: `setEditAmount(entry.quantityAmount != null ? String(entry.quantityAmount) : ""); setEditUnit(entry.quantityUnit ?? "");`
- In `handleSaveEdit`, extend the `updatePriceEntry({...})` call with:
  ```ts
  quantityAmount: editAmount.trim() ? Number(editAmount) : null,
  quantityUnit: editUnit,
  ```

- [ ] **Step 3: PricesManager — form inputs**

Add an amount + unit input pair to BOTH the log-price form and the inline edit form, next to the price/store inputs, following the existing `Input` pattern:

```tsx
{/* log form — near the price/store Inputs */}
<Input
  type="number"
  step="any"
  min="0"
  placeholder={t(d, "prices.amountPlaceholder")}
  value={addAmount}
  onChange={(e) => setAddAmount(e.target.value)}
/>
<Input
  type="text"
  placeholder={t(d, "prices.unitPlaceholder")}
  value={addUnit}
  onChange={(e) => setAddUnit(e.target.value)}
/>
```

The edit form gets the same pair bound to `editAmount`/`editUnit`.

- [ ] **Step 4: PricesManager — display the quantity + unit price**

In the price-history entry render (each `entry`) and the cheapest display, when `entry.quantityAmount != null`, show the quantity and the unit price. Add near where the entry's price/store/date render:

```tsx
{entry.quantityAmount != null && (
  <span className="text-sm text-ink/60">
    {" · "}
    {t(d, "prices.forQuantity", {
      amount: String(entry.quantityAmount),
      unit: entry.quantityUnit ?? "",
    })}
    {(() => {
      const u = computeUnitPrice(entry.price, entry.quantityAmount);
      return u != null
        ? ` (${formatPrice(u, entry.currency)}/${entry.quantityUnit ?? ""})`
        : "";
    })()}
  </span>
)}
```

(Follow the surrounding markup; the exact element/placement mirrors how store/date currently render for an entry.)

- [ ] **Step 5: i18n**

Add to the `prices` group in BOTH dictionaries:
- `en.ts`: `amountPlaceholder: "Amount", unitPlaceholder: "Unit (e.g. L, kg)", forQuantity: "for {amount} {unit}",`
- `he.ts`: `amountPlaceholder: "כמות", unitPlaceholder: "יחידה (למשל L, ק\"ג)", forQuantity: "עבור {amount} {unit}",`

- [ ] **Step 6: Verify + commit**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npx tsc --noEmit && npm run lint && npx next build`
Expected: clean; builds.

```bash
cd /Users/balanceshayma/Documents/GitHub/GroceryApp
git add src/app/\(app\)/prices/page.tsx src/components/PricesManager.tsx src/i18n/dictionaries/en.ts src/i18n/dictionaries/he.ts
git commit -m "feat(prices): unit-price form fields + per-entry unit-price display"
```

---

## Task 3: Read tool + MCP params

**Files:** Modify `src/lib/mcp-queries.ts`, `src/app/api/mcp/route.ts`.

**Interfaces — Consumes:** `computeUnitPrice` (Task 1), the extended cores (Task 1).

- [ ] **Step 1: `listPrices` exposes the fields**

In `src/lib/mcp-queries.ts`:
- Add `import { computeUnitPrice } from "@/lib/unit-price";`
- `PriceRow` type gains: `quantityAmount: number | null; quantityUnit: string | null; unitPrice: number | null;`
- In `listPrices`, add `quantityAmount: true, quantityUnit: true,` to the `select`, and in the `rows` map add:
  ```ts
  quantityAmount: e.quantityAmount,
  quantityUnit: e.quantityUnit,
  unitPrice: computeUnitPrice(Number(e.price), e.quantityAmount),
  ```
  (`markCheapest` still keys by `itemId`/total price — the new fields pass through untouched.)

- [ ] **Step 2: MCP `log_price` / `edit_price`**

In `src/app/api/mcp/route.ts`:
- **`log_price`** — add `quantityAmount: z.number().positive().optional(), quantityUnit: z.string().optional()` to the schema; pass `quantityAmount`, `quantityUnit` in the `addPriceEntryCore(...)` input. Extend the description to note they capture "how much you got for the price" (for unit-price comparison).
- **`edit_price`** — same two params added to the schema + passed to `updatePriceEntryCore(...)`.

- [ ] **Step 3: Verify + commit**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npx tsc --noEmit && npm run lint && npx vitest run`
Expected: clean; the `markCheapest` test still passes (the added `PriceRow` fields are optional-shaped in the test rows OR — if `tsc` flags the test — add `quantityAmount: null, quantityUnit: null, unitPrice: null` to each `markCheapest` test row).

> **Note:** if adding fields to `PriceRow` makes `src/lib/mcp-queries.test.ts`'s `markCheapest` rows fail typecheck, add `quantityAmount: null, quantityUnit: null, unitPrice: null` to each row there (the test asserts on `cheapest`, not these).

```bash
cd /Users/balanceshayma/Documents/GitHub/GroceryApp
git add src/lib/mcp-queries.ts src/lib/mcp-queries.test.ts src/app/api/mcp/route.ts
git commit -m "feat(mcp): list_prices exposes unit-price; log_price/edit_price accept quantityAmount/quantityUnit"
```

---

## Verification (controller-run — needs the live DB)

- [ ] **1. Offline gate:** `npx tsc --noEmit && npm run lint && npx vitest run && npx next build` all clean.

- [ ] **2. Live smoke** (`PORT=3001 npm run dev`, seeded household + token):
  - **MCP:** `log_price { itemId, price: 6.9, store: "A", quantityAmount: 1, quantityUnit: "L" }` → ok; `list_prices` returns `quantityAmount: 1, quantityUnit: "L", unitPrice: 6.9`; `edit_price { entryId, price: 6.9, quantityAmount: 2, quantityUnit: "L" }` → `list_prices` now `unitPrice: 3.45`; a `log_price` with no amount → `quantityAmount: null, unitPrice: null`.
  - **Web:** the prices page shows "for 1 L (₪6.90/L)" on the entry; editing amount → recomputed; an amount-less entry shows no unit price. Cheapest still ranks by total price.
  - Clean up seeded rows.

- [ ] **3. Final whole-branch review** (most capable model) over the Phase 6e range; then push `next-migration`.

---

## Self-Review

**Spec coverage:** `computeUnitPrice` (TDD) ✓ (Task 1); cores/actions gain optional `quantityAmount`(validated `>0` else null)/`quantityUnit`(cleaned) ✓ (Task 1); form fields + per-entry quantity + unit-price display + i18n ✓ (Task 2); page fetch of the two fields ✓ (Task 2); `list_prices` exposes `quantityAmount`/`quantityUnit`/`unitPrice` ✓ (Task 3); MCP `log_price`/`edit_price` params ✓ (Task 3); cheapest unchanged (by total price) ✓; unit test ✓; live smoke web + MCP ✓.

**Placeholder scan:** No TBD/TODO. Task 2 Step 4's IIFE for the unit-price string is concrete; the "follow surrounding markup" note is a placement instruction for a large existing component (as in the ItemManager edits in Phase 6c), not a gap. The `markCheapest` test note is a concrete conditional fix.

**Type consistency:** `computeUnitPrice(price, quantityAmount)` used identically in `PricesManager`, `listPrices`. `quantityAmount?: number | null` / `quantityUnit?: string` threaded consistently core→action→form/MCP. `PriceEntryRow`/`PriceRow` field additions match the page `select`/`listPrices` map. `validAmount` mirrors the existing `validPrice` pattern. i18n keys added to both dicts.
