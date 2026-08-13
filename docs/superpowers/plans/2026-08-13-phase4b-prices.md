# GroceryApp Migration — Phase 4b (Prices) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add price tracking — log a price (price + store + date) for an item, view its price history, and see the cheapest recorded price per item — with a `/prices` page.

**Architecture:** Server actions (`requireHousehold()`-scoped, item ownership verified) for price mutations; pure `cheapestByItem` + `formatPrice` helpers; a `/prices` server page (converts Decimal→number, groups by item, computes cheapest) + `PricesManager` client. Mirrors Phases 2–4a.

**Tech Stack:** Next.js 16, Prisma 6 + Prisma Postgres, better-auth, Tailwind v4, Zod, Vitest — all in place.

## Global Constraints

- Work on branch `next-migration` in `/Users/balanceshayma/Documents/GitHub/GroceryApp`. Never touch `main`.
- Reuse Phase 1/2/3/4a conventions: `requireHousehold()` gates every read/mutation; actions return `{ ok: true } | { ok: false; error: string }`; no unscoped `prisma.priceHistory`.
- **`addPriceEntry` verifies the target item belongs to the household.** `updatePriceEntry`/`deletePriceEntry` scope by `{ id, householdId }` (PriceHistory carries `householdId` directly).
- `price` is a Prisma **`Decimal`**: actions accept a `number`; server pages convert reads via `Number(row.price)` before passing to client components. `price` validated to a finite `> 0` number.
- **Deferred (do NOT implement):** unit-price fields (`quantityAmount`/`quantityUnit` — leave untouched), store-tag auto-create (`ensureStoreTag`), `barcode`/`description` (not in schema). `store` is free text; `currency` stays default `"ILS"`.
- No schema changes. `purchasedAt` is `@db.Date` (date only) — store/read the date portion (`YYYY-MM-DD`).
- i18n: add a `prices` group (+ `catalog.nav.prices`) to BOTH `en.ts` and `he.ts`, identical structure. Client components use module-level `getDictionary("en")` + `t(d, key)` (no `useT()`).
- **Run `npm run lint` (0 errors AND 0 warnings) in every task's verification.** No `useEffect(() => setState(...))`. No non-null assertions where a guard/type-predicate is cleaner.
- `@/*` → `./src/*`. DB provisioned (Phase 1). Tasks 1–4 verify offline; the controller runs the live smoke test.

## File structure (Phase 4b)

```
src/lib/cheapest-price.ts            # pure cheapestByItem()
src/lib/format-price.ts              # pure formatPrice()
src/actions/prices.ts                # addPriceEntry/updatePriceEntry/deletePriceEntry
src/app/(app)/prices/page.tsx        # server: price entries + catalog + group/cheapest
src/components/PricesManager.tsx      # client: log form + per-item cheapest + history edit/delete
src/app/(app)/dashboard/page.tsx     # MODIFY: Prices count card
src/i18n/dictionaries/{en,he}.ts     # MODIFY: add prices i18n + catalog.nav.prices
```

---

### Task 1: cheapestByItem + formatPrice helpers (TDD)

**Files:**
- Create: `src/lib/cheapest-price.ts`, `src/lib/format-price.ts`
- Test: `src/lib/__tests__/cheapest-price.test.ts`, `src/lib/__tests__/format-price.test.ts`

**Interfaces:**
- Produces:
  - `cheapestByItem<T extends { itemId: string; price: number }>(entries: T[]): Map<string, T>` — the min-price entry per itemId (first wins on ties; items absent if no entries).
  - `formatPrice(price: number, currency: string): string` — e.g. `formatPrice(6.9, "ILS") === "₪6.90"`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/__tests__/cheapest-price.test.ts
import { describe, it, expect } from "vitest";
import { cheapestByItem } from "@/lib/cheapest-price";

describe("cheapestByItem", () => {
  it("keeps the min-price entry per item", () => {
    const m = cheapestByItem([
      { itemId: "a", price: 7.5, store: "A" },
      { itemId: "a", price: 6.9, store: "B" },
      { itemId: "b", price: 3, store: "C" },
    ]);
    expect(m.get("a")).toMatchObject({ price: 6.9, store: "B" });
    expect(m.get("b")).toMatchObject({ price: 3 });
    expect(m.size).toBe(2);
  });
  it("first entry wins on a tie", () => {
    const m = cheapestByItem([
      { itemId: "a", price: 5, store: "first" },
      { itemId: "a", price: 5, store: "second" },
    ]);
    expect(m.get("a")).toMatchObject({ store: "first" });
  });
  it("empty → empty map", () => {
    expect(cheapestByItem([]).size).toBe(0);
  });
});
```

```ts
// src/lib/__tests__/format-price.test.ts
import { describe, it, expect } from "vitest";
import { formatPrice } from "@/lib/format-price";

describe("formatPrice", () => {
  it("formats ILS with the shekel symbol + 2 decimals", () => {
    expect(formatPrice(6.9, "ILS")).toBe("₪6.90");
    expect(formatPrice(12, "ILS")).toBe("₪12.00");
  });
  it("USD/EUR symbols", () => {
    expect(formatPrice(3.5, "USD")).toBe("$3.50");
    expect(formatPrice(3.5, "EUR")).toBe("€3.50");
  });
  it("unknown currency → no symbol", () => {
    expect(formatPrice(3.5, "ZZZ")).toBe("3.50");
  });
});
```

- [ ] **Step 2: Run them, verify they fail**

Run: `npx vitest run src/lib/__tests__/cheapest-price.test.ts src/lib/__tests__/format-price.test.ts` — FAIL (modules missing).

- [ ] **Step 3: Implement the helpers**

```ts
// src/lib/cheapest-price.ts
export function cheapestByItem<T extends { itemId: string; price: number }>(
  entries: T[],
): Map<string, T> {
  const map = new Map<string, T>();
  for (const e of entries) {
    const cur = map.get(e.itemId);
    if (!cur || e.price < cur.price) map.set(e.itemId, e);
  }
  return map;
}
```

```ts
// src/lib/format-price.ts
const CURRENCY_SYMBOL: Record<string, string> = { ILS: "₪", USD: "$", EUR: "€" };

export function formatPrice(price: number, currency: string): string {
  const symbol = CURRENCY_SYMBOL[currency] ?? "";
  return `${symbol}${price.toFixed(2)}`;
}
```

- [ ] **Step 4: Run the tests, verify they pass**

Run: `npx vitest run src/lib/__tests__/cheapest-price.test.ts src/lib/__tests__/format-price.test.ts` — PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/cheapest-price.ts src/lib/format-price.ts src/lib/__tests__/cheapest-price.test.ts src/lib/__tests__/format-price.test.ts
git commit -m "feat(phase4b): cheapestByItem + formatPrice helpers"
```

---

### Task 2: Price server actions

**Files:**
- Create: `src/actions/prices.ts`

**Interfaces:**
- Produces (all `Promise<{ ok: true } | { ok: false; error: string }>`, `requireHousehold()`-scoped):
  - `addPriceEntry({ itemId, price, store, purchasedAt })`
  - `updatePriceEntry({ entryId, price, store, purchasedAt })`
  - `deletePriceEntry(entryId)`

- [ ] **Step 1: Implement `src/actions/prices.ts`**

```ts
"use server";

import { prisma } from "@/lib/prisma";
import { requireHousehold } from "@/lib/household-context";
import { getCurrentUser } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";

type Result = { ok: true } | { ok: false; error: string };

function clean(s: string | undefined | null): string | null {
  const v = (s ?? "").trim();
  return v ? v : null;
}

function validPrice(n: number): number | null {
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Parse a YYYY-MM-DD string to a Date; invalid/empty → today.
function parseDate(s: string | undefined): Date {
  if (s) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

async function ownedItem(householdId: string, itemId: string) {
  return prisma.item.findFirst({ where: { id: itemId, householdId }, select: { id: true } });
}

export async function addPriceEntry(input: {
  itemId: string;
  price: number;
  store?: string;
  purchasedAt?: string;
}): Promise<Result> {
  const household = await requireHousehold();
  const user = await getCurrentUser();
  const item = await ownedItem(household.id, input.itemId);
  if (!item) return { ok: false, error: "Item not found" };
  const price = validPrice(input.price);
  if (price === null) return { ok: false, error: "Enter a valid price" };
  await prisma.priceHistory.create({
    data: {
      householdId: household.id,
      itemId: input.itemId,
      price,
      store: clean(input.store),
      purchasedAt: parseDate(input.purchasedAt),
      loggedById: user?.id ?? null,
    },
  });
  revalidatePath("/prices");
  return { ok: true };
}

export async function updatePriceEntry(input: {
  entryId: string;
  price: number;
  store?: string;
  purchasedAt?: string;
}): Promise<Result> {
  const household = await requireHousehold();
  const price = validPrice(input.price);
  if (price === null) return { ok: false, error: "Enter a valid price" };
  const res = await prisma.priceHistory.updateMany({
    where: { id: input.entryId, householdId: household.id },
    data: {
      price,
      store: clean(input.store),
      purchasedAt: parseDate(input.purchasedAt),
    },
  });
  if (res.count === 0) return { ok: false, error: "Price entry not found" };
  revalidatePath("/prices");
  return { ok: true };
}

export async function deletePriceEntry(entryId: string): Promise<Result> {
  const household = await requireHousehold();
  const res = await prisma.priceHistory.deleteMany({
    where: { id: entryId, householdId: household.id },
  });
  if (res.count === 0) return { ok: false, error: "Price entry not found" };
  revalidatePath("/prices");
  return { ok: true };
}
```

- [ ] **Step 2: Typecheck + lint + build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: clean/pass (lint 0/0). (Prisma accepts a `number` for a `Decimal` field on create/update.)

- [ ] **Step 3: Commit**

```bash
git add src/actions/prices.ts
git commit -m "feat(phase4b): price actions (add/update/delete, item + household scoped)"
```

---

### Task 3: `/prices` page + PricesManager UI + i18n

**Files:**
- Create: `src/app/(app)/prices/page.tsx`, `src/components/PricesManager.tsx`
- Modify: `src/i18n/dictionaries/en.ts`, `src/i18n/dictionaries/he.ts`

**Interfaces:**
- Consumes: `cheapestByItem` (`@/lib/cheapest-price`), `formatPrice` (`@/lib/format-price`), price actions (`@/actions/prices`), i18n, `Button`/`Input`.

- [ ] **Step 1: Add the `prices` i18n group + `catalog.nav.prices` (both dictionaries)**

Extend `catalog.nav` with `prices: "Prices"`, and add a top-level `prices` group to `en.ts` (mirror in `he.ts`):

```ts
prices: {
  title: "Prices",
  logPrice: "Log a price",
  chooseItem: "Choose an item",
  price: "Price",
  store: "Store",
  date: "Date",
  save: "Save",
  cancel: "Cancel",
  cheapest: "Cheapest",
  entriesCount: "prices",
  history: "History",
  edit: "Edit",
  remove: "Remove",
  removeConfirm: "Delete this price entry?",
  noStore: "—",
  empty: "No prices logged yet.",
},
```

- [ ] **Step 2: Write `src/app/(app)/prices/page.tsx` (server)**

```tsx
import { prisma } from "@/lib/prisma";
import { requireHousehold } from "@/lib/household-context";
import { cheapestByItem } from "@/lib/cheapest-price";
import { PricesManager } from "@/components/PricesManager";

export const dynamic = "force-dynamic";

export default async function PricesPage() {
  const household = await requireHousehold();
  const [entries, catalogItems] = await Promise.all([
    prisma.priceHistory.findMany({
      where: { householdId: household.id },
      orderBy: [{ purchasedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        itemId: true,
        price: true,
        currency: true,
        store: true,
        purchasedAt: true,
        item: { select: { id: true, name: true, emoji: true } },
      },
    }),
    prisma.item.findMany({
      where: { householdId: household.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true, emoji: true },
    }),
  ]);

  const rows = entries
    .filter((e): e is typeof e & { item: NonNullable<(typeof e)["item"]> } => e.item != null)
    .map((e) => ({
      id: e.id,
      itemId: e.itemId,
      price: Number(e.price),
      currency: e.currency,
      store: e.store,
      purchasedAt: e.purchasedAt.toISOString().slice(0, 10),
      item: { id: e.item.id, name: e.item.name, emoji: e.item.emoji },
    }));

  const cheapest = cheapestByItem(rows);
  const byItem = new Map<string, { item: (typeof rows)[number]["item"]; entries: typeof rows }>();
  for (const r of rows) {
    const g = byItem.get(r.itemId) ?? { item: r.item, entries: [] };
    g.entries.push(r);
    byItem.set(r.itemId, g);
  }
  const pricedItems = [...byItem.values()].map((g) => ({
    item: g.item,
    entries: g.entries,
    cheapest: cheapest.get(g.item.id) ?? null,
  }));

  return <PricesManager pricedItems={pricedItems} catalogItems={catalogItems} />;
}
```

- [ ] **Step 3: Write `src/components/PricesManager.tsx` (client)**

A `"use client"` component modeled on Phase 2/3/4a managers (module-level `getDictionary("en")` + `t`, `Button`/`Input`, `router.refresh()` on success, errors shown, pending-disable, no `useEffect` state-sync). Props:
- `pricedItems: { item: { id, name, emoji }; entries: { id, price, currency, store, purchasedAt }[]; cheapest: { price, currency, store, purchasedAt } | null }[]`
- `catalogItems: { id, name, emoji }[]`

Renders:
1. **Log a price** form (`prices.logPrice`): a `<select>` of `catalogItems`, a price `Input` (type number, step 0.01), a store `Input` (text), a date `Input` (type date, default today) → `addPriceEntry({ itemId, price: Number(price), store, purchasedAt })`; on ok `router.refresh()` + reset; guard empty itemId.
2. A list of `pricedItems`: each row shows `item.emoji item.name` + **Cheapest** (`prices.cheapest`) `formatPrice(cheapest.price, cheapest.currency)` + `cheapest.store ?? prices.noStore` + `cheapest.purchasedAt` + an entry count (`entries.length` + `prices.entriesCount`). Clicking the row expands the **History** (`prices.history`): each entry shows `formatPrice(price, currency)` + store + date, with **Edit** (inline form: price / store / date → `updatePriceEntry({ entryId, price: Number(price), store, purchasedAt })`) and **Remove** (`confirm()` on `prices.removeConfirm` → `deletePriceEntry(entryId)`). Empty state `prices.empty` when `pricedItems` is empty.

Import `formatPrice` from `@/lib/format-price`. Coerce numeric inputs via `Number(...)`; the action validates.

- [ ] **Step 4: Typecheck + tests + lint + build**

Run: `npx tsc --noEmit && npx vitest run src/lib/__tests__/cheapest-price.test.ts src/lib/__tests__/format-price.test.ts && npm run lint && npm run build`
Expected: clean/pass; `/prices` compiles.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/prices" src/components/PricesManager.tsx src/i18n/dictionaries/en.ts src/i18n/dictionaries/he.ts
git commit -m "feat(phase4b): prices page + manager UI + cheapest + i18n"
```

---

### Task 4: Dashboard prices card + verification

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Add a Prices card**

In `src/app/(app)/dashboard/page.tsx`, add — inside the existing `Promise.all` — a price-entries count: `prisma.priceHistory.count({ where: { householdId: household.id } })`. Add a sixth `<Link href="/prices">` card labeled `t(d, "catalog.nav.prices")` with the count, alongside the existing five. Adjust the grid to fit six (e.g. `sm:grid-cols-2 lg:grid-cols-6`, or keep a smaller `lg:grid-cols-3` and let it wrap into two rows — pick whichever looks balanced). Keep everything else intact. `catalog.nav.prices` was added in Task 3.

- [ ] **Step 2: Full offline verification**

Run: `npx tsc --noEmit && npm run test && npm run lint && npm run build`
Expected: all pass (tests: cheapest-price + format-price + prior suites; lint 0/0; build compiles `/prices`, `/dashboard`).

- [ ] **Step 3: Manual smoke test** (controller runs this — dev server + live DB)

Signed-in household with catalog items: `/prices` log ₪7.50 (Store A) and ₪6.90 (Store B) for one item → the item shows **Cheapest ₪6.90 @ Store B**; expand → History shows both (newest first); **Edit** the ₪7.50 entry to ₪7.00; **Delete** one entry; `/dashboard` prices count reflects the total. Confirm logging a price against another household's item id is rejected. Clean up test rows.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/dashboard/page.tsx"
git commit -m "feat(phase4b): dashboard prices card"
```

---

## Self-Review

**Spec coverage:**
- Price add/update/delete, item+household scoped, price validated `>0` → Task 2. ✅
- Cheapest-per-item helper + formatPrice → Task 1. ✅
- Decimal→number at the server boundary → Task 3 page (`Number(e.price)`). ✅
- `/prices` page (log form + per-item cheapest + history edit/delete) → Task 3. ✅
- Dashboard prices card → Task 4. ✅
- i18n en+he parity → Task 3. ✅
- Pure helpers unit-tested → Task 1. ✅
- Deferrals honored (no quantityAmount/quantityUnit/ensureStoreTag/barcode/description) → all tasks. ✅

**Placeholder scan:** Actions + helpers + page code given in full. `PricesManager` (Task 3 Step 3) specifies its sections, props, the exact actions/keys, and the `formatPrice` use, mirroring the Phase-2/3/4a managers. No `TBD`/vague requirements. The page uses a type-predicate filter (no non-null assertion), consistent with the Phase-4a fix.

**Type consistency:** `addPriceEntry({itemId,price,store,purchasedAt})`, `updatePriceEntry({entryId,...})`, `deletePriceEntry(entryId)`, `cheapestByItem(entries)→Map`, `formatPrice(price,currency)`, the `pricedItems` shape (item/entries/cheapest), and the `prices.*` i18n keys are used identically across tasks. `price` is `number` at the app boundary (Decimal only in the DB).

## Setup dependency

None new — DB provisioned in Phase 1. Tasks 1–4 verify offline; the controller runs the live smoke test.
