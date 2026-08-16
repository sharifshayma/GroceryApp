# M4 Stock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the original **Stock** screen on the M1–M3 foundation: category-grouped stock levels with low-stock highlighting, quantity steppers, inline threshold editing, an auto-track settings panel, add-to-stock (in/out) and edit-stock sheets, and a low-stock filter.

**Architecture:** Continue on branch `feat/ui-restoration`. Reuse the existing stock server actions (`setStock` upsert, `adjustStock` delta, `removeStock`) + the current comprehensive stock loader (expanded for category grouping + auto-track), plus one small new action (`setAutoTrackStock`). Rebuild the plain `StockManager` into the original design; reuse M2's `BottomSheet`/`ItemImage`, `useT()`, and `getItemName`/`getCategoryName`.

**Tech Stack:** Next.js 16 (RSC + server actions), React 19, Prisma 6, Tailwind v4, Vitest 4, TypeScript.

## Global Constraints

- **Branch:** `feat/ui-restoration` (do NOT merge to `main` yet — the **M1–M4 cutover** happens after this milestone). Personal git identity (`sharifshayma`).
- **No schema changes / migrations.** Reuse existing actions/cores. The ONLY backend addition is one thin, household-scoped action: `setAutoTrackStock` (+ a `setAutoTrackStockCore` or an inline `updateMany`). Do NOT toggle auto-track via `updateItem`/`updateItemCore` — that core **nulls every omitted field** (`nameHe`, `notes`, resets `emoji`→🛒, `defaultUnit`→pcs, clears category), so it would destroy item data. Only `autoTrackStock` is guarded there; a single-field action avoids the trap.
- **Reference:** the original is `cb425ac:src-vite-legacy/pages/Stock.jsx` (main screen + `AddToStockModal` + `EditStockModal`) and `components/Toggle.jsx`. Match them.
- **Stock actions are keyed by `itemId`** (the new app has one Stock row per item). `adjustStock({ itemId, delta })` for +/− steppers; `setStock({ itemId, quantity, unit, lowThreshold })` (upsert) for threshold edits, the edit sheet, and batch add; `removeStock(itemId)` for delete. The original keyed by the stock-row `s.id` — map every such call to `itemId`.
- **Data mapping (Supabase → Prisma):** `s.items`→`s.item`, `low_threshold`→`lowThreshold`, `item_id`→`itemId`, `default_unit`→`defaultUnit`, `auto_track_stock`→`autoTrackStock`, `s.items.categories`→`s.item.category`, `sort_order`→`sortOrder`, `category_id`→`categoryId`. `getItemName`/`getCategoryName` take a `locale` 2nd arg.
- **RTL:** logical CSS properties only. `useT()` for `t`/`locale`. All hooks at top (no hook after an early return). No `Date.now()`/`new Date()` in client render.
- Each task ends `tsc`+`lint`+`build` clean.

---

## File Structure

**Create:**
- `src/lib/mutations/auto-track.ts` — `setAutoTrackStockCore` (household-scoped single-field update).
- `src/actions/stock-extra.ts` — `setAutoTrackStock` server action.
- `src/components/Toggle.tsx` — ported switch.
- `src/components/stock/AddToStockModal.tsx`, `src/components/stock/EditStockModal.tsx` — ported sheets.

**Modify:**
- `src/app/(app)/stock/page.tsx` — expand the loader (stock item `category` + `nameHe`/`photoUrl`; catalog `autoTrackStock` + `categoryId`; categories with `sortOrder`; pass `lowStockCount`).
- `src/components/StockManager.tsx` — rebuild to the original design.
- `src/components/Icons.tsx` — add `IllustrationNoItems` (port from the original Icons.jsx; `IconSettings` already exists).

---

### Task 1: `setAutoTrackStock` action + `Toggle` + loader expansion + icon

**Files:**
- Create: `src/lib/mutations/auto-track.ts`, `src/actions/stock-extra.ts`, `src/components/Toggle.tsx`
- Modify: `src/app/(app)/stock/page.tsx`, `src/components/Icons.tsx`

**Interfaces:**
- Produces: `setAutoTrackStockCore(householdId, { itemId, autoTrackStock }): Promise<Result>`; `setAutoTrackStock(itemId: string, autoTrackStock: boolean): Promise<Result>`; `Toggle({ checked, onChange, ariaLabel })`; an expanded stock loader that passes the data `StockManager` needs; `IllustrationNoItems` icon.

- [ ] **Step 1: Core** — `src/lib/mutations/auto-track.ts` (mirror `setListStatusCore`'s `updateMany` + `count` guard):

```ts
import { prisma } from "@/lib/prisma";

type Result = { ok: true } | { ok: false; error: string };

export async function setAutoTrackStockCore(
  householdId: string,
  input: { itemId: string; autoTrackStock: boolean },
): Promise<Result> {
  const res = await prisma.item.updateMany({
    where: { id: input.itemId, householdId },
    data: { autoTrackStock: input.autoTrackStock },
  });
  if (res.count === 0) return { ok: false, error: "Item not found" };
  return { ok: true };
}
```

- [ ] **Step 2: Action** — `src/actions/stock-extra.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireHousehold } from "@/lib/household-context";
import { setAutoTrackStockCore } from "@/lib/mutations/auto-track";

export async function setAutoTrackStock(
  itemId: string,
  autoTrackStock: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const household = await requireHousehold();
  const res = await setAutoTrackStockCore(household.id, { itemId, autoTrackStock });
  if (res.ok) { revalidatePath("/stock"); revalidatePath("/"); }
  return res;
}
```

- [ ] **Step 3: `Toggle`** — port `cb425ac:src-vite-legacy/components/Toggle.jsx` → `src/components/Toggle.tsx`: `"use client"`, named export, typed `({ checked, onChange, ariaLabel }: { checked: boolean; onChange: () => void; ariaLabel?: string })`; keep the `role="switch"`, `bg-green`/`bg-neutral/40`, and the logical `start-[22px]`/`start-0.5` knob positioning byte-faithful.

- [ ] **Step 4: `IllustrationNoItems`** — port from `cb425ac:src-vite-legacy/components/Icons.jsx` (line ~263) into `src/components/Icons.tsx`, typed `({ className }: { className?: string })`, original default className, SVG byte-identical.

- [ ] **Step 5: Expand the loader** — `src/app/(app)/stock/page.tsx`:
  - stock `item` select gains `nameHe`, `photoUrl`, and `category: { select: { id, name, nameHe, emoji, sortOrder } }`.
  - the catalog (`allItems`) select gains `nameHe`, `photoUrl`, `categoryId`, `autoTrackStock`.
  - add a `categories` load: `prisma.category.findMany({ where: { householdId }, orderBy: { sortOrder: "asc" }, select: { id, name, nameHe, emoji, sortOrder } })`.
  - compute `const lowStockCount = stock.filter((s) => s.quantity <= s.lowThreshold).length;`.
  - pass to `StockManager`: `stock` (rows with `itemId`, `item` incl. category, `quantity`, `unit`, `lowThreshold`), `allItems`, `categories`, `lowStockCount`. (Keep it typed; define the row types inline or in a small `src/lib/stock-data.ts` if convenient.)

- [ ] **Step 6: Verify** — confirm `setListStatusCore` pattern parity, `updateMany` count guard; `npx tsc --noEmit` clean. (Loader compiles even before StockManager's props change — do Step 5's prop wiring together with Task 4 if StockManager's signature isn't updated yet; to keep this task self-contained, you may temporarily pass the new props and update `StockManager`'s prop type to accept-and-ignore them, OR land Step 5 in Task 4. Prefer: land the loader query expansion here, and the exact `<StockManager .../>` prop shape in Task 4. If tsc requires it, stub `StockManager`'s props to accept the new fields.)

- [ ] **Step 7: Commit** — `git add src/lib/mutations/auto-track.ts src/actions/stock-extra.ts src/components/Toggle.tsx src/components/Icons.tsx "src/app/(app)/stock/page.tsx" && git commit -m "feat(stock): setAutoTrackStock action + Toggle + loader expansion + IllustrationNoItems"`

---

### Task 2: `AddToStockModal` (port)

**Files:**
- Create: `src/components/stock/AddToStockModal.tsx`

**Interfaces:**
- Consumes: `BottomSheet`, `ItemImage`, `useT`, `getItemName`/`getCategoryName`.
- Produces: `AddToStockModal({ mode, items, categories, onBatchAdd, onClose })` where `mode: "in-stock" | "out-of-stock"`, `items` are the un-stocked catalog items (`{ id, name, nameHe, emoji, defaultUnit, categoryId }`), `categories` (`{ id, name, nameHe, emoji }`); `onBatchAdd(items: { itemId, quantity, unit, lowThreshold }[]) => Promise<void>`. In-stock mode adds with the chosen quantity (single-item stepper) + `lowThreshold 0`; out-of-stock adds with `quantity 0`.

- [ ] **Step 1: Port** the `AddToStockModal` function from `cb425ac:src-vite-legacy/pages/Stock.jsx` → `src/components/stock/AddToStockModal.tsx`: `"use client"`, named export; wrap the panel in `<BottomSheet onClose={onClose}>` (keep the header + scrollable body + sticky footer inside it); replace `useTranslation` with `useT()`; `item.name_he`→`item.nameHe`, `item.category_id`→`item.categoryId`, `item.default_unit`→`item.defaultUnit`, `getItemName(item)`→`getItemName(item, locale)`, `getCategoryName(cat)`→`getCategoryName(cat, locale)`. Keep the search, category grouping, multi-select checkboxes (✓/✗ + green/danger accents by mode), the single-item quantity stepper (in-stock), and the batch submit button byte-faithful. Add any missing dict keys to both en/he.

- [ ] **Step 2: Verify** `npx tsc --noEmit` clean.

- [ ] **Step 3: Commit** — `git add src/components/stock/AddToStockModal.tsx src/i18n/dictionaries/en.ts src/i18n/dictionaries/he.ts && git commit -m "feat(stock): AddToStockModal (in/out, batch)"`

---

### Task 3: `EditStockModal` (port)

**Files:**
- Create: `src/components/stock/EditStockModal.tsx`

**Interfaces:**
- Consumes: `BottomSheet`, `ItemImage`, `useT`, `getItemName`.
- Produces: `EditStockModal({ stockItem, onSave, onClose })` where `stockItem = { itemId, item: { name, nameHe, emoji, photoUrl }, quantity, unit, lowThreshold }`; `onSave(updates: { quantity, lowThreshold }) => Promise<void>`. Edits current quantity (± steppers + input) and low-stock threshold.

- [ ] **Step 1: Port** the `EditStockModal` function from `cb425ac:src-vite-legacy/pages/Stock.jsx` → `src/components/stock/EditStockModal.tsx`: `"use client"`, named export; wrap in `<BottomSheet onClose={onClose}>`; `useT()`; `stockItem.items`→`stockItem.item`, `low_threshold`→`lowThreshold`, `getItemName(stockItem.item, locale)`. Change the save payload from `{ quantity, low_threshold }` to `{ quantity, lowThreshold }`. Keep the item header, quantity steppers/input, threshold input, and save button byte-faithful.

- [ ] **Step 2: Verify** `npx tsc --noEmit` clean.

- [ ] **Step 3: Commit** — `git add src/components/stock/EditStockModal.tsx && git commit -m "feat(stock): EditStockModal"`

---

### Task 4: `StockManager` rebuild (the main screen)

**Files:**
- Modify: `src/components/StockManager.tsx`, and finalize the `<StockManager .../>` props in `src/app/(app)/stock/page.tsx`

**Interfaces:**
- Consumes: `Toggle`, `ItemImage`, `AddToStockModal`, `EditStockModal`, `IconSettings`/`IllustrationNoItems`, `useT`, `getItemName`/`getCategoryName`, and actions `adjustStock`/`setStock`/`removeStock` (`@/actions/stock`) + `setAutoTrackStock` (`@/actions/stock-extra`).
- Produces: the original Stock screen — header ("Stock") + settings gear + low-stock filter chip; a collapsible **auto-track settings panel** (items grouped by category, each a `Toggle` → `setAutoTrackStock(itemId, next)` + `router.refresh()`); **add buttons** (In Stock / Out of Stock → `AddToStockModal`); an empty state (`IllustrationNoItems`); the **category-grouped stock list** (sorted by category `sortOrder`, low items highlighted `border-danger/30 bg-danger/5`), each row with `−/+` steppers (`adjustStock({ itemId, delta })`), inline threshold edit (`setStock({ itemId, quantity: s.quantity, unit: s.unit, lowThreshold: n })`), **Edit** (→ `EditStockModal`, save via `setStock`), **Delete** (confirm → `removeStock(itemId)`); and the low-stock filter.

- [ ] **Step 1: Rebuild `StockManager.tsx`** — replace the current file, porting the main-screen return of `cb425ac:src-vite-legacy/pages/Stock.jsx`. Props: `{ stock: StockRow[]; allItems: CatalogItem[]; categories: Category[]; lowStockCount: number }` (types matching the Task 1 loader). Wire, applying the mapping rules:
  - `−/+` steppers → `await adjustStock({ itemId: s.itemId, delta: -1 | +1 }); router.refresh()` (the original passed `s.id` + absolute qty; use `itemId` + delta). Don't let quantity go below 0 (adjustStock clamps at 0 in the core — verify).
  - inline threshold edit (the "Min: N" → input onBlur) → `await setStock({ itemId: s.itemId, quantity: s.quantity, unit: s.unit, lowThreshold: Number(e.target.value) || 1 }); router.refresh()`.
  - Edit → open `EditStockModal`; its `onSave({ quantity, lowThreshold })` → `await setStock({ itemId: s.itemId, quantity, unit: s.unit, lowThreshold }); router.refresh()`.
  - Delete → `if (confirm(...)) { await removeStock(s.itemId); router.refresh(); }`.
  - Auto-track Toggle → `await setAutoTrackStock(item.id, !current); router.refresh()`.
  - Add buttons → `AddToStockModal` with `onBatchAdd` looping `await setStock({ itemId, quantity, unit, lowThreshold })` per item then `router.refresh()`.
  - Grouping: stock rows by `s.item.category` (sortOrder; `📦 Other` fallback); settings-panel items grouped by category from `allItems`/`categories`.
  - `useT()` for `t`/`locale`; `getItemName`/`getCategoryName(x, locale)`. Low filter: `lowStockCount` + a `filterLow` toggle showing only `quantity <= lowThreshold`. All hooks at top; logical CSS only. Remove the old `getDictionary("en")` usage.
- [ ] **Step 2: Finalize loader props** — ensure `src/app/(app)/stock/page.tsx` passes exactly `stock`, `allItems`, `categories`, `lowStockCount` in the shapes `StockManager` expects.

- [ ] **Step 3: Build + live smoke** — `npm run build` clean; dev, signed in as `demo@grocery.app` on `/stock`: stock shows grouped by category with the 2 low items highlighted + the low-stock chip count; `−/+` changes quantity; editing a threshold flips low state; the settings gear reveals the auto-track panel and toggling persists; Add-to-stock (in/out) adds items; Edit sheet saves; Delete removes.

- [ ] **Step 4: Commit** — `git add src/components/StockManager.tsx "src/app/(app)/stock/page.tsx" && git commit -m "feat(stock): restore stock screen (grouped levels + low-stock + threshold + auto-track)"`

---

## Self-Review

**Spec coverage (M4 row):** stock levels (Task 4) ✓; low-stock highlighting + filter (Task 4) ✓; threshold editing (Task 4 inline + Task 3 sheet) ✓; auto-track panel (Tasks 1 + 4) ✓; add/edit sheets (Tasks 2, 3) ✓.

**Safety:** the auto-track toggle uses the new single-field `setAutoTrackStock` (NOT `updateItem`), avoiding the `updateItemCore` null-omitted-fields data-loss trap (verified: that core nulls `nameHe`/`notes` and resets `emoji`/`defaultUnit`). `setAutoTrackStockCore` is household-scoped (`updateMany where { id, householdId }` + `count` guard).

**Type consistency:** stock actions are keyed by `itemId` (confirmed: `adjustStock({ itemId, delta })`, `setStock({ itemId, quantity, unit, lowThreshold })`, `removeStock(itemId)`); the loader passes `s.itemId`, so every ported `s.id`-based call maps to `s.itemId`. `EditStockModal.onSave` uses `{ quantity, lowThreshold }`. `Toggle`/`ItemImage`/`BottomSheet` reused from earlier milestones.

**No deferrals:** the original Stock screen had no prices/share, so M4 restores it fully.

**Verify-before-relying:** `adjustStockCore` clamps `Math.max(0, existing + delta)` and is household-scoped (`ownedItem` guard) — **confirmed** in `src/lib/mutations/stock.ts` (the `−` stepper can't go negative). `setListStatusCore` `updateMany`+count pattern — confirmed in M3. `updateItemCore` nulls omitted fields — confirmed (motivates the dedicated `setAutoTrackStock`).

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-16-ui-restoration-m4-stock.md`. Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, two-stage review between tasks.
2. **Inline Execution** — execute tasks in this session with checkpoints.

Which approach? (After M4, we hit the **M1–M4 cutover**: merge `feat/ui-restoration` → `main` and update the live demo.)
