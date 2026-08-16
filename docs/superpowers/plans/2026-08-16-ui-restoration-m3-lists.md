# M3 Lists Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the original **Lists** experience on the M1/M2 foundation: the list overview (active list + other lists), the shopping-mode detail (progress + grouped items + check-off that auto-updates stock), create/edit item-picker screens, and the carry-over-on-complete flow.

**Architecture:** Continue on branch `feat/ui-restoration`. Reuse the existing Lists/list-item/stock **server actions** and **RSC loaders** (expanded where noted); rebuild the plain `ListsManager`/`ListDetail` into the original design; reuse M2's `AddToListModal`, `BottomSheet`, `ItemImage`, `getItemName`/`getCategoryName`, and `useT()`. Writes call server actions directly + `router.refresh()`.

**Tech Stack:** Next.js 16 (RSC + server actions), React 19, Prisma 6, Tailwind v4, Vitest 4, TypeScript.

## Global Constraints

- **Branch:** `feat/ui-restoration` (do NOT merge to `main` — cutover after M4). Personal git identity (`sharifshayma`).
- **No schema changes / migrations.** Reuse existing actions/cores. The only backend additions are two thin server actions + one small mutation core: `createListWithItems`, `activateList` (+ `setListStatusCore`). Everything else exists (`createList`, `renameList`, `deleteList`, `duplicateList`, `completeList` (carry-over), `addListItem`, `updateListItem`, `removeListItem`, `setListItemBought`).
- **Reference:** the original is `cb425ac:src-vite-legacy/`. Screens: `pages/Lists.jsx` (overview + shopping mode), `pages/CreateList.jsx`, `pages/EditList.jsx`; component `components/CarryOverModal.jsx`.
- **Auto-stock is already handled by the core.** `setListItemBought` → `setListItemBoughtCore` applies the stock delta (gated by `autoTrackStock`/`stockUpdated`) on every toggle. So M3 does **NOT** re-implement the original's manual "update stock on Done" loop — "Done" only completes the list.
- **Deferred (NOT in M3), flagged not dropped:**
  - **Cheapest-price hints** in the shopping view (the `💰 ₪…` line) → **Prices milestone** (consistent with M2's price deferral).
  - **Share buttons + `ShareSheet`** (index + detail) → **M5 (Profile)**. Omit the Share controls in M3.
- **Data mapping (Supabase → Prisma), apply in every port:** `list_items`→`items`, `is_bought`→`isBought`, `item_id`→`itemId`, `li.items`→`li.item`, `created_at`→`createdAt`, `default_unit`→`defaultUnit`, `auto_track_stock`→`autoTrackStock`, `stock_updated`→`stockUpdated`, `li.items.categories`→`li.item.category`. `getItemName`/`getCategoryName` take a `locale` 2nd arg.
- **RTL:** logical CSS properties only (`ps/pe/ms/me/start/end`), never physical. `useT()` for `t`/`locale`/`dir`.
- Each task ends `tsc`+`lint`+`build` clean (and `vitest` where tests exist).

---

## File Structure

**Create:**
- `src/actions/lists-extra.ts` — `createListWithItems`, `activateList` server actions.
- `src/lib/mutations/list-status.ts` — `setListStatusCore` (thin, household-scoped status set).
- `src/lib/format-list-date.ts` + `.test.ts` — the Today/Yesterday/date helper (pure, TDD).
- `src/components/CarryOverModal.tsx` — ported carry-over sheet.
- `src/components/lists/ShoppingList.tsx` — the shopping-mode detail client component.
- `src/components/lists/ListItemPicker.tsx` — shared item-picker (create + edit).
- `src/app/(app)/create-list/page.tsx` + `src/components/lists/CreateListClient.tsx`.
- `src/app/(app)/edit-list/[id]/page.tsx` + `src/components/lists/EditListClient.tsx`.

**Modify:**
- `src/app/(app)/lists/page.tsx` — expand the index loader (items preview, bought counts, `createdAt`).
- `src/components/ListsManager.tsx` — rebuild to the original overview design.
- `src/app/(app)/lists/[id]/page.tsx` — expand the detail loader (item category/notes/autoTrackStock + openLists/stockRows for the Details modal).
- `src/components/ListDetail.tsx` — rebuild to shopping mode (delegates to `ShoppingList.tsx`), or replace its usage.
- `src/components/Icons.tsx` — add `IconBack`, `IconCheck`, `IconCopy`, `IllustrationNoLists` (port from the original Icons.jsx).

---

### Task 1: New actions + status core + date helper (TDD)

**Files:**
- Create: `src/lib/mutations/list-status.ts`, `src/actions/lists-extra.ts`, `src/lib/format-list-date.ts`, `src/lib/format-list-date.test.ts`

**Interfaces:**
- Produces: `setListStatusCore(householdId, { id, status }): Promise<Result>`; `activateList(id): Promise<Result>` (sets status `active`); `createListWithItems({ name, items }): Promise<{ ok: true; id } | { ok: false; error }>` where `items: { itemId: string; quantity: number; unit: string; notes?: string }[]`; and pure `formatListDate(dateISO: string, locale: Locale, nowMs: number): string` → "Today"/"Yesterday"/localized `MMM d` (Hebrew: היום/אתמול).

- [ ] **Step 1: Write the failing test** — `src/lib/format-list-date.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatListDate } from "./format-list-date";

const NOW = Date.UTC(2026, 7, 16, 12, 0, 0); // 2026-08-16 (fixed, no Date.now())

describe("formatListDate", () => {
  it("returns Today for same day", () => {
    expect(formatListDate(new Date(Date.UTC(2026, 7, 16, 8)).toISOString(), "en", NOW)).toBe("Today");
    expect(formatListDate(new Date(Date.UTC(2026, 7, 16, 8)).toISOString(), "he", NOW)).toBe("היום");
  });
  it("returns Yesterday for the prior day", () => {
    expect(formatListDate(new Date(Date.UTC(2026, 7, 15, 8)).toISOString(), "en", NOW)).toBe("Yesterday");
    expect(formatListDate(new Date(Date.UTC(2026, 7, 15, 8)).toISOString(), "he", NOW)).toBe("אתמול");
  });
  it("returns a localized date for older", () => {
    expect(formatListDate(new Date(Date.UTC(2026, 7, 1, 8)).toISOString(), "en", NOW)).toMatch(/Aug/);
  });
});
```

- [ ] **Step 2: Run test → FAIL** (`npx vitest run src/lib/format-list-date.test.ts`).

- [ ] **Step 3: Implement** `src/lib/format-list-date.ts` (port the original `formatDate` from `Lists.jsx`, made pure by taking `nowMs`):

```ts
import type { Locale } from "@/i18n";

export function formatListDate(dateISO: string, locale: Locale, nowMs: number): string {
  const d = new Date(dateISO);
  const now = new Date(nowMs);
  const dayMs = 86400000;
  const diff = nowMs - d.getTime();
  if (diff < dayMs && d.getDate() === now.getDate()) return locale === "he" ? "היום" : "Today";
  if (diff < dayMs * 2) return locale === "he" ? "אתמול" : "Yesterday";
  return d.toLocaleDateString(locale === "he" ? "he-IL" : "en-US", { month: "short", day: "numeric" });
}
```

- [ ] **Step 4: Run test → PASS.**

- [ ] **Step 5: `setListStatusCore`** — `src/lib/mutations/list-status.ts` (mirror the household-scoped guard used by `renameListCore` in `src/lib/mutations/lists.ts`; read it first to match the ownership-check + `Result` type):

```ts
import { prisma } from "@/lib/prisma";
import type { ListStatus } from "@prisma/client";

type Result = { ok: true } | { ok: false; error: string };

export async function setListStatusCore(
  householdId: string,
  input: { id: string; status: ListStatus },
): Promise<Result> {
  // Household-scoped update in one query (matches renameListCore's pattern).
  const res = await prisma.groceryList.updateMany({
    where: { id: input.id, householdId },
    data: { status: input.status },
  });
  if (res.count === 0) return { ok: false, error: "List not found" };
  return { ok: true };
}
```

- [ ] **Step 6: Actions** — `src/actions/lists-extra.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireHousehold } from "@/lib/household-context";
import { getCurrentUser } from "@/lib/auth-guard";
import { createListCore } from "@/lib/mutations/lists";
import { addListItemCore } from "@/lib/mutations/list-items";
import { setListStatusCore } from "@/lib/mutations/list-status";

export async function activateList(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const household = await requireHousehold();
  const res = await setListStatusCore(household.id, { id, status: "active" });
  if (res.ok) { revalidatePath("/lists"); revalidatePath(`/lists/${id}`); }
  return res;
}

export async function createListWithItems(input: {
  name: string;
  items: { itemId: string; quantity: number; unit: string; notes?: string }[];
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const household = await requireHousehold();
  const user = await getCurrentUser();
  const created = await createListCore(household.id, user?.id ?? null, { name: input.name });
  if (!created.ok) return created;
  for (const it of input.items) {
    const added = await addListItemCore(household.id, { listId: created.id, itemId: it.itemId, quantity: it.quantity, unit: it.unit, notes: it.notes });
    if (!added.ok) return added;
  }
  revalidatePath("/lists");
  revalidatePath("/");
  return { ok: true, id: created.id };
}
```

- [ ] **Step 7: Verify** — confirm `createListCore`/`addListItemCore`/`ListStatus` names against the code; `npx tsc --noEmit` clean.

- [ ] **Step 8: Commit** — `git add src/lib/format-list-date.* src/lib/mutations/list-status.ts src/actions/lists-extra.ts && git commit -m "feat(lists): createListWithItems + activateList actions + date helper"`

---

### Task 2: `CarryOverModal` (port)

**Files:**
- Create: `src/components/CarryOverModal.tsx`
- Modify: `src/components/Icons.tsx` (none needed here beyond existing)

**Interfaces:**
- Consumes: `BottomSheet`, `useT`, `getItemName`.
- Produces: `CarryOverModal({ unboughtItems, onCarryOver, onCompleteAnyway, onKeepShopping, saving })` where `unboughtItems: { id; quantity; unit; item: { emoji?; name; nameHe? } | null }[]`. Three actions (Carry Over `bg-green-dark` / Complete Anyway `text-danger` / Keep Shopping).

- [ ] **Step 1: Port** `cb425ac:src-vite-legacy/components/CarryOverModal.jsx` → `src/components/CarryOverModal.tsx`: wrap in `<BottomSheet onClose={onKeepShopping}>` (M2); `"use client"`, named export; `useT()` for `t`; `li.items`→`li.item`, `getItemName(li.item, locale)`; keep the 🛒 header, the item preview list, and the three buttons byte-faithful. The dictionary keys used (`lists.unboughtTitle`, `lists.unboughtMessage` with `{count}`, `lists.carryOver`, `lists.completeAnyway`, `lists.keepShopping`, `lists.saving`) — add any missing ones to both `en.ts`/`he.ts` (EN + HE from the original i18n; if unsure of exact HE, use the strings already visible in `Lists.jsx`/original locale).

- [ ] **Step 2: Verify** `npx tsc --noEmit` clean.

- [ ] **Step 3: Commit** — `git add src/components/CarryOverModal.tsx src/i18n/dictionaries/en.ts src/i18n/dictionaries/he.ts && git commit -m "feat(lists): CarryOverModal (BottomSheet)"`

---

### Task 3: Lists index (overview) — loader + `ListsManager` rebuild

**Files:**
- Modify: `src/app/(app)/lists/page.tsx`, `src/components/ListsManager.tsx`, `src/components/Icons.tsx`

**Interfaces:**
- Loader provides each list `{ id, name, status, createdAt, items: { id, isBought, quantity, unit, notes, item: { emoji, name, nameHe } | null }[] }`.
- `ListsManager` renders the original overview: an **Active list** card (highlighted, "Continue Shopping" → `/lists/{id}`), **other lists** cards (status pill draft/completed, `formatListDate(createdAt, locale, Date.now())`, name, expandable item preview via chevron, actions: **Start Shopping** (draft → `activateList` then `/lists/{id}`) / **View** (completed → `/lists/{id}`), **Edit** (draft → `/edit-list/{id}`), **Duplicate** (`duplicateList` → `/lists/{id}`), **Delete** (confirm → `deleteList`)), the empty state (`IllustrationNoLists` + create), and the **FAB** (`+` → `/create-list`). **No Share button** (deferred).

- [ ] **Step 1: Expand the loader** — `src/app/(app)/lists/page.tsx` select gains `createdAt` and `items: { select: { id, isBought, quantity, unit, notes, item: { select: { emoji, name, nameHe } } } }` (drop the `_count`; compute counts client-side). Pass the full rows to `ListsManager`.

- [ ] **Step 2: Add icons** — port `IconCopy` and `IllustrationNoLists` from `cb425ac:src-vite-legacy/components/Icons.jsx` into `src/components/Icons.tsx` (typed). `IconChevronDown`/`IconTrash` already exist.

- [ ] **Step 3: Rebuild `ListsManager`** — replace the current file with a `"use client"` component porting the **List overview** section of `cb425ac:src-vite-legacy/pages/Lists.jsx` (the `// List overview` return branch). Use `useT()`; wire: Start Shopping → `await activateList(id); router.push('/lists/'+id)`; Continue Shopping/View → `router.push('/lists/'+id)`; Edit → `<Link href={'/edit-list/'+id}>`; Duplicate → `const r = await duplicateList(id); if (r.ok) router.push('/lists/'+r.id)`; Delete → `if (confirm(...)) { const r = await deleteList(id); if (r.ok) router.refresh() }`. Active list = `lists.find(l => l.status === 'active')`; bought/total from `items`. Keep the card markup/classes/strings byte-faithful. **Omit** the Share buttons and the `ShareSheet`.

- [ ] **Step 4: Build + live smoke** — `npm run build` clean; dev: the overview shows the active list highlighted + other lists with working expand/Start/Edit/Duplicate/Delete + FAB.

- [ ] **Step 5: Commit** — `git add "src/app/(app)/lists/page.tsx" src/components/ListsManager.tsx src/components/Icons.tsx && git commit -m "feat(lists): restore list overview (active card + list cards + FAB)"`

---

### Task 4: Lists detail / shopping mode — loader + `ShoppingList`

**Files:**
- Create: `src/components/lists/ShoppingList.tsx`
- Modify: `src/app/(app)/lists/[id]/page.tsx`, `src/components/ListDetail.tsx`, `src/components/Icons.tsx`

**Interfaces:**
- Loader provides the list `{ id, name, status, items: {...with item category + notes + autoTrackStock...} }`, plus `openLists: OpenList[]` and `stockRows: StockRow[]` and the tapped-item full `HomeItem` shape (reuse `@/lib/home-data` types) so the **Details** tap can open M2's `AddToListModal`.
- `ShoppingList` renders the original shopping mode: back header (name + Edit link; **no Share**), a **progress bar** (bought/total + %), items **grouped by category** (unbought first), each row = a check-off button (`setListItemBought` → auto-stock in core), emoji + name (+ `📝 notes`), **Details** button (→ `AddToListModal`), and qty steppers (`updateListItem`) for unbought rows; a **Done** button → if all-or-none bought `completeList({listId, carryOver:false})` then `router.push('/lists')`, else open `CarryOverModal`. **No cheapest-price line** (deferred).

- [ ] **Step 1: Expand the loader** — `src/app/(app)/lists/[id]/page.tsx`: the list `items` select gains `notes` (already), `item.nameHe`, `item.photoUrl`, `item.autoTrackStock`, and `item.category: { select: { name, nameHe, emoji } }`; add `openLists` + `stock` loads (as in the Home loader `src/app/(app)/page.tsx`) mapped to `OpenList[]`/`StockRow[]`. Replace the plain `<ListDetail>` render with `<ShoppingList list={...} openLists={...} stockRows={...} />` (keep `notFound()` for a foreign id). `ListDetail.tsx` may be deleted if fully replaced, or left unused — prefer deleting it and its import.

- [ ] **Step 2: Add icons** — port `IconBack` and `IconCheck` from the original Icons.jsx into `src/components/Icons.tsx`.

- [ ] **Step 3: Build `ShoppingList.tsx`** — `"use client"`, porting the **Shopping mode** branch of `cb425ac:src-vite-legacy/pages/Lists.jsx`. Wire: check-off → `await setListItemBought({ listItemId: li.id, isBought: !li.isBought }); router.refresh()`; qty → `await updateListItem({ listItemId: li.id, quantity: n, unit: li.unit }); router.refresh()`; Details → open `AddToListModal` (item built from `li.item`, its `stockRow` from a Map, `openLists`); Done → `handleDone` per the interface. Group by `li.item?.category` (via `getCategoryName(category, locale)`, `📦 Other` fallback), unbought-first sort. **Remove** the `cheapestPrices`/`💰` code and the Share control. Keep the progress bar, category headers, check circle, and qty steppers byte-faithful.

- [ ] **Step 4: Build + live smoke** — `npm run build` clean; dev: open a list → progress + grouped items; check an item → it strikes through, moves within its group, and its **stock rises** (verify on `/stock`); Done on a partially-bought list → CarryOverModal → Carry Over creates a follow-up list with the un-bought items; Done on all/none → completes directly.

- [ ] **Step 5: Commit** — `git add "src/app/(app)/lists/[id]/page.tsx" src/components/lists/ShoppingList.tsx src/components/Icons.tsx && git rm src/components/ListDetail.tsx 2>/dev/null; git commit -m "feat(lists): restore shopping-mode detail (progress + check-off + carry-over)"`

---

### Task 5: Shared `ListItemPicker` + Create-list page

**Files:**
- Create: `src/components/lists/ListItemPicker.tsx`, `src/app/(app)/create-list/page.tsx`, `src/components/lists/CreateListClient.tsx`

**Interfaces:**
- `ListItemPicker({ items, categories, tags, initialSelected, submitLabel, onSubmit })` — the original CreateList UI: back header, search, tag-filter pills, category pills, items grouped by category with a checkbox + qty steppers, and a bottom action bar (`{submitLabel} (N)`); `onSubmit(selected: { itemId, quantity, unit, notes? }[])`.
- Create page: RSC loads items/categories/tags (same shapes as the Home loader) → `<CreateListClient>` (client) renders `<ListItemPicker>` with `onSubmit` = `createListWithItems({ name: \`${t("nav.lists")} — ${localized date}\`, items })` then `router.push('/lists')`.

- [ ] **Step 1: RSC loader** — `src/app/(app)/create-list/page.tsx` (`dynamic="force-dynamic"`, `requireHousehold`) loads items (`id, name, nameHe, emoji, defaultUnit, categoryId`), categories (`id, name, nameHe, emoji`), tags (`id, name, color, type`) + the item→tagIds map (from `ItemTag`) for the tag filter; renders `<CreateListClient items=... categories=... tags=... tagItemMap=... />`.

- [ ] **Step 2: `ListItemPicker`** — port the picker UI from `cb425ac:src-vite-legacy/pages/CreateList.jsx` (search + tag pills + category pills + grouped checkable items + qty steppers + bottom bar), typed and using `useT()`, `getItemName`/`getCategoryName`. Tag filtering uses the passed `tagItemMap` (no client fetch). Selection state is a `Map<string,{quantity,unit,notes?}>`.

- [ ] **Step 3: `CreateListClient`** — wires `onSubmit` to `createListWithItems` + `router.push('/lists')`; new-list name = `` `${t("nav.lists")} — ${new Date().toLocaleDateString(locale === "he" ? "he-IL" : "en-US", { month: "short", day: "numeric" })}` ``.

- [ ] **Step 4: Build + smoke** — `npm run build` clean (`/create-list` in routes); dev: FAB → pick items (search/category/tag filters work) → Create → lands on `/lists` with the new list containing the picked items.

- [ ] **Step 5: Commit** — `git add "src/app/(app)/create-list/page.tsx" src/components/lists/ListItemPicker.tsx src/components/lists/CreateListClient.tsx src/i18n/dictionaries/en.ts src/i18n/dictionaries/he.ts && git commit -m "feat(lists): create-list item picker page"`

---

### Task 6: Edit-list page

**Files:**
- Create: `src/app/(app)/edit-list/[id]/page.tsx`, `src/components/lists/EditListClient.tsx`

**Interfaces:**
- Edit page: RSC loads the list (household-scoped, `notFound()` on miss) with its current items + the item catalog/categories/tags; `<EditListClient>` reuses `<ListItemPicker>` pre-selected with the list's current items, and on submit **reconciles** the list to the selection (add new, remove dropped, update changed quantities) via `addListItem`/`removeListItem`/`updateListItem`, then `router.push('/lists')`. Also supports renaming (`renameList`).

- [ ] **Step 1: Read the original** — `git show cb425ac:src-vite-legacy/pages/EditList.jsx` (299 lines) — port its structure, but map its Supabase writes to the reconcile-via-actions approach above.

- [ ] **Step 2: RSC loader** — `src/app/(app)/edit-list/[id]/page.tsx` loads the list (`id, name, status, items: { id, itemId, quantity, unit, notes }`) household-scoped + the catalog (items/categories/tags/tagItemMap as in Task 5). `notFound()` if the list isn't in the household.

- [ ] **Step 3: `EditListClient`** — pre-select `ListItemPicker` from the list's items; on submit, diff against the original: `addListItem` for newly-selected items, `removeListItem(listItemId)` for de-selected, `updateListItem` for quantity changes; optional rename via `renameList`. `router.push('/lists')` after.

- [ ] **Step 4: Build + smoke** — `npm run build` clean (`/edit-list/[id]` in routes); dev: Edit a draft list → add/remove/change quantities → save → `/lists` reflects the changes; a foreign list id → 404.

- [ ] **Step 5: Commit** — `git add "src/app/(app)/edit-list/[id]/page.tsx" src/components/lists/EditListClient.tsx && git commit -m "feat(lists): edit-list page"`

---

## Self-Review

**Spec coverage (M3 row):** list index/overview (Task 3) ✓; detail/shopping with check-off→auto-stock (Task 4) ✓; create (Task 5) ✓; edit (Task 6) ✓; carry-over (Task 2 + Task 4 Done flow) ✓.

**Deferred (flagged, intentional):** cheapest-price hints → Prices milestone; Share/ShareSheet → M5. Both in Global Constraints.

**Type consistency:** `createListWithItems` items `{ itemId, quantity, unit, notes? }` matches `addListItemCore`'s input (confirmed). `ShoppingList`/`AddToListModal` reuse the M2 `OpenList`/`StockRow`/`HomeItem` types from `@/lib/home-data`. `setListItemBought({ listItemId, isBought })` and `updateListItem({ listItemId, quantity, unit })` match the existing action signatures. `formatListDate` takes `nowMs` (no `Date.now()` in tests). `completeList({ listId, carryOver })` → `{ carriedOverListId? }` powers the Done/carry-over flow.

**Verify-before-relying:** `setListStatusCore` mirrors `renameListCore`'s `updateMany({ where: { id, householdId } })` + `count === 0` guard — **confirmed** against `src/lib/mutations/lists.ts`. `ListStatus` enum = `draft|active|completed` — confirmed (`prisma/schema.prisma`). `createListCore`/`addListItemCore` signatures — confirmed in M2. The original EditList write semantics (Task 6 Step 1) the implementer confirms by reading the original file.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-16-ui-restoration-m3-lists.md`. Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, two-stage review between tasks.
2. **Inline Execution** — execute tasks in this session with checkpoints.

Which approach?
