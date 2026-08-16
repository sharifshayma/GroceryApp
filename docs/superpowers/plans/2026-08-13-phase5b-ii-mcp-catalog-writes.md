# GroceryApp Phase 5b-ii — MCP Catalog/Stock/Price/Tag Write Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the remaining 9 MCP write tools (catalog/stock/price/tag) plus the two read-tool seams they need (`list_categories`; price `entryId` in `list_prices`), reusing the 5b-i extract-shared-core pattern.

**Architecture:** Each web action's household-scoped body moves into a `src/lib/mutations/*` core taking explicit `(householdId, userId, input)`. Actions become thin session wrappers (keeping exact public return types). MCP tools call the same cores with the token's household/user (`hh(extra)`/`uid(extra)` from 5a/5b-i).

**Tech Stack:** Next.js 16 App Router, Prisma 6, `@modelcontextprotocol/sdk` via `mcp-handler@1.1.0`, Zod 4, Vitest 4, TypeScript.

## Global Constraints

- Branch `next-migration`, never `main`. Personal git identity (`sharifshayma`). Never commit `.env`.
- Lint command is **`npm run lint`** (bare eslint), NOT `npx next lint`.
- MCP tools are ID-based; `userId` for `createdById`/`loggedById`/`updatedById` comes ONLY from `uid(extra)`, never tool input.
- Web action wrappers MUST preserve exact current public signatures + return types (`Result` = `{ ok: true } | { ok: false; error: string }`); UI (`ItemManager`, `StockManager`, `PricesManager`, `TagManager`) must be behaviorally unchanged — `tsc` across consumers proves it.
- Cores live under `src/lib/mutations/`, contain NO `"use server"` and NO `revalidatePath` (those stay in the wrappers). Reuse `clean` from `src/lib/mutations/util.ts` (5b-i).
- Keep the `server.tool(...)` overload. Keep the existing read tools + auth wrapper unchanged (except the deliberate `list_categories` addition and the `listPrices` `entryId` addition).
- Deferrals stay: no auto-track stock, no `ensureStoreTag`, no unit-price fields.

---

## File Structure

- `src/lib/mutations/items.ts` — item write core + `resolveCategoryId` (Task 1).
- `src/actions/items.ts` — thin wrappers (Task 1).
- `src/lib/mutations/stock.ts` — stock write core + `nonNeg`/`ownedItem` (Task 2).
- `src/lib/mutations/stock.test.ts` — `nonNeg` unit test (Task 2).
- `src/actions/stock.ts` — thin wrappers (Task 2).
- `src/lib/mutations/prices.ts` — price write core + `validPrice`/`parseDate`/`ownedItem` (Task 3).
- `src/lib/mutations/prices.test.ts` — `validPrice`/`parseDate` unit tests (Task 3).
- `src/actions/prices.ts` — thin wrappers (Task 3).
- `src/lib/mutations/tags.ts` — `assignTagCore`/`unassignTagCore` + `bothOwned` (Task 4).
- `src/actions/tags.ts` — `assignTag`/`unassignTag` delegate; tag CRUD unchanged (Task 4).
- `src/lib/mcp-queries.ts` — add `listCategories`; add `entryId` to `listPrices` (Task 5).
- `src/app/api/mcp/route.ts` — register `list_categories` read tool (Task 5); add 9 write tools (Task 6).

---

## Task 1: Item write core + thin wrappers

**Files:** Create `src/lib/mutations/items.ts`; Modify `src/actions/items.ts`.

**Interfaces — Produces:**
- `resolveCategoryId(householdId: string, categoryId: string | null | undefined): Promise<string | null | false>`
- `createItemCore(householdId: string, userId: string | null, input: { categoryId?: string | null; name: string; nameHe?: string; emoji?: string; defaultUnit?: string; notes?: string }): Promise<Result>`
- `updateItemCore(householdId: string, input: { id: string; categoryId?: string | null; name: string; nameHe?: string; emoji?: string; defaultUnit?: string; notes?: string }): Promise<Result>`
- `deleteItemCore(householdId: string, input: { id: string }): Promise<Result>`
- Action wrappers unchanged: `createItem`, `updateItem`, `deleteItem` (all `Promise<Result>`).

- [ ] **Step 1: Write the item core**

Create `src/lib/mutations/items.ts` (bodies mirror `src/actions/items.ts` exactly, keyed by explicit ids, `userId` param, no `revalidatePath`):

```ts
import { prisma } from "@/lib/prisma";
import { clean } from "./util";

type Result = { ok: true } | { ok: false; error: string };

// Returns the categoryId if it belongs to this household, null if none given,
// or false if a non-null id doesn't belong to the household.
export async function resolveCategoryId(
  householdId: string,
  categoryId: string | null | undefined,
): Promise<string | null | false> {
  if (!categoryId) return null;
  const cat = await prisma.category.findFirst({
    where: { id: categoryId, householdId },
    select: { id: true },
  });
  return cat ? cat.id : false;
}

export async function createItemCore(
  householdId: string,
  userId: string | null,
  input: { categoryId?: string | null; name: string; nameHe?: string; emoji?: string; defaultUnit?: string; notes?: string },
): Promise<Result> {
  const name = clean(input.name);
  if (!name) return { ok: false, error: "Please enter an item name" };
  const categoryId = await resolveCategoryId(householdId, input.categoryId);
  if (categoryId === false) return { ok: false, error: "That category doesn't exist" };
  await prisma.item.create({
    data: {
      householdId,
      categoryId,
      name,
      nameHe: clean(input.nameHe),
      emoji: clean(input.emoji) ?? "🛒",
      defaultUnit: clean(input.defaultUnit) ?? "pcs",
      notes: clean(input.notes),
      createdById: userId,
    },
  });
  return { ok: true };
}

export async function updateItemCore(
  householdId: string,
  input: { id: string; categoryId?: string | null; name: string; nameHe?: string; emoji?: string; defaultUnit?: string; notes?: string },
): Promise<Result> {
  const name = clean(input.name);
  if (!name) return { ok: false, error: "Please enter an item name" };
  const categoryId = await resolveCategoryId(householdId, input.categoryId);
  if (categoryId === false) return { ok: false, error: "That category doesn't exist" };
  const res = await prisma.item.updateMany({
    where: { id: input.id, householdId },
    data: {
      categoryId,
      name,
      nameHe: clean(input.nameHe),
      emoji: clean(input.emoji) ?? "🛒",
      defaultUnit: clean(input.defaultUnit) ?? "pcs",
      notes: clean(input.notes),
    },
  });
  if (res.count === 0) return { ok: false, error: "Item not found" };
  return { ok: true };
}

export async function deleteItemCore(householdId: string, input: { id: string }): Promise<Result> {
  const res = await prisma.item.deleteMany({ where: { id: input.id, householdId } });
  if (res.count === 0) return { ok: false, error: "Item not found" };
  return { ok: true };
}
```

- [ ] **Step 2: Rewrite the action as thin wrappers**

Replace the bodies in `src/actions/items.ts` (keep `"use server"`, every export name + `Promise<Result>`; delegate to the core; keep the same `revalidatePath("/items")`). The full new file:

```ts
"use server";

import { requireHousehold } from "@/lib/household-context";
import { getCurrentUser } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import { createItemCore, updateItemCore, deleteItemCore } from "@/lib/mutations/items";

type Result = { ok: true } | { ok: false; error: string };

export async function createItem(input: {
  categoryId?: string | null;
  name: string;
  nameHe?: string;
  emoji?: string;
  defaultUnit?: string;
  notes?: string;
}): Promise<Result> {
  const household = await requireHousehold();
  const user = await getCurrentUser();
  const res = await createItemCore(household.id, user?.id ?? null, input);
  if (res.ok) revalidatePath("/items");
  return res;
}

export async function updateItem(input: {
  id: string;
  categoryId?: string | null;
  name: string;
  nameHe?: string;
  emoji?: string;
  defaultUnit?: string;
  notes?: string;
}): Promise<Result> {
  const household = await requireHousehold();
  const res = await updateItemCore(household.id, input);
  if (res.ok) revalidatePath("/items");
  return res;
}

export async function deleteItem(id: string): Promise<Result> {
  const household = await requireHousehold();
  const res = await deleteItemCore(household.id, { id });
  if (res.ok) revalidatePath("/items");
  return res;
}
```

- [ ] **Step 3: Verify + commit**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npx tsc --noEmit && npm run lint`
Expected: no type errors (proves `ItemManager` still typechecks); lint clean.

```bash
cd /Users/balanceshayma/Documents/GitHub/GroceryApp
git add src/lib/mutations/items.ts src/actions/items.ts
git commit -m "refactor(items): extract item write core; actions become thin wrappers"
```

---

## Task 2: Stock write core + thin wrappers

**Files:** Create `src/lib/mutations/stock.ts`, `src/lib/mutations/stock.test.ts`; Modify `src/actions/stock.ts`.

**Interfaces — Produces:**
- `nonNeg(n: number, fallback: number): number`
- `setStockCore(householdId: string, userId: string | null, input: { itemId: string; quantity: number; unit: string; lowThreshold: number }): Promise<Result>`
- `adjustStockCore(householdId: string, userId: string | null, input: { itemId: string; delta: number }): Promise<Result>`
- `removeStockCore(householdId: string, input: { itemId: string }): Promise<Result>`
- Action wrappers unchanged: `setStock`, `adjustStock`, `removeStock` (all `Promise<Result>`).

- [ ] **Step 1: Write the failing test for `nonNeg`**

Create `src/lib/mutations/stock.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { nonNeg } from "./stock";

describe("nonNeg", () => {
  it("keeps a non-negative finite number", () => {
    expect(nonNeg(3, 0)).toBe(3);
    expect(nonNeg(0, 1)).toBe(0);
  });
  it("clamps a negative to 0", () => expect(nonNeg(-5, 1)).toBe(0));
  it("non-finite → fallback", () => {
    expect(nonNeg(Number.NaN, 1)).toBe(1);
    expect(nonNeg(Number.POSITIVE_INFINITY, 2)).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npx vitest run src/lib/mutations/stock.test.ts`
Expected: FAIL — cannot resolve `./stock`.

- [ ] **Step 3: Write the stock core**

Create `src/lib/mutations/stock.ts` (mirrors `src/actions/stock.ts`; `nonNeg` exported for the test; `userId` param for `updatedById`; no `revalidatePath`):

```ts
import { prisma } from "@/lib/prisma";

type Result = { ok: true } | { ok: false; error: string };

export function nonNeg(n: number, fallback: number): number {
  return Number.isFinite(n) ? Math.max(0, n) : fallback;
}

// Returns { id, defaultUnit } iff the item belongs to the household, else null.
async function ownedItem(householdId: string, itemId: string) {
  return prisma.item.findFirst({
    where: { id: itemId, householdId },
    select: { id: true, defaultUnit: true },
  });
}

export async function setStockCore(
  householdId: string,
  userId: string | null,
  input: { itemId: string; quantity: number; unit: string; lowThreshold: number },
): Promise<Result> {
  const item = await ownedItem(householdId, input.itemId);
  if (!item) return { ok: false, error: "Item not found" };
  const quantity = nonNeg(input.quantity, 0);
  const lowThreshold = nonNeg(input.lowThreshold, 1);
  const unit = (input.unit ?? "").trim() || item.defaultUnit || "pcs";
  await prisma.stock.upsert({
    where: { householdId_itemId: { householdId, itemId: input.itemId } },
    update: { quantity, unit, lowThreshold, updatedById: userId },
    create: { householdId, itemId: input.itemId, quantity, unit, lowThreshold, updatedById: userId },
  });
  return { ok: true };
}

export async function adjustStockCore(
  householdId: string,
  userId: string | null,
  input: { itemId: string; delta: number },
): Promise<Result> {
  const item = await ownedItem(householdId, input.itemId);
  if (!item) return { ok: false, error: "Item not found" };
  const delta = Number.isFinite(input.delta) ? input.delta : 0;
  const existing = await prisma.stock.findUnique({
    where: { householdId_itemId: { householdId, itemId: input.itemId } },
    select: { quantity: true },
  });
  const newQty = Math.max(0, (existing?.quantity ?? 0) + delta);
  await prisma.stock.upsert({
    where: { householdId_itemId: { householdId, itemId: input.itemId } },
    update: { quantity: newQty, updatedById: userId },
    create: {
      householdId,
      itemId: input.itemId,
      quantity: newQty,
      unit: item.defaultUnit || "pcs",
      lowThreshold: 1,
      updatedById: userId,
    },
  });
  return { ok: true };
}

export async function removeStockCore(householdId: string, input: { itemId: string }): Promise<Result> {
  const res = await prisma.stock.deleteMany({ where: { householdId, itemId: input.itemId } });
  if (res.count === 0) return { ok: false, error: "Stock not found" };
  return { ok: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npx vitest run src/lib/mutations/stock.test.ts`
Expected: PASS.

- [ ] **Step 5: Rewrite the action as thin wrappers**

Replace the bodies in `src/actions/stock.ts` (keep `"use server"`, exports + `Promise<Result>`, the same `revalidatePath("/stock")`). The full new file:

```ts
"use server";

import { requireHousehold } from "@/lib/household-context";
import { getCurrentUser } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import { setStockCore, adjustStockCore, removeStockCore } from "@/lib/mutations/stock";

type Result = { ok: true } | { ok: false; error: string };

export async function setStock(input: {
  itemId: string;
  quantity: number;
  unit: string;
  lowThreshold: number;
}): Promise<Result> {
  const household = await requireHousehold();
  const user = await getCurrentUser();
  const res = await setStockCore(household.id, user?.id ?? null, input);
  if (res.ok) revalidatePath("/stock");
  return res;
}

export async function adjustStock(input: { itemId: string; delta: number }): Promise<Result> {
  const household = await requireHousehold();
  const user = await getCurrentUser();
  const res = await adjustStockCore(household.id, user?.id ?? null, input);
  if (res.ok) revalidatePath("/stock");
  return res;
}

export async function removeStock(itemId: string): Promise<Result> {
  const household = await requireHousehold();
  const res = await removeStockCore(household.id, { itemId });
  if (res.ok) revalidatePath("/stock");
  return res;
}
```

- [ ] **Step 6: Verify + commit**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npx vitest run src/lib/mutations/stock.test.ts && npx tsc --noEmit && npm run lint`
Expected: test PASS; no type errors (`StockManager` still typechecks); lint clean.

```bash
cd /Users/balanceshayma/Documents/GitHub/GroceryApp
git add src/lib/mutations/stock.ts src/lib/mutations/stock.test.ts src/actions/stock.ts
git commit -m "refactor(stock): extract stock write core; actions become thin wrappers"
```

---

## Task 3: Price write core + thin wrappers

**Files:** Create `src/lib/mutations/prices.ts`, `src/lib/mutations/prices.test.ts`; Modify `src/actions/prices.ts`.

**Interfaces — Produces:**
- `validPrice(n: number): number | null`
- `parseDate(s: string | undefined): Date`
- `addPriceEntryCore(householdId: string, userId: string | null, input: { itemId: string; price: number; store?: string; purchasedAt?: string }): Promise<Result>`
- `updatePriceEntryCore(householdId: string, input: { entryId: string; price: number; store?: string; purchasedAt?: string }): Promise<Result>`
- `deletePriceEntryCore(householdId: string, input: { entryId: string }): Promise<Result>`
- Action wrappers unchanged: `addPriceEntry`, `updatePriceEntry`, `deletePriceEntry` (all `Promise<Result>`).

- [ ] **Step 1: Write the failing test for the pure helpers**

Create `src/lib/mutations/prices.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validPrice, parseDate } from "./prices";

describe("validPrice", () => {
  it("accepts a positive finite number", () => expect(validPrice(6.9)).toBe(6.9));
  it("rejects 0/negative/NaN → null", () => {
    expect(validPrice(0)).toBeNull();
    expect(validPrice(-1)).toBeNull();
    expect(validPrice(Number.NaN)).toBeNull();
  });
});

describe("parseDate", () => {
  it("parses a valid YYYY-MM-DD", () => {
    expect(parseDate("2026-08-01").toISOString().slice(0, 10)).toBe("2026-08-01");
  });
  it("invalid/empty → a valid Date (today-ish, not NaN)", () => {
    expect(Number.isNaN(parseDate("not-a-date").getTime())).toBe(false);
    expect(Number.isNaN(parseDate(undefined).getTime())).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npx vitest run src/lib/mutations/prices.test.ts`
Expected: FAIL — cannot resolve `./prices`.

- [ ] **Step 3: Write the price core**

Create `src/lib/mutations/prices.ts` (mirrors `src/actions/prices.ts`; `validPrice`/`parseDate` exported for the test; `userId` param for `loggedById`; no `revalidatePath`):

```ts
import { prisma } from "@/lib/prisma";
import { clean } from "./util";

type Result = { ok: true } | { ok: false; error: string };

export function validPrice(n: number): number | null {
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Parse a YYYY-MM-DD string to a Date; invalid/empty → today.
export function parseDate(s: string | undefined): Date {
  if (s) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

async function ownedItem(householdId: string, itemId: string) {
  return prisma.item.findFirst({ where: { id: itemId, householdId }, select: { id: true } });
}

export async function addPriceEntryCore(
  householdId: string,
  userId: string | null,
  input: { itemId: string; price: number; store?: string; purchasedAt?: string },
): Promise<Result> {
  const item = await ownedItem(householdId, input.itemId);
  if (!item) return { ok: false, error: "Item not found" };
  const price = validPrice(input.price);
  if (price === null) return { ok: false, error: "Enter a valid price" };
  await prisma.priceHistory.create({
    data: {
      householdId,
      itemId: input.itemId,
      price,
      store: clean(input.store),
      purchasedAt: parseDate(input.purchasedAt),
      loggedById: userId,
    },
  });
  return { ok: true };
}

export async function updatePriceEntryCore(
  householdId: string,
  input: { entryId: string; price: number; store?: string; purchasedAt?: string },
): Promise<Result> {
  const price = validPrice(input.price);
  if (price === null) return { ok: false, error: "Enter a valid price" };
  const res = await prisma.priceHistory.updateMany({
    where: { id: input.entryId, householdId },
    data: { price, store: clean(input.store), purchasedAt: parseDate(input.purchasedAt) },
  });
  if (res.count === 0) return { ok: false, error: "Price entry not found" };
  return { ok: true };
}

export async function deletePriceEntryCore(
  householdId: string,
  input: { entryId: string },
): Promise<Result> {
  const res = await prisma.priceHistory.deleteMany({ where: { id: input.entryId, householdId } });
  if (res.count === 0) return { ok: false, error: "Price entry not found" };
  return { ok: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npx vitest run src/lib/mutations/prices.test.ts`
Expected: PASS.

- [ ] **Step 5: Rewrite the action as thin wrappers**

Replace the bodies in `src/actions/prices.ts` (keep `"use server"`, exports + `Promise<Result>`, the same `revalidatePath("/prices")`). The full new file:

```ts
"use server";

import { requireHousehold } from "@/lib/household-context";
import { getCurrentUser } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import { addPriceEntryCore, updatePriceEntryCore, deletePriceEntryCore } from "@/lib/mutations/prices";

type Result = { ok: true } | { ok: false; error: string };

export async function addPriceEntry(input: {
  itemId: string;
  price: number;
  store?: string;
  purchasedAt?: string;
}): Promise<Result> {
  const household = await requireHousehold();
  const user = await getCurrentUser();
  const res = await addPriceEntryCore(household.id, user?.id ?? null, input);
  if (res.ok) revalidatePath("/prices");
  return res;
}

export async function updatePriceEntry(input: {
  entryId: string;
  price: number;
  store?: string;
  purchasedAt?: string;
}): Promise<Result> {
  const household = await requireHousehold();
  const res = await updatePriceEntryCore(household.id, input);
  if (res.ok) revalidatePath("/prices");
  return res;
}

export async function deletePriceEntry(entryId: string): Promise<Result> {
  const household = await requireHousehold();
  const res = await deletePriceEntryCore(household.id, { entryId });
  if (res.ok) revalidatePath("/prices");
  return res;
}
```

- [ ] **Step 6: Verify + commit**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npx vitest run src/lib/mutations/prices.test.ts && npx tsc --noEmit && npm run lint`
Expected: test PASS; no type errors (`PricesManager` still typechecks); lint clean.

```bash
cd /Users/balanceshayma/Documents/GitHub/GroceryApp
git add src/lib/mutations/prices.ts src/lib/mutations/prices.test.ts src/actions/prices.ts
git commit -m "refactor(prices): extract price write core; actions become thin wrappers"
```

---

## Task 4: Tag assign/unassign core + thin wrappers

**Files:** Create `src/lib/mutations/tags.ts`; Modify `src/actions/tags.ts` (only `assignTag`/`unassignTag`; leave `createTag`/`updateTag`/`deleteTag` unchanged).

**Interfaces — Produces:**
- `assignTagCore(householdId: string, input: { itemId: string; tagId: string }): Promise<Result>`
- `unassignTagCore(householdId: string, input: { itemId: string; tagId: string }): Promise<Result>`
- Action wrappers unchanged: `assignTag`, `unassignTag` (all `Promise<Result>`); `createTag`/`updateTag`/`deleteTag` stay exactly as they are.

- [ ] **Step 1: Write the tag core**

Create `src/lib/mutations/tags.ts` (`bothOwned` moves here from the action):

```ts
import { prisma } from "@/lib/prisma";

type Result = { ok: true } | { ok: false; error: string };

// True only if BOTH the item and the tag belong to this household.
async function bothOwned(householdId: string, itemId: string, tagId: string): Promise<boolean> {
  const [item, tag] = await Promise.all([
    prisma.item.findFirst({ where: { id: itemId, householdId }, select: { id: true } }),
    prisma.tag.findFirst({ where: { id: tagId, householdId }, select: { id: true } }),
  ]);
  return Boolean(item && tag);
}

export async function assignTagCore(
  householdId: string,
  input: { itemId: string; tagId: string },
): Promise<Result> {
  if (!(await bothOwned(householdId, input.itemId, input.tagId))) {
    return { ok: false, error: "Item or tag not found" };
  }
  await prisma.itemTag.upsert({
    where: { itemId_tagId: { itemId: input.itemId, tagId: input.tagId } },
    update: {},
    create: { itemId: input.itemId, tagId: input.tagId },
  });
  return { ok: true };
}

export async function unassignTagCore(
  householdId: string,
  input: { itemId: string; tagId: string },
): Promise<Result> {
  if (!(await bothOwned(householdId, input.itemId, input.tagId))) {
    return { ok: false, error: "Item or tag not found" };
  }
  await prisma.itemTag.deleteMany({ where: { itemId: input.itemId, tagId: input.tagId } });
  return { ok: true };
}
```

- [ ] **Step 2: Rewrite `assignTag`/`unassignTag` in the action to delegate**

In `src/actions/tags.ts`: remove the local `bothOwned` helper, add `import { assignTagCore, unassignTagCore } from "@/lib/mutations/tags";`, and replace ONLY the `assignTag` and `unassignTag` bodies (leave `createTag`, `updateTag`, `deleteTag`, `isTagType`, `clean`, `TAG_TYPES` exactly as they are):

```ts
export async function assignTag(input: { itemId: string; tagId: string }): Promise<Result> {
  const household = await requireHousehold();
  const res = await assignTagCore(household.id, input);
  if (res.ok) revalidatePath("/items");
  return res;
}

export async function unassignTag(input: { itemId: string; tagId: string }): Promise<Result> {
  const household = await requireHousehold();
  const res = await unassignTagCore(household.id, input);
  if (res.ok) revalidatePath("/items");
  return res;
}
```

- [ ] **Step 3: Verify + commit**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npx tsc --noEmit && npm run lint`
Expected: no type errors (`TagManager`/`ItemTagPicker` still typecheck); lint clean. (`bothOwned` no longer referenced in the action — confirm no unused-var lint error.)

```bash
cd /Users/balanceshayma/Documents/GitHub/GroceryApp
git add src/lib/mutations/tags.ts src/actions/tags.ts
git commit -m "refactor(tags): extract assign/unassign core; those actions become thin wrappers"
```

---

## Task 5: Read-tool seams — `list_categories` + price `entryId`

**Files:** Modify `src/lib/mcp-queries.ts`, `src/app/api/mcp/route.ts`.

**Interfaces:**
- Consumes: `hh(extra)`/`json(...)` (existing route helpers).
- Produces: `listCategories(householdId: string): Promise<{ id: string; name: string; nameHe: string | null; emoji: string }[]>`; `listPrices` output rows gain an `entryId: string` field; a new read tool `list_categories`.

- [ ] **Step 1: Add `listCategories` + expose `entryId` in `listPrices` (mcp-queries.ts)**

In `src/lib/mcp-queries.ts`:

Add the new query (place near `listTags`):

```ts
export async function listCategories(householdId: string) {
  const cats = await prisma.category.findMany({
    where: { householdId },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, nameHe: true, emoji: true },
  });
  return cats;
}
```

Update `PriceRow` and `listPrices` to carry the entry id. Change the `PriceRow` type to add `entryId: string` as its first field, then in `listPrices` add `id: true` to the `select` and `entryId: e.id` to the mapped row:

```ts
// PriceRow type — add entryId:
type PriceRow = { entryId: string; itemId: string; item: string; price: number; store: string | null; purchasedAt: string };

// inside listPrices: select gains id
select: { id: true, price: true, store: true, purchasedAt: true, item: { select: { id: true, name: true } } },
// ...
const rows: PriceRow[] = entries.map((e) => ({
  entryId: e.id,
  itemId: e.item.id,
  item: e.item.name,
  price: Number(e.price),
  store: e.store,
  purchasedAt: e.purchasedAt.toISOString().slice(0, 10),
}));
```

(`markCheapest` still keys by `itemId` — its `PriceRow` param now includes `entryId`, which it passes through untouched.)

- [ ] **Step 2: Register the `list_categories` read tool (route.ts)**

Add `listCategories` to the `mcp-queries` import, and register the read tool alongside the other read tools inside `createMcpHandler`:

```ts
server.tool(
  "list_categories",
  "List the household's item categories (id, name, emoji). Use a category id with create_item/edit_item.",
  {},
  async (_args, extra) => json(await listCategories(hh(extra))),
);
```

- [ ] **Step 3: Verify + commit**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npx tsc --noEmit && npm run lint && npx vitest run`
Expected: no type/lint errors (the `markCheapest` test still passes with the added `entryId` field — the test rows may need `entryId` added if `markCheapest` is typed to require it; if `tsc` flags the test, add an `entryId` to each test row).

> **Note for the implementer:** if adding `entryId` to `PriceRow` makes `src/lib/mcp-queries.test.ts`'s `markCheapest` rows fail typecheck, add a dummy `entryId` (e.g. `"e1"`, `"e2"`) to each row object in that test — the test asserts on `cheapest` flags, not `entryId`.

```bash
cd /Users/balanceshayma/Documents/GitHub/GroceryApp
git add src/lib/mcp-queries.ts src/lib/mcp-queries.test.ts src/app/api/mcp/route.ts
git commit -m "feat(mcp): add list_categories read tool; expose price entryId in list_prices"
```

---

## Task 6: The 9 catalog/stock/price/tag write tools

**Files:** Modify `src/app/api/mcp/route.ts` (import cores; register 9 write tools after the existing tools).

**Interfaces:**
- Consumes: the cores (Tasks 1–4); `hh(extra)`/`uid(extra)`/`json(...)`.
- Produces: `tools/list` also returns `create_item`, `edit_item`, `delete_item`, `set_stock`, `adjust_stock`, `log_price`, `edit_price`, `delete_price`, `tag_item`.

- [ ] **Step 1: Import the cores**

Add to the imports in `src/app/api/mcp/route.ts`:

```ts
import { createItemCore, updateItemCore, deleteItemCore } from "@/lib/mutations/items";
import { setStockCore, adjustStockCore } from "@/lib/mutations/stock";
import { addPriceEntryCore, updatePriceEntryCore, deletePriceEntryCore } from "@/lib/mutations/prices";
import { assignTagCore, unassignTagCore } from "@/lib/mutations/tags";
```

- [ ] **Step 2: Register the 9 write tools**

Inside `createMcpHandler`'s setup, after the 5b-i list write tools:

```ts
server.tool(
  "create_item",
  "Create a catalog item. Optional categoryId from list_categories.",
  {
    name: z.string(),
    nameHe: z.string().optional(),
    emoji: z.string().optional(),
    defaultUnit: z.string().optional(),
    notes: z.string().optional(),
    categoryId: z.string().optional(),
  },
  async ({ name, nameHe, emoji, defaultUnit, notes, categoryId }, extra) =>
    json(await createItemCore(hh(extra), uid(extra), { name, nameHe, emoji, defaultUnit, notes, categoryId })),
);

server.tool(
  "edit_item",
  "Edit a catalog item. Get itemId from search_items; name is required. Optional categoryId from list_categories.",
  {
    itemId: z.string(),
    name: z.string(),
    nameHe: z.string().optional(),
    emoji: z.string().optional(),
    defaultUnit: z.string().optional(),
    notes: z.string().optional(),
    categoryId: z.string().optional(),
  },
  async ({ itemId, name, nameHe, emoji, defaultUnit, notes, categoryId }, extra) =>
    json(await updateItemCore(hh(extra), { id: itemId, name, nameHe, emoji, defaultUnit, notes, categoryId })),
);

server.tool(
  "delete_item",
  "Delete a catalog item. This also removes its stock, price history, list lines, and tags. Get itemId from search_items.",
  { itemId: z.string() },
  async ({ itemId }, extra) => json(await deleteItemCore(hh(extra), { id: itemId })),
);

server.tool(
  "set_stock",
  "Set an item's stock quantity, unit, and low threshold. Get itemId from search_items.",
  {
    itemId: z.string(),
    quantity: z.number(),
    unit: z.string().optional(),
    lowThreshold: z.number().optional(),
  },
  async ({ itemId, quantity, unit, lowThreshold }, extra) =>
    json(await setStockCore(hh(extra), uid(extra), { itemId, quantity, unit: unit ?? "", lowThreshold: lowThreshold ?? 1 })),
);

server.tool(
  "adjust_stock",
  "Add delta (may be negative) to an item's stock, clamped at 0. Get itemId from search_items.",
  { itemId: z.string(), delta: z.number() },
  async ({ itemId, delta }, extra) => json(await adjustStockCore(hh(extra), uid(extra), { itemId, delta })),
);

server.tool(
  "log_price",
  "Record a price for an item. Get itemId from search_items. purchasedAt is YYYY-MM-DD (defaults to today).",
  { itemId: z.string(), price: z.number(), store: z.string().optional(), purchasedAt: z.string().optional() },
  async ({ itemId, price, store, purchasedAt }, extra) =>
    json(await addPriceEntryCore(hh(extra), uid(extra), { itemId, price, store, purchasedAt })),
);

server.tool(
  "edit_price",
  "Edit a recorded price. Get entryId from list_prices. purchasedAt is YYYY-MM-DD.",
  { entryId: z.string(), price: z.number(), store: z.string().optional(), purchasedAt: z.string().optional() },
  async ({ entryId, price, store, purchasedAt }, extra) =>
    json(await updatePriceEntryCore(hh(extra), { entryId, price, store, purchasedAt })),
);

server.tool(
  "delete_price",
  "Delete a recorded price. Get entryId from list_prices.",
  { entryId: z.string() },
  async ({ entryId }, extra) => json(await deletePriceEntryCore(hh(extra), { entryId })),
);

server.tool(
  "tag_item",
  "Attach a tag to an item (or detach with attach:false). Get itemId from search_items and tagId from list_tags.",
  { itemId: z.string(), tagId: z.string(), attach: z.boolean().optional() },
  async ({ itemId, tagId, attach }, extra) =>
    json(attach === false
      ? await unassignTagCore(hh(extra), { itemId, tagId })
      : await assignTagCore(hh(extra), { itemId, tagId })),
);
```

- [ ] **Step 3: Verify + commit**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npx tsc --noEmit && npm run lint`
Expected: no type/lint errors. (Live smoke is run by the controller during verification.)

```bash
cd /Users/balanceshayma/Documents/GitHub/GroceryApp
git add src/app/api/mcp/route.ts
git commit -m "feat(mcp): 9 catalog/stock/price/tag write tools"
```

---

## Verification (controller-run — needs the live DB)

- [ ] **1. Offline gate:** `npx tsc --noEmit && npm run lint && npx vitest run` all clean; `npx next build` succeeds.

- [ ] **2. Live smoke** (`PORT=3001 npm run dev`, bearer from a seeded token — the 5a/5b-i pattern): seed a household + user + token + one category + (optionally) an item. Then via MCP with the bearer:
  - `list_categories` → returns the seeded category id.
  - `create_item {name:"Yogurt", categoryId:<cat>}` → item created (fetch its id via `search_items`).
  - `edit_item {itemId, name:"Greek Yogurt", emoji:"🥛"}` → updated.
  - `set_stock {itemId, quantity:5, lowThreshold:2}` → stock row; `adjust_stock {itemId, delta:-10}` → clamped to 0.
  - `log_price {itemId, price:7.5, store:"A"}` then `{price:6.9, store:"B"}` → two entries; `list_prices` now exposes `entryId`; `edit_price {entryId, price:7.0}`; `delete_price {entryId}`.
  - `tag_item {itemId, tagId:<from list_tags or a seeded tag>}` then `{…, attach:false}` → ItemTag added then removed.
  - `delete_item {itemId}` → item + its stock/prices/tags gone.
  - **Scoping:** a foreign-household `itemId`/`entryId`/`tagId`/`categoryId` on each relevant tool → not-found.
  - **Web parity:** unchanged public action types + a green `next build` are the guarantee.
  - Clean up all seeded rows.

- [ ] **3. Final whole-branch review** (most capable model) over the Phase 5b-ii range before pushing `next-migration`.

---

## Self-Review

**Spec coverage:** item/stock/price cores + thin wrappers ✓ (Tasks 1–3); tag assign/unassign core + partial wrapper (CRUD left inline) ✓ (Task 4); `list_categories` read tool + `listPrices` `entryId` ✓ (Task 5); the 9 write tools with ID-based inputs, `tag_item` attach/detach, `create_item`/`edit_item` categoryId ✓ (Task 6); `userId` only from `uid(extra)` ✓; destructive `delete_item`/`delete_price` trusted with warning descriptions ✓; deferrals honored (no auto-track/ensureStoreTag/unit-price) ✓; unit tests for `nonNeg`/`validPrice`/`parseDate` ✓; household scoping preserved (gates moved, not weakened) ✓; live smoke ✓.

**Placeholder scan:** No TBD/TODO. All code blocks are complete drop-in files or precise, located insertions. The one conditional instruction (add `entryId` to the `markCheapest` test rows if tsc flags them) is a concrete, bounded fix, not a placeholder.

**Type consistency:** `Result` shape identical across all cores + wrappers. Core names in Task 6's imports match Tasks 1–4's exports (`createItemCore`/`updateItemCore`/`deleteItemCore`/`setStockCore`/`adjustStockCore`/`addPriceEntryCore`/`updatePriceEntryCore`/`deletePriceEntryCore`/`assignTagCore`/`unassignTagCore`). `set_stock` passes `unit: unit ?? ""` so the core's `(unit ?? "").trim() || defaultUnit || "pcs"` fallback fires on empty — matching the original action. `PriceRow` gains `entryId` consistently in the type, the `listPrices` mapping, and (if needed) the test rows. `uid(extra)`/`hh(extra)` are the established 5a/5b-i accessors.
