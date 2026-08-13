# GroceryApp Migration — Phase 2b (Tags) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add tag CRUD (recipe/store/custom + color) and per-item tag assignment, completing the catalog on the new stack.

**Architecture:** Server actions (`requireHousehold()`-scoped) for tag CRUD + assign/unassign; a `/tags` manager page; and a per-item "Tags" picker modal on `/items`. Mirrors Phase 2a exactly.

**Tech Stack:** Next.js 16, Prisma 6 + Prisma Postgres, better-auth, Tailwind v4, Zod, Vitest — all in place.

## Global Constraints

- Work on branch `next-migration` in `/Users/balanceshayma/Documents/GitHub/GroceryApp`. Never touch `main`.
- Reuse Phase 1/2a conventions: `requireHousehold()` gates every read/mutation; actions return `{ ok: true } | { ok: false; error: string }`; no unscoped `prisma.tag`/`prisma.itemTag` access (all filtered by `household.id`).
- `assignTag`/`unassignTag` MUST verify BOTH the item and the tag belong to the caller's household before touching `ItemTag`.
- Deleting a tag relies on the `ItemTag` FK `onDelete: Cascade` (Phase 1 schema) to remove assignments — no manual cleanup.
- Tag `type` must be one of `recipe | store | custom` (the Prisma `TagType` enum); validate on create/update.
- i18n: add the `catalog.tags` group (+ `catalog.nav.tags`) to BOTH `en.ts` and `he.ts`, identical structure. Client components use the module-level `getDictionary("en")` + `t(d, key)` pattern (as in Phase 2a's `CategoryManager`/`ItemManager` — NOT `useT()`; no `LocaleProvider` is mounted).
- No schema changes; no photos; `ItemTag.notes` stays unused this phase (assignment is a simple toggle).
- `@/*` → `./src/*`. DB (Prisma Postgres) already provisioned; Tasks 1–3 verify offline, Task 4 controller runs the live smoke test.

## File structure (Phase 2b)

```
src/actions/tags.ts                  # createTag/updateTag/deleteTag/assignTag/unassignTag
src/lib/group-tags.ts                # pure groupTagsByType() helper
src/app/(app)/tags/page.tsx          # server page (reads tags + counts)
src/components/TagManager.tsx        # client: grouped list + create/edit/delete
src/app/(app)/items/page.tsx         # MODIFY: also load item tags + household tags
src/components/ItemManager.tsx       # MODIFY: tag chips + "Tags" button + ItemTagPicker modal
src/app/(app)/dashboard/page.tsx     # MODIFY: Tags nav card + count
src/i18n/dictionaries/{en,he}.ts     # MODIFY: add catalog.tags + catalog.nav.tags
```

---

### Task 1: Tag server actions

**Files:**
- Create: `src/actions/tags.ts`

**Interfaces:**
- Consumes: `prisma`, `requireHousehold`, `TagType` from `@prisma/client`.
- Produces: `createTag`, `updateTag`, `deleteTag`, `assignTag`, `unassignTag` — each `Promise<{ ok: true } | { ok: false; error: string }>`.
  - `createTag({ name, type, color? })`, `updateTag({ id, name, type, color? })`, `deleteTag(id)`
  - `assignTag({ itemId, tagId })`, `unassignTag({ itemId, tagId })`

- [ ] **Step 1: Implement `src/actions/tags.ts`**

```ts
"use server";

import { prisma } from "@/lib/prisma";
import { requireHousehold } from "@/lib/household-context";
import { revalidatePath } from "next/cache";
import type { TagType } from "@prisma/client";

type Result = { ok: true } | { ok: false; error: string };

const TAG_TYPES = ["recipe", "store", "custom"] as const;
function isTagType(x: string): x is TagType {
  return (TAG_TYPES as readonly string[]).includes(x);
}
function clean(s: string | undefined | null): string | null {
  const v = (s ?? "").trim();
  return v ? v : null;
}

export async function createTag(input: {
  name: string;
  type: string;
  color?: string;
}): Promise<Result> {
  const household = await requireHousehold();
  const name = clean(input.name);
  if (!name) return { ok: false, error: "Please enter a tag name" };
  if (!isTagType(input.type)) return { ok: false, error: "Invalid tag type" };
  await prisma.tag.create({
    data: {
      householdId: household.id,
      name,
      type: input.type,
      color: clean(input.color) ?? "#3B82F6",
    },
  });
  revalidatePath("/tags");
  revalidatePath("/items");
  return { ok: true };
}

export async function updateTag(input: {
  id: string;
  name: string;
  type: string;
  color?: string;
}): Promise<Result> {
  const household = await requireHousehold();
  const name = clean(input.name);
  if (!name) return { ok: false, error: "Please enter a tag name" };
  if (!isTagType(input.type)) return { ok: false, error: "Invalid tag type" };
  const res = await prisma.tag.updateMany({
    where: { id: input.id, householdId: household.id },
    data: { name, type: input.type, color: clean(input.color) ?? "#3B82F6" },
  });
  if (res.count === 0) return { ok: false, error: "Tag not found" };
  revalidatePath("/tags");
  revalidatePath("/items");
  return { ok: true };
}

export async function deleteTag(id: string): Promise<Result> {
  const household = await requireHousehold();
  // ItemTag rows cascade away via the FK (onDelete: Cascade).
  const res = await prisma.tag.deleteMany({ where: { id, householdId: household.id } });
  if (res.count === 0) return { ok: false, error: "Tag not found" };
  revalidatePath("/tags");
  revalidatePath("/items");
  return { ok: true };
}

// True only if BOTH the item and the tag belong to this household.
async function bothOwned(householdId: string, itemId: string, tagId: string): Promise<boolean> {
  const [item, tag] = await Promise.all([
    prisma.item.findFirst({ where: { id: itemId, householdId }, select: { id: true } }),
    prisma.tag.findFirst({ where: { id: tagId, householdId }, select: { id: true } }),
  ]);
  return Boolean(item && tag);
}

export async function assignTag(input: { itemId: string; tagId: string }): Promise<Result> {
  const household = await requireHousehold();
  if (!(await bothOwned(household.id, input.itemId, input.tagId))) {
    return { ok: false, error: "Item or tag not found" };
  }
  await prisma.itemTag.upsert({
    where: { itemId_tagId: { itemId: input.itemId, tagId: input.tagId } },
    update: {},
    create: { itemId: input.itemId, tagId: input.tagId },
  });
  revalidatePath("/items");
  return { ok: true };
}

export async function unassignTag(input: { itemId: string; tagId: string }): Promise<Result> {
  const household = await requireHousehold();
  if (!(await bothOwned(household.id, input.itemId, input.tagId))) {
    return { ok: false, error: "Item or tag not found" };
  }
  await prisma.itemTag.deleteMany({
    where: { itemId: input.itemId, tagId: input.tagId },
  });
  revalidatePath("/items");
  return { ok: true };
}
```

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: clean/pass. (`itemTag.upsert`'s `where: { itemId_tagId: {...} }` uses the compound `@@id([itemId, tagId])` — if the generated key name differs, tsc will flag it; the compound-id accessor is `itemId_tagId`.)

- [ ] **Step 3: Commit**

```bash
git add src/actions/tags.ts
git commit -m "feat(phase2b): tag actions (CRUD + assign/unassign, household-scoped)"
```

---

### Task 2: groupTagsByType helper (TDD) + Tags page + manager UI + i18n

**Files:**
- Create: `src/lib/group-tags.ts`, `src/app/(app)/tags/page.tsx`, `src/components/TagManager.tsx`
- Test: `src/lib/__tests__/group-tags.test.ts`
- Modify: `src/i18n/dictionaries/en.ts`, `src/i18n/dictionaries/he.ts`

**Interfaces:**
- Produces:
  - `export function groupTagsByType<T extends { type: string }>(tags: T[]): { type: string; tags: T[] }[]` — groups in the fixed order recipe, store, custom; drops empty groups.
  - `/tags` route.

- [ ] **Step 1: Write the failing test for groupTagsByType**

```ts
// src/lib/__tests__/group-tags.test.ts
import { describe, it, expect } from "vitest";
import { groupTagsByType } from "@/lib/group-tags";

const tags = [
  { id: "1", type: "custom" },
  { id: "2", type: "recipe" },
  { id: "3", type: "store" },
  { id: "4", type: "recipe" },
];

describe("groupTagsByType", () => {
  it("groups in fixed order recipe, store, custom", () => {
    const g = groupTagsByType(tags);
    expect(g.map((x) => x.type)).toEqual(["recipe", "store", "custom"]);
    expect(g[0].tags.map((t) => t.id)).toEqual(["2", "4"]);
    expect(g[1].tags.map((t) => t.id)).toEqual(["3"]);
    expect(g[2].tags.map((t) => t.id)).toEqual(["1"]);
  });
  it("drops empty groups", () => {
    const g = groupTagsByType([{ id: "1", type: "store" }]);
    expect(g.map((x) => x.type)).toEqual(["store"]);
  });
  it("returns [] for no tags", () => {
    expect(groupTagsByType([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/lib/__tests__/group-tags.test.ts` — FAIL.

- [ ] **Step 3: Implement `group-tags.ts`**

```ts
// src/lib/group-tags.ts
const TYPE_ORDER = ["recipe", "store", "custom"] as const;

export function groupTagsByType<T extends { type: string }>(
  tags: T[],
): { type: string; tags: T[] }[] {
  return TYPE_ORDER.map((type) => ({
    type,
    tags: tags.filter((t) => t.type === type),
  })).filter((g) => g.tags.length > 0);
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx vitest run src/lib/__tests__/group-tags.test.ts` — PASS.

- [ ] **Step 5: Add the `catalog.tags` + `catalog.nav.tags` i18n keys (both dictionaries)**

In `en.ts`, extend `catalog.nav` with `tags: "Tags"`, and add a `catalog.tags` group; mirror in `he.ts` (Hebrew values):

```ts
// en.ts — catalog.nav gains:  tags: "Tags"
// en.ts — new group under catalog:
tags: {
  title: "Tags",
  add: "Add tag",
  namePlaceholder: "Tag name",
  type: "Type",
  typeRecipe: "Recipe",
  typeStore: "Store",
  typeCustom: "Custom",
  color: "Color",
  save: "Save",
  cancel: "Cancel",
  edit: "Edit",
  delete: "Delete",
  deleteConfirm: "Delete this tag? It will be removed from all items.",
  items: "items",
  empty: "No tags yet.",
  assign: "Tags",
  pickerTitle: "Tags for {name}",
  done: "Done",
},
```

- [ ] **Step 6: Write `src/app/(app)/tags/page.tsx` (server)**

```tsx
import { prisma } from "@/lib/prisma";
import { requireHousehold } from "@/lib/household-context";
import { TagManager } from "@/components/TagManager";

export const dynamic = "force-dynamic";

export default async function TagsPage() {
  const household = await requireHousehold();
  const tags = await prisma.tag.findMany({
    where: { householdId: household.id },
    orderBy: [{ type: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      type: true,
      color: true,
      _count: { select: { items: true } },
    },
  });
  const rows = tags.map((tg) => ({
    id: tg.id,
    name: tg.name,
    type: tg.type,
    color: tg.color,
    itemCount: tg._count.items,
  }));
  return <TagManager tags={rows} />;
}
```

(Note: `_count: { select: { items: true } }` counts the `Tag.items` relation, which is `ItemTag[]` — i.e. the number of assignments.)

- [ ] **Step 7: Write `src/components/TagManager.tsx` (client)**

A `"use client"` component modeled on Phase 2a's `src/components/CategoryManager.tsx` (read it and mirror its state/pending/error handling, imports, and the module-level `const d = getDictionary("en")` + `t(d, ...)` pattern). It receives `tags: { id, name, type, color, itemCount }[]`, groups them with `groupTagsByType`, and renders each type group (label via `catalog.tags.typeRecipe|typeStore|typeCustom`, with icons 🍽️/🏪/🏷️) as rows showing a color swatch + name + `itemCount` + `catalog.tags.items`, each with Edit and Delete (`confirm()` using `catalog.tags.deleteConfirm`). An inline **Add tag** form: name (`Input`), type (`<select>` of recipe/store/custom), color (`<input type="color">`). Calls `createTag`/`updateTag`/`deleteTag` from `@/actions/tags`; on `ok` → `router.refresh()`; failure → show error. Disable buttons while a mutation is in flight.

- [ ] **Step 8: Typecheck + tests + build**

Run: `npx tsc --noEmit && npx vitest run src/lib/__tests__/group-tags.test.ts && npm run build`
Expected: clean/pass; `/tags` compiles.

- [ ] **Step 9: Commit**

```bash
git add src/lib/group-tags.ts src/lib/__tests__/group-tags.test.ts "src/app/(app)/tags" src/components/TagManager.tsx src/i18n/dictionaries/en.ts src/i18n/dictionaries/he.ts
git commit -m "feat(phase2b): tags page + manager UI + group helper + i18n"
```

---

### Task 3: Per-item tag assignment (items page + ItemManager)

**Files:**
- Modify: `src/app/(app)/items/page.tsx`, `src/components/ItemManager.tsx`

**Interfaces:**
- Consumes: `assignTag`, `unassignTag` from `@/actions/tags`; the tag list + each item's assigned tags.

- [ ] **Step 1: Extend `items/page.tsx` to load tags**

Add to the item `select` a `tags` relation, and fetch the household's tag list; pass both to `ItemManager`:

```tsx
import { prisma } from "@/lib/prisma";
import { requireHousehold } from "@/lib/household-context";
import { ItemManager } from "@/components/ItemManager";

export const dynamic = "force-dynamic";

export default async function ItemsPage() {
  const household = await requireHousehold();
  const [items, categories, tags] = await Promise.all([
    prisma.item.findMany({
      where: { householdId: household.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, nameHe: true, emoji: true, defaultUnit: true,
        notes: true, categoryId: true,
        category: { select: { name: true, emoji: true } },
        tags: { select: { tag: { select: { id: true, name: true, color: true } } } },
      },
    }),
    prisma.category.findMany({
      where: { householdId: household.id },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, emoji: true },
    }),
    prisma.tag.findMany({
      where: { householdId: household.id },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, name: true, type: true, color: true },
    }),
  ]);
  return <ItemManager items={items} categories={categories} tags={tags} />;
}
```

- [ ] **Step 2: Extend `ItemManager.tsx`**

Add to the component:
- New prop `tags: { id: string; name: string; type: string; color: string }[]` (all household tags).
- Extend `ItemRow` with `tags: { tag: { id: string; name: string; color: string } }[]`.
- On each item row: render the assigned tags as **chips** (small pill with the tag's color as background/border + name). If none, render nothing (or a subtle placeholder).
- Add a **"Tags"** button per row (label `t(d,"catalog.tags.assign")`) that opens an `ItemTagPicker` modal for that item.
- `ItemTagPicker` (a component in the same file or a sibling `src/components/ItemTagPicker.tsx`): receives the item's id + its currently-assigned tag ids + the full `tags` list. Groups tags with `groupTagsByType` and renders each as a toggle row (checkbox / highlighted when assigned). Toggling calls `assignTag({itemId, tagId})` or `unassignTag({itemId, tagId})` from `@/actions/tags`, then `router.refresh()`; show any error. A Done/close button (`catalog.tags.done`) closes the modal. Use the same modal styling as the existing item add/edit modal (`role="dialog"`, close on Escape/Cancel).

Keep the existing item create/edit form and its behavior unchanged.

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: clean; `/items` compiles.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/items/page.tsx" src/components/ItemManager.tsx src/components/ItemTagPicker.tsx
git commit -m "feat(phase2b): per-item tag assignment (chips + Tags picker)"
```

(If `ItemTagPicker` is kept inline in `ItemManager.tsx`, drop it from the `git add`.)

---

### Task 4: Dashboard Tags card + verification

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Add a Tags card + count to the dashboard**

In `src/app/(app)/dashboard/page.tsx`, add a third count (`prisma.tag.count({ where: { householdId: household.id } })`) and a third `<Link href="/tags">` card labeled `t(d, "catalog.nav.tags")` with the count, alongside the existing Categories and Items cards (adjust the grid to fit three).

- [ ] **Step 2: Full offline verification**

Run: `npx tsc --noEmit && npm run test && npm run lint && npm run build`
Expected: all pass (tests: group-tags + Phase-1/2a suites; lint 0/0; build compiles `/tags`, `/items`, `/dashboard`).

- [ ] **Step 3: Manual smoke test** (controller runs this — dev server + live DB)

With a signed-in household: `/tags` → create a recipe, store, and custom tag (each a color) → they group by type with counts 0; on `/items`, open an item's **Tags** picker → assign two tags → chips appear on the row → unassign one → chip removed; the tag's item count on `/tags` reflects it; delete a tag → its chip disappears from the item and the item still exists; `/dashboard` shows the tag count. Confirm no cross-household leakage. Clean up test rows.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/dashboard/page.tsx"
git commit -m "feat(phase2b): dashboard tags card + count"
```

---

## Self-Review

**Spec coverage:**
- Tag CRUD (create/update/delete, type-validated, scoped) → Task 1. ✅
- assign/unassign with both-owned check → Task 1. ✅
- delete-tag cascades assignments (FK) → Task 1 (`deleteTag`) + verified Task 4 Step 3. ✅
- Tags page grouped by type with counts → Task 2. ✅
- Per-item Tags picker + chips → Task 3. ✅
- Dashboard Tags card → Task 4. ✅
- i18n en+he parity (`catalog.tags`, `catalog.nav.tags`) → Task 2. ✅
- Pure helper (groupTagsByType) unit-tested → Task 2. ✅
- Notes deferred (ItemTag.notes untouched) → all tasks. ✅

**Placeholder scan:** Action + helper + page code given in full. The two client UI components (TagManager Task 2 Step 7, ItemTagPicker Task 3 Step 2) describe the required elements, props, the exact actions to call, and the i18n keys, and point to the Phase-2a component to mirror — the data shapes they consume are fully specified. No `TBD`/"add validation"/vague requirements.

**Type consistency:** `requireHousehold()`, the `{ok:true}|{ok:false;error}` shape, `groupTagsByType`'s signature, the tag row shape `{id,name,type,color,itemCount}`, the item `tags: {tag:{id,name,color}}[]` shape, and the `assignTag`/`unassignTag` `{itemId,tagId}` inputs are used identically across Tasks 1–4. `itemTag.upsert` uses the compound-id key `itemId_tagId` from `@@id([itemId, tagId])`.

## Setup dependency

None new — DB provisioned in Phase 1. Tasks 1–3 verify offline; Task 4 Step 3's live smoke test is run by the controller (dev server + live Prisma Postgres).
