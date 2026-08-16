# GroceryApp Migration — Phase 2a (Categories + Items) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the catalog master-data layer — seed default categories per household, and full CRUD for categories and items — as Prisma server actions + Next.js pages, on top of the Phase 1 foundation.

**Architecture:** Server actions (`"use server"`) scoped by `requireHousehold()` do all mutations; server-component pages read via Prisma; client components handle forms and call the actions then `router.refresh()`. Mirrors Phase 1 and the storefront patterns.

**Tech Stack:** Next.js 16, Prisma 6 + Prisma Postgres, better-auth, Tailwind v4, Zod, Vitest — all already in place from Phase 1.

## Global Constraints

- Work on branch `next-migration` in `/Users/balanceshayma/Documents/GitHub/GroceryApp`. Never touch `main`.
- Reuse Phase 1 conventions: `requireHousehold()` from `@/lib/household-context` gates every catalog read/mutation; actions return `{ ok: true } | { ok: false; error: string }`; no unscoped data access (every query/mutation filtered by `household.id`).
- `categoryId` on item create/update MUST be verified to belong to the caller's household before writing (else return an error).
- Deleting a category must NOT delete its items — they become uncategorized (FK `Category` relation is `SetNull` on Item; do a scoped category delete and let the FK null the items' `categoryId`).
- i18n: every new UI string added to BOTH `src/i18n/dictionaries/en.ts` and `he.ts` with identical key structure (`Dictionary = typeof en` enforces it via tsc). Pages call `getDictionary("en")` (English-facing, per Phase 1).
- Photos are OUT of scope: never set/read `photoUrl`/`photoPath`; no Vercel Blob.
- `@/*` → `./src/*`. Money/quantity types unchanged (not touched this phase).
- The dev DB is live (Prisma Postgres from Phase 1); `.env` has `DATABASE_URL` + `BETTER_AUTH_SECRET`.

## File structure (Phase 2a)

```
src/lib/default-categories.ts        # 21 default categories + seedDefaultCategories()
src/lib/reorder.ts                   # pure swapOrder() helper for up/down reorder
src/actions/categories.ts            # create/update/delete/move category actions
src/actions/items.ts                 # create/update/delete item actions
src/app/(app)/categories/page.tsx    # server page (reads categories)
src/components/CategoryManager.tsx   # client: list + add/edit/delete/reorder
src/app/(app)/items/page.tsx         # server page (reads items + categories)
src/components/ItemManager.tsx       # client: item list + Add/Edit modal (ItemForm)
src/app/(app)/dashboard/page.tsx     # MODIFY: nav to Categories + Items
src/actions/auth.ts                  # MODIFY: seed default categories in createHousehold
src/i18n/dictionaries/{en,he}.ts     # MODIFY: add catalog keys
```

---

### Task 1: Default categories data + seed on household creation

**Files:**
- Create: `src/lib/default-categories.ts`
- Test: `src/lib/__tests__/default-categories.test.ts`
- Modify: `src/actions/auth.ts` (seed inside `createHousehold`'s transaction)

**Interfaces:**
- Produces:
  - `interface DefaultCategory { name: string; nameHe: string; emoji: string }`
  - `export const DEFAULT_CATEGORIES: DefaultCategory[]` (21 entries)
  - `export async function seedDefaultCategories(tx: PrismaClientOrTx, householdId: string): Promise<void>` — inserts all defaults (`isDefault: true`, `sortOrder` = index+1) via `createMany`. Accepts a Prisma client OR a transaction client so `createHousehold` can call it inside its `$transaction`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/__tests__/default-categories.test.ts
import { describe, it, expect } from "vitest";
import { DEFAULT_CATEGORIES } from "@/lib/default-categories";

describe("DEFAULT_CATEGORIES", () => {
  it("has 21 bilingual categories with unique names", () => {
    expect(DEFAULT_CATEGORIES).toHaveLength(21);
    expect(new Set(DEFAULT_CATEGORIES.map((c) => c.name)).size).toBe(21);
    for (const c of DEFAULT_CATEGORIES) {
      expect(c.name.length).toBeGreaterThan(0);
      expect(c.nameHe.length).toBeGreaterThan(0);
      expect(c.emoji.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/lib/__tests__/default-categories.test.ts` — FAIL (module not found).

- [ ] **Step 3: Implement `default-categories.ts`**

```ts
// src/lib/default-categories.ts
import type { Prisma, PrismaClient } from "@prisma/client";

export interface DefaultCategory {
  name: string;
  nameHe: string;
  emoji: string;
}

// The 21 standard categories, ported from the Vite app's seedCategories.js.
export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { name: "Vegetables & Fruits", nameHe: "ירקות ופירות", emoji: "🥬" },
  { name: "Nuts & Dried Fruit", nameHe: "אגוזים ופירות יבשים", emoji: "🥜" },
  { name: "Eggs", nameHe: "ביצים", emoji: "🥚" },
  { name: "Dairy", nameHe: "מוצרי חלב", emoji: "🧀" },
  { name: "Meat, Poultry & Fish", nameHe: "בשר, עוף ודגים", emoji: "🥩" },
  { name: "Deli Meat & Salads", nameHe: "נקניקים וסלטים", emoji: "🥗" },
  { name: "Bakery", nameHe: "מאפייה", emoji: "🍞" },
  { name: "Pantry", nameHe: "מזווה", emoji: "🫙" },
  { name: "Chocolate & Sweets", nameHe: "שוקולד וממתקים", emoji: "🍫" },
  { name: "Cakes & Cookies", nameHe: "עוגות ועוגיות", emoji: "🍪" },
  { name: "Ice Cream & Popsicles", nameHe: "גלידות וארטיקים", emoji: "🍦" },
  { name: "Frozen Food", nameHe: "מזון קפוא", emoji: "🧊" },
  { name: "Coffee, Tea & Hot Chocolate", nameHe: "קפה, תה ושוקו", emoji: "☕" },
  { name: "Soft Drinks", nameHe: "משקאות קלים", emoji: "🥤" },
  { name: "Alcohol", nameHe: "אלכוהול", emoji: "🍷" },
  { name: "Baby Food & Products", nameHe: "מזון ומוצרי תינוקות", emoji: "🍼" },
  { name: "Pet Products", nameHe: "מוצרים לחיות מחמד", emoji: "🐾" },
  { name: "House Cleaning & Disposable", nameHe: "ניקיון וחד פעמי", emoji: "🧹" },
  { name: "Hygiene & Care", nameHe: "היגיינה וטיפוח", emoji: "🧴" },
  { name: "Health Care / First Aid", nameHe: "בריאות ועזרה ראשונה", emoji: "💊" },
  { name: "Laundry Products", nameHe: "מוצרי כביסה", emoji: "👕" },
];

// Accepts the prisma client or a $transaction client (both expose `.category`).
type Db = PrismaClient | Prisma.TransactionClient;

export async function seedDefaultCategories(db: Db, householdId: string): Promise<void> {
  await db.category.createMany({
    data: DEFAULT_CATEGORIES.map((c, i) => ({
      householdId,
      name: c.name,
      nameHe: c.nameHe,
      emoji: c.emoji,
      sortOrder: i + 1,
      isDefault: true,
    })),
  });
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx vitest run src/lib/__tests__/default-categories.test.ts` — PASS.

- [ ] **Step 5: Seed defaults in `createHousehold`**

In `src/actions/auth.ts`, add `import { seedDefaultCategories } from "@/lib/default-categories";`, and inside the existing `$transaction` in `createHousehold` (after the `tx.user.update`), call it with the tx client:

```ts
await prisma.$transaction(async (tx) => {
  const hh = await tx.household.create({
    data: { name: parsed.data.name, inviteCode: generateInviteCode(), createdById: user.id },
  });
  await tx.user.update({
    where: { id: user.id },
    data: { householdId: hh.id, role: "owner" },
  });
  await seedDefaultCategories(tx, hh.id);
});
```

Do NOT change `joinHousehold` (the household already has categories).

- [ ] **Step 6: Typecheck + test + build**

Run: `npx tsc --noEmit && npx vitest run src/lib/__tests__/default-categories.test.ts && npm run build`
Expected: clean/pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/default-categories.ts src/lib/__tests__/default-categories.test.ts src/actions/auth.ts
git commit -m "feat(phase2a): default categories + seed on household creation"
```

---

### Task 2: Reorder helper (pure) + category actions

**Files:**
- Create: `src/lib/reorder.ts`, `src/actions/categories.ts`
- Test: `src/lib/__tests__/reorder.test.ts`

**Interfaces:**
- Produces:
  - `export function swapOrder(ordered: { id: string; sortOrder: number }[], id: string, direction: "up" | "down"): { id: string; sortOrder: number }[]` — returns the TWO rows to update (target + neighbor, with their `sortOrder` values swapped), or `[]` if the move is a no-op (target not found, or already at the top/bottom).
  - `src/actions/categories.ts`: `createCategory({ name, nameHe, emoji })`, `updateCategory({ id, name, nameHe, emoji })`, `deleteCategory(id)`, `moveCategory({ id, direction })` — all `Promise<{ ok: true } | { ok: false; error: string }>`.

- [ ] **Step 1: Write the failing test for swapOrder**

```ts
// src/lib/__tests__/reorder.test.ts
import { describe, it, expect } from "vitest";
import { swapOrder } from "@/lib/reorder";

const list = [
  { id: "a", sortOrder: 1 },
  { id: "b", sortOrder: 2 },
  { id: "c", sortOrder: 3 },
];

describe("swapOrder", () => {
  it("moves a middle item up (swaps sortOrder with previous)", () => {
    const r = swapOrder(list, "b", "up");
    expect(r).toEqual([
      { id: "b", sortOrder: 1 },
      { id: "a", sortOrder: 2 },
    ]);
  });
  it("moves a middle item down", () => {
    const r = swapOrder(list, "b", "down");
    expect(r).toEqual([
      { id: "b", sortOrder: 3 },
      { id: "c", sortOrder: 2 },
    ]);
  });
  it("is a no-op at the top going up", () => {
    expect(swapOrder(list, "a", "up")).toEqual([]);
  });
  it("is a no-op at the bottom going down", () => {
    expect(swapOrder(list, "c", "down")).toEqual([]);
  });
  it("is a no-op for an unknown id", () => {
    expect(swapOrder(list, "zzz", "up")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/lib/__tests__/reorder.test.ts` — FAIL.

- [ ] **Step 3: Implement `reorder.ts`**

```ts
// src/lib/reorder.ts
export function swapOrder(
  ordered: { id: string; sortOrder: number }[],
  id: string,
  direction: "up" | "down",
): { id: string; sortOrder: number }[] {
  const sorted = [...ordered].sort((a, b) => a.sortOrder - b.sortOrder);
  const idx = sorted.findIndex((x) => x.id === id);
  if (idx === -1) return [];
  const neighborIdx = direction === "up" ? idx - 1 : idx + 1;
  if (neighborIdx < 0 || neighborIdx >= sorted.length) return [];
  const target = sorted[idx];
  const neighbor = sorted[neighborIdx];
  return [
    { id: target.id, sortOrder: neighbor.sortOrder },
    { id: neighbor.id, sortOrder: target.sortOrder },
  ];
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx vitest run src/lib/__tests__/reorder.test.ts` — PASS.

- [ ] **Step 5: Implement `src/actions/categories.ts`**

```ts
"use server";

import { prisma } from "@/lib/prisma";
import { requireHousehold } from "@/lib/household-context";
import { revalidatePath } from "next/cache";
import { swapOrder } from "@/lib/reorder";

type Result = { ok: true } | { ok: false; error: string };

function clean(s: string | undefined | null): string | null {
  const v = (s ?? "").trim();
  return v ? v : null;
}

export async function createCategory(input: {
  name: string;
  nameHe?: string;
  emoji?: string;
}): Promise<Result> {
  const household = await requireHousehold();
  const name = clean(input.name);
  if (!name) return { ok: false, error: "Please enter a category name" };
  const max = await prisma.category.aggregate({
    where: { householdId: household.id },
    _max: { sortOrder: true },
  });
  await prisma.category.create({
    data: {
      householdId: household.id,
      name,
      nameHe: clean(input.nameHe),
      emoji: clean(input.emoji) ?? "📦",
      sortOrder: (max._max.sortOrder ?? 0) + 1,
    },
  });
  revalidatePath("/categories");
  revalidatePath("/items");
  return { ok: true };
}

export async function updateCategory(input: {
  id: string;
  name: string;
  nameHe?: string;
  emoji?: string;
}): Promise<Result> {
  const household = await requireHousehold();
  const name = clean(input.name);
  if (!name) return { ok: false, error: "Please enter a category name" };
  const res = await prisma.category.updateMany({
    where: { id: input.id, householdId: household.id },
    data: { name, nameHe: clean(input.nameHe), emoji: clean(input.emoji) ?? "📦" },
  });
  if (res.count === 0) return { ok: false, error: "Category not found" };
  revalidatePath("/categories");
  revalidatePath("/items");
  return { ok: true };
}

export async function deleteCategory(id: string): Promise<Result> {
  const household = await requireHousehold();
  // Items keep existing; their categoryId is nulled by the FK (SetNull).
  const res = await prisma.category.deleteMany({
    where: { id, householdId: household.id },
  });
  if (res.count === 0) return { ok: false, error: "Category not found" };
  revalidatePath("/categories");
  revalidatePath("/items");
  return { ok: true };
}

export async function moveCategory(input: {
  id: string;
  direction: "up" | "down";
}): Promise<Result> {
  const household = await requireHousehold();
  const ordered = await prisma.category.findMany({
    where: { householdId: household.id },
    select: { id: true, sortOrder: true },
    orderBy: { sortOrder: "asc" },
  });
  const updates = swapOrder(ordered, input.id, input.direction);
  if (updates.length === 0) return { ok: true }; // no-op at edge / unknown id
  await prisma.$transaction(
    updates.map((u) =>
      prisma.category.update({
        where: { id: u.id },
        data: { sortOrder: u.sortOrder },
      }),
    ),
  );
  revalidatePath("/categories");
  revalidatePath("/items");
  return { ok: true };
}
```

- [ ] **Step 6: Typecheck + tests + build**

Run: `npx tsc --noEmit && npx vitest run src/lib/__tests__/reorder.test.ts && npm run build`
Expected: clean/pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/reorder.ts src/lib/__tests__/reorder.test.ts src/actions/categories.ts
git commit -m "feat(phase2a): category actions + reorder helper"
```

---

### Task 3: Item actions

**Files:**
- Create: `src/actions/items.ts`

**Interfaces:**
- Consumes: `prisma`, `requireHousehold`, `getCurrentUser`.
- Produces: `createItem`, `updateItem`, `deleteItem` — each `Promise<{ ok: true } | { ok: false; error: string }>`.
  - `createItem({ categoryId?, name, nameHe?, emoji?, defaultUnit?, notes? })`
  - `updateItem({ id, categoryId?, name, nameHe?, emoji?, defaultUnit?, notes? })`
  - `deleteItem(id)`

- [ ] **Step 1: Implement `src/actions/items.ts`**

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

// Returns the categoryId if it belongs to this household, null if none given,
// or false if a non-null id doesn't belong to the household.
async function resolveCategoryId(
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
  const name = clean(input.name);
  if (!name) return { ok: false, error: "Please enter an item name" };
  const categoryId = await resolveCategoryId(household.id, input.categoryId);
  if (categoryId === false) return { ok: false, error: "That category doesn't exist" };
  await prisma.item.create({
    data: {
      householdId: household.id,
      categoryId,
      name,
      nameHe: clean(input.nameHe),
      emoji: clean(input.emoji) ?? "🛒",
      defaultUnit: clean(input.defaultUnit) ?? "pcs",
      notes: clean(input.notes),
      createdById: user?.id ?? null,
    },
  });
  revalidatePath("/items");
  return { ok: true };
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
  const name = clean(input.name);
  if (!name) return { ok: false, error: "Please enter an item name" };
  const categoryId = await resolveCategoryId(household.id, input.categoryId);
  if (categoryId === false) return { ok: false, error: "That category doesn't exist" };
  const res = await prisma.item.updateMany({
    where: { id: input.id, householdId: household.id },
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
  revalidatePath("/items");
  return { ok: true };
}

export async function deleteItem(id: string): Promise<Result> {
  const household = await requireHousehold();
  const res = await prisma.item.deleteMany({
    where: { id, householdId: household.id },
  });
  if (res.count === 0) return { ok: false, error: "Item not found" };
  revalidatePath("/items");
  return { ok: true };
}
```

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: clean/pass.

- [ ] **Step 3: Commit**

```bash
git add src/actions/items.ts
git commit -m "feat(phase2a): item actions (create/update/delete, household+category scoped)"
```

---

### Task 4: Categories page + manager UI + i18n

**Files:**
- Create: `src/app/(app)/categories/page.tsx`, `src/components/CategoryManager.tsx`
- Modify: `src/i18n/dictionaries/en.ts`, `src/i18n/dictionaries/he.ts`

**Interfaces:**
- Consumes: `prisma`, `requireHousehold`, category actions, `getDictionary`/`t`, `Button`/`Input` (Phase 1).
- Produces: the `/categories` route.

- [ ] **Step 1: Add catalog i18n keys (both dictionaries)**

Add a `catalog` group to `en.ts` (and identical structure in `he.ts` with Hebrew values):

```ts
catalog: {
  nav: { categories: "Categories", items: "Items" },
  categories: {
    title: "Categories",
    add: "Add category",
    namePlaceholder: "Category name",
    nameHePlaceholder: "Hebrew name (optional)",
    emojiPlaceholder: "Emoji",
    save: "Save",
    cancel: "Cancel",
    edit: "Edit",
    delete: "Delete",
    deleteConfirm: "Delete this category? Its items will become uncategorized.",
    moveUp: "Move up",
    moveDown: "Move down",
    empty: "No categories yet.",
  },
  items: {
    title: "Items",
    add: "Add item",
    name: "Name",
    nameHe: "Hebrew name",
    category: "Category",
    noCategory: "No category",
    unit: "Unit",
    notes: "Notes",
    save: "Save",
    cancel: "Cancel",
    edit: "Edit",
    delete: "Delete",
    deleteConfirm: "Delete this item?",
    empty: "No items yet. Add your first one.",
    uncategorized: "Uncategorized",
  },
},
```

- [ ] **Step 2: Write `src/app/(app)/categories/page.tsx` (server)**

```tsx
import { prisma } from "@/lib/prisma";
import { requireHousehold } from "@/lib/household-context";
import { CategoryManager } from "@/components/CategoryManager";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const household = await requireHousehold();
  const categories = await prisma.category.findMany({
    where: { householdId: household.id },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, nameHe: true, emoji: true, sortOrder: true },
  });
  return <CategoryManager categories={categories} />;
}
```

- [ ] **Step 3: Write `src/components/CategoryManager.tsx` (client)**

A `"use client"` component that renders the category list (emoji + name + optional Hebrew), each row with **Edit**, **Delete** (with `confirm()` using `catalog.categories.deleteConfirm`), and **▲/▼** move buttons; plus an **Add category** inline form (name, Hebrew name, emoji). Each action calls the corresponding server action from `@/actions/categories`, and on `ok` calls `router.refresh()`; on failure shows the returned error. Use `useT()` for labels, and `Button`/`Input` from `@/components/ui`. Disable buttons while a mutation is in flight. (Model the structure on the Phase-1 `OnboardingForm` client component + the storefront's list components.)

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: clean; `/categories` compiles.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/categories" src/components/CategoryManager.tsx src/i18n/dictionaries/en.ts src/i18n/dictionaries/he.ts
git commit -m "feat(phase2a): categories page + manager UI + catalog i18n"
```

---

### Task 5: Items page + manager UI

**Files:**
- Create: `src/app/(app)/items/page.tsx`, `src/components/ItemManager.tsx`

**Interfaces:**
- Consumes: `prisma`, `requireHousehold`, item actions, category list (for the select), i18n, `Button`/`Input`.
- Produces: the `/items` route.

- [ ] **Step 1: Write `src/app/(app)/items/page.tsx` (server)**

```tsx
import { prisma } from "@/lib/prisma";
import { requireHousehold } from "@/lib/household-context";
import { ItemManager } from "@/components/ItemManager";

export const dynamic = "force-dynamic";

export default async function ItemsPage() {
  const household = await requireHousehold();
  const [items, categories] = await Promise.all([
    prisma.item.findMany({
      where: { householdId: household.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, nameHe: true, emoji: true, defaultUnit: true,
        notes: true, categoryId: true,
        category: { select: { name: true, emoji: true } },
      },
    }),
    prisma.category.findMany({
      where: { householdId: household.id },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, emoji: true },
    }),
  ]);
  return <ItemManager items={items} categories={categories} />;
}
```

- [ ] **Step 2: Write `src/components/ItemManager.tsx` (client)**

A `"use client"` component: a list of items (emoji + name + category label + unit; "Uncategorized" when `categoryId` is null), each with **Edit** and **Delete** (`confirm()`), plus an **Add item** button opening a modal/panel `ItemForm` with fields: category `<select>` (options from `categories`, plus a "No category" option), name, Hebrew name, emoji, unit, notes. Create/edit call `@/actions/items`; on `ok` → `router.refresh()`; on failure show the error. Reuse `Button`/`Input` and `useT()`. Keep the modal simple (a fixed-position panel with a backdrop, or an inline expanding form — implementer's choice; match the storefront's simple modal style if one exists, else a minimal accessible dialog with `role="dialog"`, focus the first field, close on Cancel/Escape).

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: clean; `/items` compiles.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/items" src/components/ItemManager.tsx
git commit -m "feat(phase2a): items page + manager UI"
```

---

### Task 6: Dashboard nav + verification

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`, `src/i18n/dictionaries/{en,he}.ts` (dashboard nav strings if needed)

- [ ] **Step 1: Update the dashboard to link to Categories + Items**

Replace the empty-state body of `src/app/(app)/dashboard/page.tsx` with two nav cards/links (`<Link href="/categories">` and `<Link href="/items">`) labeled via `t(d, "catalog.nav.categories")` / `t(d, "catalog.nav.items")`, plus a short count summary (read counts via `prisma`, scoped by `requireHousehold()` — make the component `async`). Keep the `dashboard.title`.

```tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireHousehold } from "@/lib/household-context";
import { getDictionary, t } from "@/i18n";

export const dynamic = "force-dynamic";
const d = getDictionary("en");

export default async function DashboardPage() {
  const household = await requireHousehold();
  const [categoryCount, itemCount] = await Promise.all([
    prisma.category.count({ where: { householdId: household.id } }),
    prisma.item.count({ where: { householdId: household.id } }),
  ]);
  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="text-2xl font-extrabold">{t(d, "dashboard.title")}</h1>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link href="/categories" className="rounded-2xl border border-border bg-white p-5 hover:border-brand">
          <div className="font-bold">{t(d, "catalog.nav.categories")}</div>
          <div className="text-sm text-ink/60">{categoryCount}</div>
        </Link>
        <Link href="/items" className="rounded-2xl border border-border bg-white p-5 hover:border-brand">
          <div className="font-bold">{t(d, "catalog.nav.items")}</div>
          <div className="text-sm text-ink/60">{itemCount}</div>
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Full offline verification**

Run: `npx tsc --noEmit && npm run test && npm run lint && npm run build`
Expected: all pass (tests: default-categories + reorder + Phase-1 suites; lint clean on `src`; build compiles `/categories`, `/items`, `/dashboard`).

- [ ] **Step 3: Manual smoke test** (dev server + live DB)

Start `npm run dev`. With a signed-in household (sign up fresh if needed):
1. `/categories` shows the **21 seeded** categories (new household).
2. Add a custom category → appears at the end; edit its name/emoji; move it up/down; delete it.
3. `/items` → Add item under a category (name, Hebrew, emoji, unit, notes) → appears; edit it; delete it.
4. Delete a category that has an item → the item still exists on `/items`, now "Uncategorized".
5. `/dashboard` shows correct category/item counts and links work.

(Reads/writes go through the live Prisma Postgres from Phase 1. Clean up any test rows afterward.)

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/dashboard/page.tsx" src/i18n/dictionaries/en.ts src/i18n/dictionaries/he.ts
git commit -m "feat(phase2a): dashboard catalog nav + counts"
```

---

## Self-Review

**Spec coverage:**
- Default categories + seed on household creation → Task 1. ✅
- Category CRUD + reorder → Task 2. ✅
- Item CRUD (household + category scoped) → Task 3. ✅
- Categories page/UI → Task 4; Items page/UI → Task 5. ✅
- Dashboard nav → Task 6. ✅
- i18n en+he parity → Tasks 4, 6. ✅
- requireHousehold scoping everywhere; categoryId validated to household → Tasks 2, 3. ✅
- Delete category → items uncategorized (SetNull), not deleted → Task 2 (`deleteCategory`) + verified Task 6 Step 3.4. ✅
- Photos excluded (never touch photoUrl/photoPath) → all tasks. ✅
- Unit tests for pure pieces (default-categories, swapOrder) → Tasks 1, 2. ✅

**Placeholder scan:** UI component tasks (4 Step 3, 5 Step 2) describe the component's behavior + required elements + the exact actions/i18n keys/props to use, rather than full JSX — the data props (server page) and the action signatures they call are fully specified. No `TBD`/"add error handling"/vague requirements. The 21-category data and all action code are given in full.

**Type consistency:** `requireHousehold()`, the `{ok:true}|{ok:false;error}` result shape, `swapOrder`'s `{id,sortOrder}[]` signature, category/item action input shapes, and the `catalog.*` i18n keys are used identically across tasks. `seedDefaultCategories(db, householdId)` accepts the tx client so Task 1 Step 5 can call it inside `createHousehold`'s transaction.

## Setup dependency

None new — the DB (Prisma Postgres) and `.env` are already provisioned from Phase 1. Tasks 1–5 verify offline (typecheck/build/unit tests); Task 6 Step 3's manual smoke test uses the live dev server + DB.
