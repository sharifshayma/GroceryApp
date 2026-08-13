# GroceryApp Migration — Phase 3b (Shopping: check-off + carry-over) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the shopping flow — check items off as bought, show progress, and complete a list (carrying unbought items into a new list, or completing anyway) — on top of Phase 3a's lists.

**Architecture:** Extend the Phase-3a list actions with `setListItemBought` + `completeList` (`requireHousehold()`-scoped, ownership via the parent list); extend the `/lists/[id]` detail UI (`ListDetail`) with bought checkboxes, a progress line, and a complete control. Mirrors Phase 2/3a.

**Tech Stack:** Next.js 16, Prisma 6 + Prisma Postgres, better-auth, Tailwind v4, Zod, Vitest — all in place.

## Global Constraints

- Work on branch `next-migration` in `/Users/balanceshayma/Documents/GitHub/GroceryApp`. Never touch `main`.
- Reuse Phase 1/2/3a conventions: `requireHousehold()` gates every read/mutation; actions return `{ ok: true } | { ok: false; error: string }` (completeList also returns `carriedOverListId?`); no unscoped `prisma.groceryList`/`prisma.listItem`.
- **List-item ownership is verified through the parent list** (reuse Phase 3a's `listItemListId` helper). `completeList` operates only on the household's own list; the carry-over list is created for the same household.
- No schema changes. Uses `ListItem.isBought/boughtById/boughtAt` and `GroceryList.status/completedAt` (all present from Phase 1).
- The carry-over list is a `draft` named `"<name> (carried over)"` with the unbought items copied (`itemId/quantity/unit/notes`), starting unbought. This "(carried over)" text is server-side data, not an i18n string.
- Completed lists are **read-only** in the UI: hide bought checkboxes, the Complete control, and the add/edit/remove item controls; show a "Completed" badge.
- No dashboard change — the open-list count already filters `status in (draft, active)`, so completing drops a list out automatically.
- i18n: add the new `lists.*` shopping strings to BOTH `en.ts` and `he.ts`, identical structure. Client components use module-level `getDictionary("en")` + `t(d, key)` (Phase 2/3a pattern — no `useT()`).
- **Run `npm run lint` (0 errors AND 0 warnings) in every task's verification** — a client component can pass tsc/build but fail react-hooks lint (e.g. `set-state-in-effect`). Do NOT sync state from props via `useEffect(() => setState(...))`.
- `@/*` → `./src/*`. DB provisioned (Phase 1). Tasks 1–4 verify offline; the controller runs the live smoke test.

## File structure (Phase 3b)

```
src/lib/shopping-progress.ts         # pure shoppingProgress() → {bought,total}
src/actions/list-items.ts            # MODIFY: add setListItemBought
src/actions/lists.ts                 # MODIFY: add completeList
src/app/(app)/lists/[id]/page.tsx    # MODIFY: item select gains isBought (+ boughtAt)
src/components/ListDetail.tsx        # MODIFY: checkbox + progress + complete flow + completed read-only
src/i18n/dictionaries/{en,he}.ts     # MODIFY: add lists.* shopping strings
```

---

### Task 1: shoppingProgress helper (TDD)

**Files:**
- Create: `src/lib/shopping-progress.ts`
- Test: `src/lib/__tests__/shopping-progress.test.ts`

**Interfaces:**
- Produces: `shoppingProgress(items: { isBought: boolean }[]): { bought: number; total: number }`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/__tests__/shopping-progress.test.ts
import { describe, it, expect } from "vitest";
import { shoppingProgress } from "@/lib/shopping-progress";

describe("shoppingProgress", () => {
  it("counts bought and total", () => {
    expect(shoppingProgress([{ isBought: true }, { isBought: false }, { isBought: true }])).toEqual({
      bought: 2,
      total: 3,
    });
  });
  it("all bought", () => {
    expect(shoppingProgress([{ isBought: true }, { isBought: true }])).toEqual({ bought: 2, total: 2 });
  });
  it("none bought", () => {
    expect(shoppingProgress([{ isBought: false }])).toEqual({ bought: 0, total: 1 });
  });
  it("empty", () => {
    expect(shoppingProgress([])).toEqual({ bought: 0, total: 0 });
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/lib/__tests__/shopping-progress.test.ts` — FAIL.

- [ ] **Step 3: Implement `shopping-progress.ts`**

```ts
// src/lib/shopping-progress.ts
export function shoppingProgress(
  items: { isBought: boolean }[],
): { bought: number; total: number } {
  let bought = 0;
  for (const i of items) if (i.isBought) bought++;
  return { bought, total: items.length };
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx vitest run src/lib/__tests__/shopping-progress.test.ts` — PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shopping-progress.ts src/lib/__tests__/shopping-progress.test.ts
git commit -m "feat(phase3b): shoppingProgress helper"
```

---

### Task 2: `setListItemBought` action

**Files:**
- Modify: `src/actions/list-items.ts`

**Interfaces:**
- Produces: `setListItemBought({ listItemId, isBought }): Promise<{ ok: true } | { ok: false; error: string }>`.

- [ ] **Step 1: Add the import + action to `src/actions/list-items.ts`**

Add `import { getCurrentUser } from "@/lib/auth-guard";` to the imports (alongside the existing ones), and append this action (it reuses the existing `listItemListId` helper already in the file):

```ts
export async function setListItemBought(input: {
  listItemId: string;
  isBought: boolean;
}): Promise<Result> {
  const household = await requireHousehold();
  const listId = await listItemListId(household.id, input.listItemId);
  if (!listId) return { ok: false, error: "List item not found" };
  const user = input.isBought ? await getCurrentUser() : null;
  await prisma.listItem.update({
    where: { id: input.listItemId },
    data: {
      isBought: input.isBought,
      boughtById: input.isBought ? (user?.id ?? null) : null,
      boughtAt: input.isBought ? new Date() : null,
    },
  });
  revalidatePath(`/lists/${listId}`);
  return { ok: true };
}
```

- [ ] **Step 2: Typecheck + lint + build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: clean/pass (lint 0/0).

- [ ] **Step 3: Commit**

```bash
git add src/actions/list-items.ts
git commit -m "feat(phase3b): setListItemBought action (list-scoped)"
```

---

### Task 3: `completeList` action

**Files:**
- Modify: `src/actions/lists.ts`

**Interfaces:**
- Produces: `completeList({ listId, carryOver }): Promise<{ ok: true; carriedOverListId?: string } | { ok: false; error: string }>` — `carriedOverListId` present only when a carry-over list was created.

- [ ] **Step 1: Append `completeList` to `src/actions/lists.ts`**

The file already imports `prisma`, `requireHousehold`, `getCurrentUser`, `revalidatePath`. Add:

```ts
type CompleteResult =
  | { ok: true; carriedOverListId?: string }
  | { ok: false; error: string };

export async function completeList(input: {
  listId: string;
  carryOver: boolean;
}): Promise<CompleteResult> {
  const household = await requireHousehold();
  const user = await getCurrentUser();
  // Household-scoped load confirms ownership before we mutate by id below.
  const list = await prisma.groceryList.findFirst({
    where: { id: input.listId, householdId: household.id },
    select: {
      name: true,
      items: {
        select: { itemId: true, quantity: true, unit: true, notes: true, isBought: true },
      },
    },
  });
  if (!list) return { ok: false, error: "List not found" };

  const unbought = list.items.filter((li) => !li.isBought);
  const shouldCarry = input.carryOver && unbought.length > 0;

  const carriedOverListId = await prisma.$transaction(async (tx) => {
    await tx.groceryList.update({
      where: { id: input.listId },
      data: { status: "completed", completedAt: new Date() },
    });
    if (!shouldCarry) return undefined as string | undefined;
    const copy = await tx.groceryList.create({
      data: {
        householdId: household.id,
        name: `${list.name} (carried over)`,
        status: "draft",
        createdById: user?.id ?? null,
        items: {
          create: unbought.map((li) => ({
            itemId: li.itemId,
            quantity: li.quantity,
            unit: li.unit,
            notes: li.notes,
          })),
        },
      },
      select: { id: true },
    });
    return copy.id;
  });

  revalidatePath("/lists");
  revalidatePath(`/lists/${input.listId}`);
  return { ok: true, carriedOverListId };
}
```

- [ ] **Step 2: Typecheck + lint + build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: clean/pass.

- [ ] **Step 3: Commit**

```bash
git add src/actions/lists.ts
git commit -m "feat(phase3b): completeList action (complete + optional carry-over)"
```

---

### Task 4: Detail page + ListDetail shopping UI + i18n

**Files:**
- Modify: `src/app/(app)/lists/[id]/page.tsx`, `src/components/ListDetail.tsx`, `src/i18n/dictionaries/en.ts`, `src/i18n/dictionaries/he.ts`

**Interfaces:**
- Consumes: `setListItemBought` (`@/actions/list-items`), `completeList` (`@/actions/lists`), `shoppingProgress` (`@/lib/shopping-progress`).

- [ ] **Step 1: Add `isBought` (+ `boughtAt`) to the detail page's item select**

In `src/app/(app)/lists/[id]/page.tsx`, add `isBought: true` (and optionally `boughtAt: true`) to the `items.select` (the block that currently selects `id, quantity, unit, notes, item`). No other change to the page.

- [ ] **Step 2: Add the Phase-3b i18n strings (both dictionaries)**

Add to the `lists` group in `en.ts` (mirror in `he.ts` with Hebrew values):

```ts
// add to lists: { ... }
markBought: "Mark bought",
progress: "{bought} of {total} bought",
complete: "Complete list",
carryOver: "Carry over unbought",
completeAnyway: "Complete anyway",
completedBadge: "Completed",
completePrompt: "Some items aren't bought yet.",
```

- [ ] **Step 3: Extend `src/components/ListDetail.tsx`**

Read the current file first (it's the Phase-3a detail component). Make these additive changes; keep the existing rename/duplicate/delete + item add/edit/remove behavior intact:

- Add imports: `import { setListItemBought } from "@/actions/list-items";`, `import { completeList } from "@/actions/lists";`, `import { shoppingProgress } from "@/lib/shopping-progress";`.
- Extend `ListItemRow` with `isBought: boolean;` (and `boughtAt: string | Date | null;` if selected).
- Add a derived `const isCompleted = list.status === "completed";` and `const { bought, total } = shoppingProgress(list.items);`.
- **Progress line** (show when `total > 0`): `t(d, "lists.progress", { bought, total })`.
- **Per-item bought checkbox** (render only when `!isCompleted`): an `<input type="checkbox" checked={row.isBought}>` (labeled `lists.markBought` via `aria-label`) whose `onChange` calls a handler `toggleBought(row.id, !row.isBought)` → `await setListItemBought({ listItemId: row.id, isBought })` → on `ok` `router.refresh()`, else show/alert error. Track a per-row pending id to disable during the call. Bought rows render with `line-through` + reduced opacity on the name/quantity.
- **Complete control** (render only when `!isCompleted`): a **Complete list** button (`lists.complete`). Clicking it:
  - if `bought === total` (all bought, or `total === 0`) → call `handleComplete(false)`.
  - else → reveal an inline choice (a small panel with `lists.completePrompt` and two buttons: **Carry over unbought** → `handleComplete(true)`, **Complete anyway** → `handleComplete(false)`).
  - `handleComplete(carryOver)` → `const r = await completeList({ listId: list.id, carryOver })`; on `ok`: if `r.carriedOverListId` → `router.push(\`/lists/${r.carriedOverListId}\`)`, else `router.push("/lists")`; on failure show the error. Disable while pending.
- **Completed state**: when `isCompleted`, show a "Completed" badge (`lists.completedBadge`) near the title, and DO NOT render the bought checkboxes, the Complete control, the Add-item form, or the per-item Edit/Remove controls (the list is read-only). Item rows still render (with bought styling).
- Do NOT introduce any `useEffect` that calls `setState` from props (lint rule). Derive `isCompleted`/progress during render; keep checkbox state driven by the `row.isBought` prop + `router.refresh()`.

- [ ] **Step 4: Full offline verification**

Run: `npx tsc --noEmit && npm run test && npm run lint && npm run build`
Expected: all pass (tests: shopping-progress + prior suites; lint 0/0; build compiles `/lists/[id]`).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/lists/[id]/page.tsx" src/components/ListDetail.tsx src/i18n/dictionaries/en.ts src/i18n/dictionaries/he.ts
git commit -m "feat(phase3b): shopping UI — check-off, progress, complete + carry-over"
```

---

## Manual smoke test (controller runs after Task 4)

On `npm run dev` with a signed-in household + a list of 3 catalog items:
1. Check 2 items → each row shows bought (strikethrough); progress reads "2 of 3 bought".
2. **Complete list** → since 1 is unbought, choose **Carry over unbought** → original list becomes Completed (badge, read-only, controls hidden), and a new `"<name> (carried over)"` draft list holds the 1 unbought item (unbought); the URL navigates to the new list.
3. On another list, **Complete anyway** with unbought items → list Completed, NO carry-over list created.
4. `/dashboard` open-list count reflects the completions (down for completed, up for the carry-over).
5. Cross-household: marking bought / completing a list id from another household is rejected (`setListItemBought`/`completeList` return not-found). Clean up test rows.

---

## Self-Review

**Spec coverage:**
- `setListItemBought` (toggle bought, list-scoped) → Task 2. ✅
- `completeList` (complete + optional carry-over, transaction) → Task 3. ✅
- Bought checkbox + bought styling → Task 4. ✅
- Progress line (pure helper) → Tasks 1, 4. ✅
- Complete control with carry-over / complete-anyway choice + navigation → Task 4. ✅
- Completed lists read-only + badge → Task 4. ✅
- No dashboard change (open count already excludes completed) → noted; not a task. ✅
- i18n en+he parity → Task 4. ✅
- No schema changes; active transition deferred; stockUpdated untouched → all tasks. ✅

**Placeholder scan:** Actions + helper code given in full. Task 4's `ListDetail` changes specify each addition (checkbox handler + action, progress key, complete flow branches + navigation, completed read-only rules) and the exact functions/keys to use, against the already-read Phase-3a component structure. No `TBD`/vague requirements.

**Type consistency:** `setListItemBought({listItemId,isBought})`, `completeList({listId,carryOver}) → {ok:true;carriedOverListId?}`, `shoppingProgress(items) → {bought,total}`, the extended `ListItemRow.isBought`, and the `lists.*` keys are used identically across tasks. `completeList` mutates by id only after a household-scoped `findFirst` confirms ownership (same pattern as `duplicateList`).

## Setup dependency

None new — DB provisioned in Phase 1. Tasks 1–4 verify offline; the controller runs the live smoke test.
