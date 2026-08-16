# GroceryApp Migration — Phase 3a (Lists + list items) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add shopping-list CRUD (create/rename/delete/duplicate) and management of a list's items (add from catalog, edit, remove), with `/lists` index and `/lists/[id]` detail pages.

**Architecture:** Server actions (`requireHousehold()`-scoped) for list + list-item mutations; server-component pages read via Prisma; client components handle forms and call actions then `router.refresh()`. List-item ownership is verified through the parent list (list_items carry no householdId). Mirrors Phase 2.

**Tech Stack:** Next.js 16, Prisma 6 + Prisma Postgres, better-auth, Tailwind v4, Zod, Vitest — all in place.

## Global Constraints

- Work on branch `next-migration` in `/Users/balanceshayma/Documents/GitHub/GroceryApp`. Never touch `main`.
- Reuse Phase 1/2 conventions: `requireHousehold()` gates every read/mutation; actions return `{ ok: true } | { ok: false; error: string }` (list-creating actions also return `id`); no unscoped `prisma.groceryList`/`prisma.listItem` access.
- **List-item ownership is verified through the parent list's `householdId`** (list_items have no household of their own) — never mutate a list_item without confirming its list belongs to the caller's household. `addListItem` also verifies the catalog item belongs to the household.
- Lists are created with `status: "draft"`. Phase 3a does NOT transition status (Phase 3b sets `completed`). Grouping is open (`draft`|`active`) vs `completed`.
- Deleting a list cascades its list_items (FK `onDelete: Cascade`). Deleting a catalog item cascades its list_items too (`ListItem.item` is `onDelete: Cascade`) — not this phase's concern, but don't assume SetNull.
- i18n: add a `lists` group (+ `catalog.nav.lists`) to BOTH `en.ts` and `he.ts`, identical structure. Client components use module-level `getDictionary("en")` + `t(d, key)` (as in Phase 2 — no `useT()`).
- No schema changes. `quantity` is `Float`; `unit` is a string. `isBought`/`boughtBy`/`boughtAt`/`stockUpdated` are untouched (Phase 3b).
- `@/*` → `./src/*`. DB provisioned (Phase 1). Tasks 1–4 verify offline; Task 5 controller runs the live smoke test.

## File structure (Phase 3a)

```
src/actions/lists.ts                 # createList/renameList/deleteList/duplicateList
src/actions/list-items.ts            # addListItem/updateListItem/removeListItem (+ ownership helpers)
src/lib/partition-lists.ts           # pure partitionLists() → {open, completed}
src/app/(app)/lists/page.tsx         # server: lists index (open vs completed + counts)
src/components/ListsManager.tsx      # client: create + per-row rename/delete/duplicate/link
src/app/(app)/lists/[id]/page.tsx    # server: one list + its items + catalog items
src/components/ListDetail.tsx        # client: items, add-item picker, edit/remove, rename/delete/duplicate
src/app/(app)/dashboard/page.tsx     # MODIFY: Lists nav card + count
src/i18n/dictionaries/{en,he}.ts     # MODIFY: add lists i18n + catalog.nav.lists
```

---

### Task 1: List server actions

**Files:**
- Create: `src/actions/lists.ts`

**Interfaces:**
- Produces (all `Promise`, `requireHousehold()`-scoped):
  - `createList({ name }): { ok: true; id: string } | { ok: false; error: string }`
  - `renameList({ id, name }): { ok: true } | { ok: false; error: string }`
  - `deleteList(id): { ok: true } | { ok: false; error: string }`
  - `duplicateList(id): { ok: true; id: string } | { ok: false; error: string }`

- [ ] **Step 1: Implement `src/actions/lists.ts`**

```ts
"use server";

import { prisma } from "@/lib/prisma";
import { requireHousehold } from "@/lib/household-context";
import { getCurrentUser } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";

type Result = { ok: true } | { ok: false; error: string };
type CreateResult = { ok: true; id: string } | { ok: false; error: string };

function clean(s: string | undefined | null): string | null {
  const v = (s ?? "").trim();
  return v ? v : null;
}

export async function createList({ name }: { name: string }): Promise<CreateResult> {
  const household = await requireHousehold();
  const user = await getCurrentUser();
  const cleaned = clean(name);
  if (!cleaned) return { ok: false, error: "Please enter a list name" };
  const list = await prisma.groceryList.create({
    data: { householdId: household.id, name: cleaned, status: "draft", createdById: user?.id ?? null },
    select: { id: true },
  });
  revalidatePath("/lists");
  return { ok: true, id: list.id };
}

export async function renameList({ id, name }: { id: string; name: string }): Promise<Result> {
  const household = await requireHousehold();
  const cleaned = clean(name);
  if (!cleaned) return { ok: false, error: "Please enter a list name" };
  const res = await prisma.groceryList.updateMany({
    where: { id, householdId: household.id },
    data: { name: cleaned },
  });
  if (res.count === 0) return { ok: false, error: "List not found" };
  revalidatePath("/lists");
  revalidatePath(`/lists/${id}`);
  return { ok: true };
}

export async function deleteList(id: string): Promise<Result> {
  const household = await requireHousehold();
  // ListItem rows cascade via the FK.
  const res = await prisma.groceryList.deleteMany({ where: { id, householdId: household.id } });
  if (res.count === 0) return { ok: false, error: "List not found" };
  revalidatePath("/lists");
  return { ok: true };
}

export async function duplicateList(id: string): Promise<CreateResult> {
  const household = await requireHousehold();
  const user = await getCurrentUser();
  const source = await prisma.groceryList.findFirst({
    where: { id, householdId: household.id },
    select: {
      name: true,
      items: { select: { itemId: true, quantity: true, unit: true, notes: true } },
    },
  });
  if (!source) return { ok: false, error: "List not found" };
  const copy = await prisma.groceryList.create({
    data: {
      householdId: household.id,
      name: `${source.name} (copy)`,
      status: "draft",
      createdById: user?.id ?? null,
      items: {
        create: source.items.map((li) => ({
          itemId: li.itemId,
          quantity: li.quantity,
          unit: li.unit,
          notes: li.notes,
        })),
      },
    },
    select: { id: true },
  });
  revalidatePath("/lists");
  return { ok: true, id: copy.id };
}
```

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: clean/pass.

- [ ] **Step 3: Commit**

```bash
git add src/actions/lists.ts
git commit -m "feat(phase3a): list actions (create/rename/delete/duplicate)"
```

---

### Task 2: List-item server actions

**Files:**
- Create: `src/actions/list-items.ts`

**Interfaces:**
- Produces (all `Promise<{ ok: true } | { ok: false; error: string }>`, `requireHousehold()`-scoped):
  - `addListItem({ listId, itemId, quantity, unit, notes? })`
  - `updateListItem({ listItemId, quantity, unit, notes? })`
  - `removeListItem(listItemId)`

- [ ] **Step 1: Implement `src/actions/list-items.ts`**

```ts
"use server";

import { prisma } from "@/lib/prisma";
import { requireHousehold } from "@/lib/household-context";
import { revalidatePath } from "next/cache";

type Result = { ok: true } | { ok: false; error: string };

function clean(s: string | undefined | null): string | null {
  const v = (s ?? "").trim();
  return v ? v : null;
}

// True iff the list belongs to the household.
async function listOwned(householdId: string, listId: string): Promise<boolean> {
  const list = await prisma.groceryList.findFirst({
    where: { id: listId, householdId },
    select: { id: true },
  });
  return Boolean(list);
}

// Returns the list_item's listId iff its parent list belongs to the household, else null.
async function listItemListId(householdId: string, listItemId: string): Promise<string | null> {
  const li = await prisma.listItem.findFirst({
    where: { id: listItemId, list: { householdId } },
    select: { listId: true },
  });
  return li?.listId ?? null;
}

export async function addListItem(input: {
  listId: string;
  itemId: string;
  quantity: number;
  unit: string;
  notes?: string;
}): Promise<Result> {
  const household = await requireHousehold();
  if (!(await listOwned(household.id, input.listId))) return { ok: false, error: "List not found" };
  const item = await prisma.item.findFirst({
    where: { id: input.itemId, householdId: household.id },
    select: { id: true },
  });
  if (!item) return { ok: false, error: "Item not found" };
  await prisma.listItem.create({
    data: {
      listId: input.listId,
      itemId: input.itemId,
      quantity: Number.isFinite(input.quantity) && input.quantity > 0 ? input.quantity : 1,
      unit: clean(input.unit) ?? "pcs",
      notes: clean(input.notes),
    },
  });
  revalidatePath(`/lists/${input.listId}`);
  revalidatePath("/lists");
  return { ok: true };
}

export async function updateListItem(input: {
  listItemId: string;
  quantity: number;
  unit: string;
  notes?: string;
}): Promise<Result> {
  const household = await requireHousehold();
  const listId = await listItemListId(household.id, input.listItemId);
  if (!listId) return { ok: false, error: "List item not found" };
  await prisma.listItem.update({
    where: { id: input.listItemId },
    data: {
      quantity: Number.isFinite(input.quantity) && input.quantity > 0 ? input.quantity : 1,
      unit: clean(input.unit) ?? "pcs",
      notes: clean(input.notes),
    },
  });
  revalidatePath(`/lists/${listId}`);
  return { ok: true };
}

export async function removeListItem(listItemId: string): Promise<Result> {
  const household = await requireHousehold();
  const listId = await listItemListId(household.id, listItemId);
  if (!listId) return { ok: false, error: "List item not found" };
  await prisma.listItem.delete({ where: { id: listItemId } });
  revalidatePath(`/lists/${listId}`);
  return { ok: true };
}
```

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: clean/pass.

- [ ] **Step 3: Commit**

```bash
git add src/actions/list-items.ts
git commit -m "feat(phase3a): list-item actions (add/update/remove, list-scoped ownership)"
```

---

### Task 3: partitionLists helper (TDD) + Lists index page + UI + i18n

**Files:**
- Create: `src/lib/partition-lists.ts`, `src/app/(app)/lists/page.tsx`, `src/components/ListsManager.tsx`
- Test: `src/lib/__tests__/partition-lists.test.ts`
- Modify: `src/i18n/dictionaries/en.ts`, `src/i18n/dictionaries/he.ts`

**Interfaces:**
- Produces: `partitionLists<T extends { status: string }>(lists: T[]): { open: T[]; completed: T[] }` — `open` = status `draft` or `active`, preserving input order; `completed` = status `completed`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/__tests__/partition-lists.test.ts
import { describe, it, expect } from "vitest";
import { partitionLists } from "@/lib/partition-lists";

const lists = [
  { id: "a", status: "draft" },
  { id: "b", status: "completed" },
  { id: "c", status: "active" },
  { id: "d", status: "completed" },
];

describe("partitionLists", () => {
  it("splits into open (draft|active) and completed, preserving order", () => {
    const { open, completed } = partitionLists(lists);
    expect(open.map((l) => l.id)).toEqual(["a", "c"]);
    expect(completed.map((l) => l.id)).toEqual(["b", "d"]);
  });
  it("handles empty input", () => {
    expect(partitionLists([])).toEqual({ open: [], completed: [] });
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/lib/__tests__/partition-lists.test.ts` — FAIL.

- [ ] **Step 3: Implement `partition-lists.ts`**

```ts
// src/lib/partition-lists.ts
export function partitionLists<T extends { status: string }>(
  lists: T[],
): { open: T[]; completed: T[] } {
  const open: T[] = [];
  const completed: T[] = [];
  for (const l of lists) {
    if (l.status === "completed") completed.push(l);
    else open.push(l); // draft | active
  }
  return { open, completed };
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx vitest run src/lib/__tests__/partition-lists.test.ts` — PASS.

- [ ] **Step 5: Add the `lists` i18n group + `catalog.nav.lists` (both dictionaries)**

Extend `catalog.nav` with `lists: "Lists"`, and add a top-level `lists` group to `en.ts` (mirror in `he.ts` with Hebrew values):

```ts
lists: {
  title: "Lists",
  create: "Create list",
  namePlaceholder: "List name",
  open: "Open",
  completed: "Completed",
  itemsCount: "items",
  emptyOpen: "No open lists.",
  emptyCompleted: "No completed lists.",
  rename: "Rename",
  duplicate: "Duplicate",
  delete: "Delete",
  deleteConfirm: "Delete this list?",
  open_action: "Open",
  back: "Back to lists",
  addItem: "Add item",
  chooseItem: "Choose an item",
  quantity: "Quantity",
  unit: "Unit",
  notes: "Notes",
  save: "Save",
  cancel: "Cancel",
  edit: "Edit",
  remove: "Remove",
  removeConfirm: "Remove this item from the list?",
  emptyItems: "No items yet. Add one from your catalog.",
  unknownItem: "(removed item)",
},
```

- [ ] **Step 6: Write `src/app/(app)/lists/page.tsx` (server)**

```tsx
import { prisma } from "@/lib/prisma";
import { requireHousehold } from "@/lib/household-context";
import { ListsManager } from "@/components/ListsManager";

export const dynamic = "force-dynamic";

export default async function ListsPage() {
  const household = await requireHousehold();
  const lists = await prisma.groceryList.findMany({
    where: { householdId: household.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      status: true,
      _count: { select: { items: true } },
    },
  });
  const rows = lists.map((l) => ({
    id: l.id,
    name: l.name,
    status: l.status,
    itemCount: l._count.items,
  }));
  return <ListsManager lists={rows} />;
}
```

- [ ] **Step 7: Write `src/components/ListsManager.tsx` (client)**

A `"use client"` component modeled on Phase 2's `CategoryManager.tsx` (mirror its state/pending/error handling, module-level `getDictionary("en")`+`t`). It receives `lists: { id, name, status, itemCount }[]`, splits with `partitionLists`, and renders an **Open** section and a **Completed** section (headings via `lists.open`/`lists.completed`; empty states). Each row: a `<Link href={`/lists/${id}`}>` on the name + `itemCount` + `lists.itemsCount`, and inline **Rename** (calls `renameList({id,name})`), **Duplicate** (`duplicateList(id)` → on ok `router.push(`/lists/${res.id}`)`), **Delete** (`confirm()` → `deleteList(id)`). A top **Create list** inline form (name → `createList({name})` → on ok `router.push(`/lists/${res.id}`)`). Uses `Button`/`Input`; disables buttons while pending; `router.refresh()` after rename/delete.

- [ ] **Step 8: Typecheck + test + build**

Run: `npx tsc --noEmit && npx vitest run src/lib/__tests__/partition-lists.test.ts && npm run build`
Expected: clean/pass; `/lists` compiles.

- [ ] **Step 9: Commit**

```bash
git add src/lib/partition-lists.ts src/lib/__tests__/partition-lists.test.ts "src/app/(app)/lists/page.tsx" src/components/ListsManager.tsx src/i18n/dictionaries/en.ts src/i18n/dictionaries/he.ts
git commit -m "feat(phase3a): lists index page + manager UI + partition helper + i18n"
```

---

### Task 4: List detail page + ListDetail UI

**Files:**
- Create: `src/app/(app)/lists/[id]/page.tsx`, `src/components/ListDetail.tsx`

**Interfaces:**
- Consumes: list actions (`renameList`/`deleteList`/`duplicateList`), list-item actions (`addListItem`/`updateListItem`/`removeListItem`), i18n, `Button`/`Input`.

- [ ] **Step 1: Write `src/app/(app)/lists/[id]/page.tsx` (server)**

```tsx
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireHousehold } from "@/lib/household-context";
import { ListDetail } from "@/components/ListDetail";

export const dynamic = "force-dynamic";

export default async function ListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const household = await requireHousehold();
  const { id } = await params;
  const [list, catalogItems] = await Promise.all([
    prisma.groceryList.findFirst({
      where: { id, householdId: household.id },
      select: {
        id: true,
        name: true,
        status: true,
        items: {
          orderBy: { id: "asc" },
          select: {
            id: true,
            quantity: true,
            unit: true,
            notes: true,
            item: { select: { id: true, name: true, emoji: true, defaultUnit: true } },
          },
        },
      },
    }),
    prisma.item.findMany({
      where: { householdId: household.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true, emoji: true, defaultUnit: true },
    }),
  ]);
  if (!list) notFound();
  return <ListDetail list={list} catalogItems={catalogItems} />;
}
```

- [ ] **Step 2: Write `src/components/ListDetail.tsx` (client)**

A `"use client"` component (model its patterns on Phase 2's `ItemManager.tsx`/`CategoryManager.tsx`). Props:
- `list: { id, name, status, items: { id, quantity, unit, notes, item: { id, name, emoji, defaultUnit } | null }[] }`
- `catalogItems: { id, name, emoji, defaultUnit }[]`

Renders:
- A header with a **Back to lists** link (`/lists`), the list name with inline **Rename** (`renameList`), **Duplicate** (`duplicateList(id)` → `router.push`), **Delete** (`confirm()` → `deleteList(id)` → `router.push("/lists")`).
- The list's items: each row shows `item.emoji item.name` (or `lists.unknownItem` when `item` is null) + `quantity` + `unit` + optional `notes`, with **Edit** (inline form editing quantity/unit/notes → `updateListItem({listItemId,quantity,unit,notes})`) and **Remove** (`confirm()` on `lists.removeConfirm` → `removeListItem(id)`). Empty state `lists.emptyItems`.
- An **Add item** form: a `<select>` of `catalogItems` (value = id, label = `emoji name`), a quantity `Input` (type number, default 1), a unit `Input` (prefill with the chosen item's `defaultUnit` when an item is selected; default "pcs"), an optional notes `Input`. On submit → `addListItem({listId: list.id, itemId, quantity: Number(quantity), unit, notes})`; on `ok` → `router.refresh()`, reset the form; on failure → show the error. Disable submit while pending.

All actions `router.refresh()` on success and show returned errors on failure.

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: clean; `/lists/[id]` compiles.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/lists/[id]" src/components/ListDetail.tsx
git commit -m "feat(phase3a): list detail page + items + add-item picker"
```

---

### Task 5: Dashboard Lists card + verification

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Add a Lists card + count**

In `src/app/(app)/dashboard/page.tsx`, add a fourth count — open lists: `prisma.groceryList.count({ where: { householdId: household.id, status: { in: ["draft", "active"] } } })` — and a fourth `<Link href="/lists">` card labeled `t(d, "catalog.nav.lists")` with the count, alongside Categories/Items/Tags. Change the grid to `sm:grid-cols-4` (or `sm:grid-cols-2 lg:grid-cols-4`). Keep everything else intact. `catalog.nav.lists` was added in Task 3.

- [ ] **Step 2: Full offline verification**

Run: `npx tsc --noEmit && npm run test && npm run lint && npm run build`
Expected: all pass (tests: partition-lists + prior suites; lint 0/0; build compiles `/lists`, `/lists/[id]`, `/dashboard`).

- [ ] **Step 3: Manual smoke test** (controller runs this — dev server + live DB)

Signed-in household with catalog items: `/lists` create a list → land on `/lists/<id>` → add two catalog items with quantities/units → edit one's quantity + notes → remove one → rename the list → **duplicate** it (the copy has the same items) → delete the original → `/dashboard` shows the open-list count. Confirm the detail page 404s for a list id from another household (scoping). Clean up test rows.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/dashboard/page.tsx"
git commit -m "feat(phase3a): dashboard lists card + open-list count"
```

---

## Self-Review

**Spec coverage:**
- List CRUD (create/rename/delete/duplicate, scoped) → Task 1. ✅
- List-item add/update/remove, ownership via parent list, add verifies item ownership → Task 2. ✅
- Delete list cascades items (FK) → Task 1 (`deleteList`). ✅
- `/lists` index (open vs completed + counts) → Task 3. ✅
- `/lists/[id]` detail (items + add picker + edit/remove + rename/delete/duplicate + notFound) → Task 4. ✅
- Dashboard Lists card → Task 5. ✅
- i18n en+he parity (`lists`, `catalog.nav.lists`) → Task 3. ✅
- Pure helper (partitionLists) unit-tested → Task 3. ✅
- Status: created draft; no transition this phase; shopping/carry-over deferred to 3b → all tasks. ✅

**Placeholder scan:** Action + helper + page code given in full. The two client UI components (Task 3 Step 7 `ListsManager`, Task 4 Step 2 `ListDetail`) specify required elements, props, the exact actions to call with their argument shapes, and the i18n keys, and point to the Phase-2 component to mirror. No `TBD`/vague requirements.

**Type consistency:** `requireHousehold()`, the `{ok:true}|{ok:false;error}` shape (+ `id` for create/duplicate), the list row `{id,name,status,itemCount}`, the detail list shape (`items[].item` nullable), and the `addListItem`/`updateListItem`/`removeListItem` inputs are used identically across tasks. `partitionLists` signature matches its consumer in `ListsManager`. Item-delete is Cascade (not SetNull), consistent with the schema.

## Setup dependency

None new — DB provisioned in Phase 1. Tasks 1–4 verify offline; Task 5 Step 3's live smoke test is run by the controller (dev server + live Prisma Postgres).
