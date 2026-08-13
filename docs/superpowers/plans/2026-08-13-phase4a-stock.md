# GroceryApp Migration — Phase 4a (Stock) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add home-stock tracking — set/adjust an item's on-hand quantity + low threshold — with a `/stock` page and a "Need to buy" view combining low-stock items with unbought items on open lists.

**Architecture:** Server actions (`requireHousehold()`-scoped, item ownership verified) for stock mutations; a pure `computeNeedToBuy` helper; a `/stock` server page + `StockManager` client. Mirrors Phases 2/3.

**Tech Stack:** Next.js 16, Prisma 6 + Prisma Postgres, better-auth, Tailwind v4, Zod, Vitest — all in place.

## Global Constraints

- Work on branch `next-migration` in `/Users/balanceshayma/Documents/GitHub/GroceryApp`. Never touch `main`.
- Reuse Phase 1/2/3 conventions: `requireHousehold()` gates every read/mutation; actions return `{ ok: true } | { ok: false; error: string }`; no unscoped `prisma.stock`.
- **Every stock write verifies the target item belongs to the household** (an item's stock can never be set for a foreign item).
- `setStock` upserts on the `Stock` `@@unique([householdId, itemId])` key (compound key `householdId_itemId`). Quantities/thresholds clamp to `>= 0`. Low stock = `quantity <= lowThreshold`.
- **Auto-track is OUT of scope**: never read/write `item.autoTrackStock` or `ListItem.stockUpdated`.
- No schema changes. `quantity`/`lowThreshold` are `Float`.
- i18n: add a `stock` group (+ `catalog.nav.stock`) to BOTH `en.ts` and `he.ts`, identical structure. Client components use module-level `getDictionary("en")` + `t(d, key)` (Phase 2/3 pattern — no `useT()`).
- **Run `npm run lint` (0 errors AND 0 warnings) in every task's verification.** No `useEffect(() => setState(...))` (react-hooks/set-state-in-effect). No non-null assertions where a guard is cleaner.
- `@/*` → `./src/*`. DB provisioned (Phase 1). Tasks 1–4 verify offline; the controller runs the live smoke test.

## File structure (Phase 4a)

```
src/lib/need-to-buy.ts               # pure isLowStock() + computeNeedToBuy()
src/actions/stock.ts                 # setStock/adjustStock/removeStock
src/app/(app)/stock/page.tsx         # server: stock rows + catalog + open-list items + need-to-buy
src/components/StockManager.tsx      # client: need-to-buy panel + tracked list + add-to-stock
src/app/(app)/dashboard/page.tsx     # MODIFY: low-stock count card
src/i18n/dictionaries/{en,he}.ts     # MODIFY: add stock i18n + catalog.nav.stock
```

---

### Task 1: need-to-buy helpers (TDD)

**Files:**
- Create: `src/lib/need-to-buy.ts`
- Test: `src/lib/__tests__/need-to-buy.test.ts`

**Interfaces:**
- Produces:
  - `isLowStock(quantity: number, lowThreshold: number): boolean` (`quantity <= lowThreshold`).
  - `computeNeedToBuy(input): { entries: NeedEntry[]; lowCount: number; onListCount: number }` with the types below.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/__tests__/need-to-buy.test.ts
import { describe, it, expect } from "vitest";
import { isLowStock, computeNeedToBuy } from "@/lib/need-to-buy";

const milk = { id: "m", name: "Milk", emoji: "🥛" };
const eggs = { id: "e", name: "Eggs", emoji: "🥚" };

describe("isLowStock", () => {
  it("is true at or below threshold, false above", () => {
    expect(isLowStock(1, 1)).toBe(true);
    expect(isLowStock(0, 1)).toBe(true);
    expect(isLowStock(2, 1)).toBe(false);
  });
});

describe("computeNeedToBuy", () => {
  it("flags low-stock only", () => {
    const r = computeNeedToBuy({
      stockRows: [{ itemId: "m", item: milk, quantity: 0, lowThreshold: 1 }],
      openListItems: [],
    });
    expect(r.lowCount).toBe(1);
    expect(r.onListCount).toBe(0);
    expect(r.entries).toHaveLength(1);
    expect(r.entries[0]).toMatchObject({ item: milk, reason: "low_stock" });
    expect(r.entries[0].stock).toEqual({ quantity: 0, lowThreshold: 1 });
  });
  it("flags on-list only", () => {
    const r = computeNeedToBuy({
      stockRows: [{ itemId: "m", item: milk, quantity: 5, lowThreshold: 1 }],
      openListItems: [{ itemId: "e", item: eggs, listName: "Shop", quantity: 12 }],
    });
    expect(r.entries.map((x) => x.reason)).toEqual(["on_list"]);
    expect(r.entries[0].onLists).toEqual([{ listName: "Shop", quantity: 12 }]);
  });
  it("merges an item that is both low and on a list into one 'both' entry", () => {
    const r = computeNeedToBuy({
      stockRows: [{ itemId: "m", item: milk, quantity: 0, lowThreshold: 2 }],
      openListItems: [{ itemId: "m", item: milk, listName: "Shop", quantity: 1 }],
    });
    expect(r.entries).toHaveLength(1);
    expect(r.entries[0].reason).toBe("both");
    expect(r.entries[0].stock).toEqual({ quantity: 0, lowThreshold: 2 });
    expect(r.entries[0].onLists).toEqual([{ listName: "Shop", quantity: 1 }]);
  });
  it("empty input → empty", () => {
    expect(computeNeedToBuy({ stockRows: [], openListItems: [] })).toEqual({
      entries: [],
      lowCount: 0,
      onListCount: 0,
    });
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/lib/__tests__/need-to-buy.test.ts` — FAIL.

- [ ] **Step 3: Implement `need-to-buy.ts`**

```ts
// src/lib/need-to-buy.ts
export function isLowStock(quantity: number, lowThreshold: number): boolean {
  return quantity <= lowThreshold;
}

export interface NeedItem {
  id: string;
  name: string;
  emoji: string;
}
export interface StockLike {
  itemId: string;
  item: NeedItem;
  quantity: number;
  lowThreshold: number;
}
export interface OnListLike {
  itemId: string;
  item: NeedItem;
  listName: string;
  quantity: number;
}
export interface NeedEntry {
  item: NeedItem;
  reason: "low_stock" | "on_list" | "both";
  onLists: { listName: string; quantity: number }[];
  stock: { quantity: number; lowThreshold: number } | null;
}

export function computeNeedToBuy(input: {
  stockRows: StockLike[];
  openListItems: OnListLike[];
}): { entries: NeedEntry[]; lowCount: number; onListCount: number } {
  const lowMap = new Map<string, StockLike>();
  for (const s of input.stockRows) {
    if (isLowStock(s.quantity, s.lowThreshold)) lowMap.set(s.itemId, s);
  }
  const onListMap = new Map<
    string,
    { item: NeedItem; onLists: { listName: string; quantity: number }[] }
  >();
  for (const li of input.openListItems) {
    const e = onListMap.get(li.itemId) ?? { item: li.item, onLists: [] };
    e.onLists.push({ listName: li.listName, quantity: li.quantity });
    onListMap.set(li.itemId, e);
  }

  const entries: NeedEntry[] = [];
  for (const id of new Set<string>([...lowMap.keys(), ...onListMap.keys()])) {
    const low = lowMap.get(id);
    const onList = onListMap.get(id);
    const item = onList?.item ?? low?.item;
    if (!item) continue; // unreachable: id comes from one of the maps
    const reason = low && onList ? "both" : onList ? "on_list" : "low_stock";
    entries.push({
      item,
      reason,
      onLists: onList?.onLists ?? [],
      stock: low ? { quantity: low.quantity, lowThreshold: low.lowThreshold } : null,
    });
  }
  return { entries, lowCount: lowMap.size, onListCount: onListMap.size };
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx vitest run src/lib/__tests__/need-to-buy.test.ts` — PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/need-to-buy.ts src/lib/__tests__/need-to-buy.test.ts
git commit -m "feat(phase4a): need-to-buy helpers (isLowStock + computeNeedToBuy)"
```

---

### Task 2: Stock server actions

**Files:**
- Create: `src/actions/stock.ts`

**Interfaces:**
- Produces (all `Promise<{ ok: true } | { ok: false; error: string }>`, `requireHousehold()`-scoped):
  - `setStock({ itemId, quantity, unit, lowThreshold })`
  - `adjustStock({ itemId, delta })`
  - `removeStock(itemId)`

- [ ] **Step 1: Implement `src/actions/stock.ts`**

```ts
"use server";

import { prisma } from "@/lib/prisma";
import { requireHousehold } from "@/lib/household-context";
import { getCurrentUser } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";

type Result = { ok: true } | { ok: false; error: string };

function nonNeg(n: number, fallback: number): number {
  return Number.isFinite(n) ? Math.max(0, n) : fallback;
}

// Returns { id, defaultUnit } iff the item belongs to the household, else null.
async function ownedItem(householdId: string, itemId: string) {
  return prisma.item.findFirst({
    where: { id: itemId, householdId },
    select: { id: true, defaultUnit: true },
  });
}

export async function setStock(input: {
  itemId: string;
  quantity: number;
  unit: string;
  lowThreshold: number;
}): Promise<Result> {
  const household = await requireHousehold();
  const user = await getCurrentUser();
  const item = await ownedItem(household.id, input.itemId);
  if (!item) return { ok: false, error: "Item not found" };
  const quantity = nonNeg(input.quantity, 0);
  const lowThreshold = nonNeg(input.lowThreshold, 1);
  const unit = (input.unit ?? "").trim() || item.defaultUnit || "pcs";
  await prisma.stock.upsert({
    where: { householdId_itemId: { householdId: household.id, itemId: input.itemId } },
    update: { quantity, unit, lowThreshold, updatedById: user?.id ?? null },
    create: {
      householdId: household.id,
      itemId: input.itemId,
      quantity,
      unit,
      lowThreshold,
      updatedById: user?.id ?? null,
    },
  });
  revalidatePath("/stock");
  return { ok: true };
}

export async function adjustStock(input: { itemId: string; delta: number }): Promise<Result> {
  const household = await requireHousehold();
  const user = await getCurrentUser();
  const item = await ownedItem(household.id, input.itemId);
  if (!item) return { ok: false, error: "Item not found" };
  const delta = Number.isFinite(input.delta) ? input.delta : 0;
  const existing = await prisma.stock.findUnique({
    where: { householdId_itemId: { householdId: household.id, itemId: input.itemId } },
    select: { quantity: true },
  });
  const newQty = Math.max(0, (existing?.quantity ?? 0) + delta);
  await prisma.stock.upsert({
    where: { householdId_itemId: { householdId: household.id, itemId: input.itemId } },
    update: { quantity: newQty, updatedById: user?.id ?? null },
    create: {
      householdId: household.id,
      itemId: input.itemId,
      quantity: newQty,
      unit: item.defaultUnit || "pcs",
      lowThreshold: 1,
      updatedById: user?.id ?? null,
    },
  });
  revalidatePath("/stock");
  return { ok: true };
}

export async function removeStock(itemId: string): Promise<Result> {
  const household = await requireHousehold();
  const res = await prisma.stock.deleteMany({
    where: { householdId: household.id, itemId },
  });
  if (res.count === 0) return { ok: false, error: "Stock not found" };
  revalidatePath("/stock");
  return { ok: true };
}
```

- [ ] **Step 2: Typecheck + lint + build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: clean/pass (lint 0/0).

- [ ] **Step 3: Commit**

```bash
git add src/actions/stock.ts
git commit -m "feat(phase4a): stock actions (set/adjust/remove, item-scoped)"
```

---

### Task 3: `/stock` page + StockManager UI + i18n

**Files:**
- Create: `src/app/(app)/stock/page.tsx`, `src/components/StockManager.tsx`
- Modify: `src/i18n/dictionaries/en.ts`, `src/i18n/dictionaries/he.ts`

**Interfaces:**
- Consumes: `computeNeedToBuy`/`isLowStock` (`@/lib/need-to-buy`), stock actions (`@/actions/stock`), i18n, `Button`/`Input`.

- [ ] **Step 1: Add the `stock` i18n group + `catalog.nav.stock` (both dictionaries)**

Extend `catalog.nav` with `stock: "Stock"`, and add a top-level `stock` group to `en.ts` (mirror in `he.ts`):

```ts
stock: {
  title: "Stock",
  needToBuy: "Need to buy",
  needEmpty: "Nothing to buy right now.",
  reasonLow: "Low stock",
  reasonOnList: "On a list",
  reasonBoth: "Low + on a list",
  tracked: "In stock",
  trackedEmpty: "No items tracked yet.",
  low: "Low",
  quantity: "Quantity",
  unit: "Unit",
  lowThreshold: "Low at",
  addToStock: "Add to stock",
  chooseItem: "Choose an item",
  save: "Save",
  cancel: "Cancel",
  edit: "Edit",
  remove: "Remove",
  removeConfirm: "Stop tracking this item's stock?",
  onLists: "on: {lists}",
},
```

- [ ] **Step 2: Write `src/app/(app)/stock/page.tsx` (server)**

```tsx
import { prisma } from "@/lib/prisma";
import { requireHousehold } from "@/lib/household-context";
import { computeNeedToBuy } from "@/lib/need-to-buy";
import { StockManager } from "@/components/StockManager";

export const dynamic = "force-dynamic";

export default async function StockPage() {
  const household = await requireHousehold();
  const [stock, catalogItems, openListItems] = await Promise.all([
    prisma.stock.findMany({
      where: { householdId: household.id },
      orderBy: { updatedAt: "desc" },
      select: {
        itemId: true,
        quantity: true,
        unit: true,
        lowThreshold: true,
        item: { select: { id: true, name: true, emoji: true, defaultUnit: true } },
      },
    }),
    prisma.item.findMany({
      where: { householdId: household.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true, emoji: true, defaultUnit: true },
    }),
    prisma.listItem.findMany({
      where: {
        isBought: false,
        itemId: { not: null },
        list: { householdId: household.id, status: { in: ["draft", "active"] } },
      },
      select: {
        quantity: true,
        item: { select: { id: true, name: true, emoji: true } },
        list: { select: { name: true } },
      },
    }),
  ]);

  const needToBuy = computeNeedToBuy({
    stockRows: stock.map((s) => ({
      itemId: s.itemId,
      item: { id: s.item.id, name: s.item.name, emoji: s.item.emoji },
      quantity: s.quantity,
      lowThreshold: s.lowThreshold,
    })),
    openListItems: openListItems
      .filter((li) => li.item)
      .map((li) => ({
        itemId: li.item!.id,
        item: { id: li.item!.id, name: li.item!.name, emoji: li.item!.emoji },
        listName: li.list.name,
        quantity: li.quantity,
      })),
  });

  const trackedItemIds = new Set(stock.map((s) => s.itemId));
  const untracked = catalogItems.filter((i) => !trackedItemIds.has(i.id));

  return (
    <StockManager
      stock={stock.map((s) => ({
        itemId: s.itemId,
        name: s.item.name,
        emoji: s.item.emoji,
        quantity: s.quantity,
        unit: s.unit,
        lowThreshold: s.lowThreshold,
      }))}
      untrackedItems={untracked}
      needToBuy={needToBuy}
    />
  );
}
```

- [ ] **Step 3: Write `src/components/StockManager.tsx` (client)**

A `"use client"` component modeled on Phase 2/3 managers (module-level `getDictionary("en")` + `t`, `Button`/`Input`, `router.refresh()` on success, errors shown, pending-disable, no `useEffect` state-sync). Props:
- `stock: { itemId, name, emoji, quantity, unit, lowThreshold }[]`
- `untrackedItems: { id, name, emoji, defaultUnit }[]`
- `needToBuy: { entries: {item:{id,name,emoji}, reason, onLists:{listName,quantity}[], stock:{quantity,lowThreshold}|null}[]; lowCount; onListCount }`

Renders three sections:
1. **Need to buy** (`stock.needToBuy`): each entry = `emoji name` + a reason badge (`stock.reasonLow`/`reasonOnList`/`reasonBoth` per `entry.reason`); when `onLists` non-empty show `t(d,"stock.onLists",{lists: entry.onLists.map(l=>l.listName).join(", ")})`. Empty → `stock.needEmpty`.
2. **In stock** (`stock.tracked`): each row = `emoji name` + `quantity unit` + a **Low** badge when `isLowStock(quantity, lowThreshold)`; **−/＋** buttons → `adjustStock({ itemId, delta: -1 })` / `adjustStock({ itemId, delta: 1 })`; **Edit** inline form (quantity, unit, low threshold → `setStock({ itemId, quantity: Number(...), unit, lowThreshold: Number(...) })`); **Remove** (`confirm()` on `stock.removeConfirm` → `removeStock(itemId)`). Empty → `stock.trackedEmpty`.
3. **Add to stock** (`stock.addToStock`): a `<select>` of `untrackedItems` (value=id, label=`emoji name`), quantity, unit (prefill from chosen item's `defaultUnit`), low threshold → `setStock`. On ok `router.refresh()` + reset.

Import `isLowStock` from `@/lib/need-to-buy` for the Low badge. All numeric inputs coerced via `Number(...)`; the actions clamp server-side.

- [ ] **Step 4: Typecheck + test + lint + build**

Run: `npx tsc --noEmit && npx vitest run src/lib/__tests__/need-to-buy.test.ts && npm run lint && npm run build`
Expected: clean/pass; `/stock` compiles.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/stock" src/components/StockManager.tsx src/i18n/dictionaries/en.ts src/i18n/dictionaries/he.ts
git commit -m "feat(phase4a): stock page + manager UI + need-to-buy + i18n"
```

---

### Task 4: Dashboard low-stock card + verification

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Add a low-stock card**

In `src/app/(app)/dashboard/page.tsx`, add — inside the existing `Promise.all` (or after it) — a low-stock count. A plain Prisma `count` can't compare two columns, so fetch the rows and count in JS:

```ts
// alongside the other counts:
const stockRows = await prisma.stock.findMany({
  where: { householdId: household.id },
  select: { quantity: true, lowThreshold: true },
});
const lowStockCount = stockRows.filter((s) => s.quantity <= s.lowThreshold).length;
```

Then add a fifth `<Link href="/stock">` card labeled `t(d, "catalog.nav.stock")` with `{lowStockCount}` (a `stock.low`-style sublabel is fine, e.g. show the count of low items). Change the grid to fit five (e.g. `sm:grid-cols-2 lg:grid-cols-5`, or keep `lg:grid-cols-4` and let it wrap). `catalog.nav.stock` was added in Task 3.

- [ ] **Step 2: Full offline verification**

Run: `npx tsc --noEmit && npm run test && npm run lint && npm run build`
Expected: all pass (tests: need-to-buy + prior suites; lint 0/0; build compiles `/stock`, `/dashboard`).

- [ ] **Step 3: Manual smoke test** (controller runs this — dev server + live DB)

Signed-in household with catalog items: `/stock` add an item to stock (qty 3, threshold 1) → shows under "In stock"; **−** twice → qty 1 → **Low** badge appears + the item shows in **Need to buy** (Low stock); add that item to an open list (unbought) → Need-to-buy reason becomes "Low + on a list"; **＋** back above threshold → leaves Low/need-to-buy (unless still on the list → stays as "on a list"); **Remove** stock; `/dashboard` low-stock count reflects it. Confirm setting stock on another household's item id is rejected. Clean up test rows.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/dashboard/page.tsx"
git commit -m "feat(phase4a): dashboard low-stock card"
```

---

## Self-Review

**Spec coverage:**
- Stock set/adjust/remove, item-scoped → Task 2. ✅
- Low stock = `quantity <= lowThreshold` → Task 1 (`isLowStock`), used in Tasks 3, 4. ✅
- Need-to-buy (low + open-list unbought, deduped, reasons) → Task 1 helper + Task 3 page. ✅
- `/stock` page (need-to-buy + tracked list + add-to-stock) → Task 3. ✅
- Dashboard low-stock card → Task 4. ✅
- i18n en+he parity → Task 3. ✅
- Pure helpers unit-tested → Task 1. ✅
- Auto-track excluded (no autoTrackStock/stockUpdated) → all tasks. ✅

**Placeholder scan:** Actions + helper + page code given in full. The `StockManager` (Task 3 Step 3) specifies its three sections, props, the exact actions/keys, and the `isLowStock` use, mirroring the Phase-2/3 managers. No `TBD`/vague requirements.

**Type consistency:** `setStock({itemId,quantity,unit,lowThreshold})`, `adjustStock({itemId,delta})`, `removeStock(itemId)`, `isLowStock(q,t)`, `computeNeedToBuy({stockRows,openListItems})` and its `NeedEntry` shape, and the `stock.*` i18n keys are used identically across tasks. The `Stock` compound key is `householdId_itemId`. No non-null assertions (the helper uses an `if (!item) continue` guard).

## Setup dependency

None new — DB provisioned in Phase 1. Tasks 1–4 verify offline; the controller runs the live smoke test.
