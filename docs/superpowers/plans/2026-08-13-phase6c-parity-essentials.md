# GroceryApp Phase 6c — Parity Essentials Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore three deferred old-app behaviors — auto-track stock, item-tag notes, ensureStoreTag — by wiring them into the shared mutation cores so the web app AND the MCP tools both gain them.

**Architecture:** Pure decision logic (`computeAutoTrack`) + core extensions (`setListItemBoughtCore`, `assignTagCore`, `addPriceEntryCore`/`updatePriceEntryCore`, `createItemCore`/`updateItemCore`) + thin UI/action/MCP surface. No schema changes.

**Tech Stack:** Next.js 16, Prisma 6, Zod 4, Vitest 4, TypeScript.

## Global Constraints

- Branch `next-migration`, never `main`. Personal git identity (`sharifshayma`). Never commit `.env`.
- Lint is **`npm run lint`** (bare eslint). No schema changes (all fields exist: `Item.autoTrackStock`, `ListItem.stockUpdated`, `ItemTag.notes`, `Tag.type` store).
- Cores stay under `src/lib/mutations/` (no `"use server"`/`revalidatePath`); web action wrappers keep their public return types; MCP tools reuse `hh(extra)`/`uid(extra)`/`json(...)`.
- Auto-track is idempotent per line via `stockUpdated` (never double-count); quantities clamp at 0.
- `ensureStoreTag` is best-effort — it must never fail the price write.
- i18n `he: typeof en` parity: any key added to `en.ts` must be added to `he.ts`.
- `Result = { ok: true } | { ok: false; error: string }`.

---

## File Structure

- `src/lib/auto-track.ts` (+ test) — `computeAutoTrack` (Task 1).
- `src/lib/mutations/list-items.ts` — extend `setListItemBoughtCore` (Task 1).
- `src/lib/mutations/items.ts` — `autoTrackStock` on create/update core (Task 2).
- `src/actions/items.ts`, `src/app/(app)/items/page.tsx`, `src/components/ItemManager.tsx`, `src/i18n/dictionaries/{en,he}.ts` — item `autoTrackStock` surface (Task 2).
- `src/lib/mutations/tags.ts` — `assignTagCore` note + `ensureStoreTag` (Tasks 3 & 4).
- `src/actions/tags.ts`, `src/components/ItemTagPicker.tsx`, `src/components/ItemManager.tsx`, items page, dicts — tag-note surface (Task 3).
- `src/lib/mutations/prices.ts` — wire `ensureStoreTag` (Task 4).
- `src/app/api/mcp/route.ts` — `create_item`/`edit_item` `autoTrackStock`; `tag_item` `notes` (Task 5).

---

## Task 1: Auto-track stock — `computeAutoTrack` + `setListItemBoughtCore`

**Files:** Create `src/lib/auto-track.ts`, `src/lib/auto-track.test.ts`; Modify `src/lib/mutations/list-items.ts`.

**Interfaces — Produces:** `computeAutoTrack(input): { stockDelta: number | null; stockUpdated: boolean }`; `setListItemBoughtCore` now also upserts stock. Its signature/return (`ResultWithList`) is unchanged.

- [ ] **Step 1: Write the failing test**

Create `src/lib/auto-track.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeAutoTrack } from "./auto-track";

const base = { autoTrackStock: true, stockUpdated: false, quantity: 2 };

describe("computeAutoTrack", () => {
  it("marking bought (tracked, not yet counted) → +quantity, stockUpdated true", () => {
    expect(computeAutoTrack({ ...base, isBought: true })).toEqual({ stockDelta: 2, stockUpdated: true });
  });
  it("un-marking (was counted) → -quantity, stockUpdated false", () => {
    expect(computeAutoTrack({ ...base, isBought: false, stockUpdated: true })).toEqual({ stockDelta: -2, stockUpdated: false });
  });
  it("autoTrackStock off → no stock change on mark", () => {
    expect(computeAutoTrack({ ...base, isBought: true, autoTrackStock: false })).toEqual({ stockDelta: null, stockUpdated: false });
  });
  it("already counted, marking bought again → no double-count", () => {
    expect(computeAutoTrack({ ...base, isBought: true, stockUpdated: true })).toEqual({ stockDelta: null, stockUpdated: true });
  });
  it("un-marking something never counted → no refund", () => {
    expect(computeAutoTrack({ ...base, isBought: false, stockUpdated: false })).toEqual({ stockDelta: null, stockUpdated: false });
  });
});
```

- [ ] **Step 2: Run it → fail**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npx vitest run src/lib/auto-track.test.ts`
Expected: FAIL (cannot resolve `./auto-track`).

- [ ] **Step 3: Write the helper**

Create `src/lib/auto-track.ts`:

```ts
export function computeAutoTrack(input: {
  isBought: boolean;
  autoTrackStock: boolean;
  stockUpdated: boolean;
  quantity: number;
}): { stockDelta: number | null; stockUpdated: boolean } {
  const { isBought, autoTrackStock, stockUpdated, quantity } = input;
  if (isBought && autoTrackStock && !stockUpdated) {
    return { stockDelta: quantity, stockUpdated: true };
  }
  if (!isBought && stockUpdated) {
    return { stockDelta: -quantity, stockUpdated: false };
  }
  return { stockDelta: null, stockUpdated };
}
```

- [ ] **Step 4: Run it → pass**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npx vitest run src/lib/auto-track.test.ts`
Expected: PASS.

- [ ] **Step 5: Extend `setListItemBoughtCore`**

In `src/lib/mutations/list-items.ts`, add `import { computeAutoTrack } from "@/lib/auto-track";` and replace the whole `setListItemBoughtCore` function with:

```ts
export async function setListItemBoughtCore(
  householdId: string,
  userId: string | null,
  input: { listItemId: string; isBought: boolean },
): Promise<ResultWithList> {
  // Household-scoped load also serves as the ownership gate.
  const line = await prisma.listItem.findFirst({
    where: { id: input.listItemId, list: { householdId } },
    select: {
      listId: true,
      itemId: true,
      quantity: true,
      stockUpdated: true,
      item: { select: { autoTrackStock: true, defaultUnit: true } },
    },
  });
  if (!line) return { ok: false, error: "List item not found" };

  const track =
    line.itemId && line.item
      ? computeAutoTrack({
          isBought: input.isBought,
          autoTrackStock: line.item.autoTrackStock,
          stockUpdated: line.stockUpdated,
          quantity: line.quantity,
        })
      : { stockDelta: null, stockUpdated: line.stockUpdated };

  await prisma.$transaction(async (tx) => {
    await tx.listItem.update({
      where: { id: input.listItemId },
      data: {
        isBought: input.isBought,
        boughtById: input.isBought ? userId : null,
        boughtAt: input.isBought ? new Date() : null,
        stockUpdated: track.stockUpdated,
      },
    });
    if (track.stockDelta !== null && line.itemId) {
      const existing = await tx.stock.findUnique({
        where: { householdId_itemId: { householdId, itemId: line.itemId } },
        select: { quantity: true },
      });
      const newQty = Math.max(0, (existing?.quantity ?? 0) + track.stockDelta);
      await tx.stock.upsert({
        where: { householdId_itemId: { householdId, itemId: line.itemId } },
        update: { quantity: newQty, updatedById: userId },
        create: {
          householdId,
          itemId: line.itemId,
          quantity: newQty,
          unit: line.item?.defaultUnit || "pcs",
          lowThreshold: 1,
          updatedById: userId,
        },
      });
    }
  });

  return { ok: true, listId: line.listId };
}
```

(Leave `listItemListId`, `updateListItemCore`, `removeListItemCore`, `addListItemCore` unchanged — they still use `listItemListId`.)

- [ ] **Step 6: Verify + commit**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npx vitest run src/lib/auto-track.test.ts && npx tsc --noEmit && npm run lint`
Expected: test PASS; no type/lint errors.

```bash
cd /Users/balanceshayma/Documents/GitHub/GroceryApp
git add src/lib/auto-track.ts src/lib/auto-track.test.ts src/lib/mutations/list-items.ts
git commit -m "feat(stock): auto-track stock when a list line is marked bought"
```

---

## Task 2: Item `autoTrackStock` toggle (core + actions + form)

**Files:** Modify `src/lib/mutations/items.ts`, `src/actions/items.ts`, `src/app/(app)/items/page.tsx`, `src/components/ItemManager.tsx`, `src/i18n/dictionaries/{en,he}.ts`.

**Interfaces — Consumes:** —. **Produces:** `createItemCore`/`updateItemCore` accept `autoTrackStock?: boolean`; the item form persists it.

- [ ] **Step 1: Cores accept `autoTrackStock`**

In `src/lib/mutations/items.ts`:
- Add `autoTrackStock?: boolean` to BOTH `createItemCore` and `updateItemCore` input types.
- In `createItemCore`'s `data`, add: `autoTrackStock: input.autoTrackStock ?? true,`
- In `updateItemCore`'s `data`, add: `...(input.autoTrackStock !== undefined ? { autoTrackStock: input.autoTrackStock } : {}),`

- [ ] **Step 2: Actions pass it through**

In `src/actions/items.ts`, add `autoTrackStock?: boolean` to the `createItem` and `updateItem` input types (the wrappers already spread `input` into the core call, so no body change beyond the type — confirm they pass the whole `input`; if they destructure, add the field).

- [ ] **Step 3: Page fetch + ItemManager types + form**

- `src/app/(app)/items/page.tsx`: add `autoTrackStock: true,` to the `item.findMany` `select`.
- `src/components/ItemManager.tsx`:
  - `ItemRow`: add `autoTrackStock: boolean;`
  - `ItemFormValues`: add `autoTrackStock: boolean;`
  - `emptyForm`: add `autoTrackStock: true,`
  - `startEdit` (the fn that maps a row → form; near the existing `defaultUnit: row.defaultUnit`): add `autoTrackStock: row.autoTrackStock,`
  - payload (near `defaultUnit: form.defaultUnit`): add `autoTrackStock: form.autoTrackStock,`
  - Add a checkbox in the form, after the notes `Textarea`:
    ```tsx
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={form.autoTrackStock}
        onChange={(e) => setForm({ ...form, autoTrackStock: e.target.checked })}
        className="h-4 w-4"
      />
      {t(d, "catalog.items.autoTrack")}
    </label>
    ```

- [ ] **Step 4: i18n**

Add to `catalog.items` in BOTH dictionaries:
- `en.ts`: `autoTrack: "Auto-update stock when bought",`
- `he.ts`: `autoTrack: "עדכן מלאי אוטומטית בקנייה",`

- [ ] **Step 5: Verify + commit**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npx tsc --noEmit && npm run lint && npx next build`
Expected: clean (i18n parity holds; build succeeds).

```bash
cd /Users/balanceshayma/Documents/GitHub/GroceryApp
git add src/lib/mutations/items.ts src/actions/items.ts src/app/\(app\)/items/page.tsx src/components/ItemManager.tsx src/i18n/dictionaries/en.ts src/i18n/dictionaries/he.ts
git commit -m "feat(items): autoTrackStock toggle on the item form"
```

---

## Task 3: Item-tag notes (core + action + picker UI)

**Files:** Modify `src/lib/mutations/tags.ts`, `src/actions/tags.ts`, `src/app/(app)/items/page.tsx`, `src/components/ItemManager.tsx`, `src/components/ItemTagPicker.tsx`, `src/i18n/dictionaries/{en,he}.ts`.

**Interfaces — Produces:** `assignTagCore(householdId, { itemId, tagId, note? })`; `ItemTagPicker` edits per-assignment notes.

- [ ] **Step 1: Core + action accept `note`**

In `src/lib/mutations/tags.ts`:
- Add `import { clean } from "./util";` (if not present).
- `assignTagCore` input → `{ itemId: string; tagId: string; note?: string }`; the `upsert` becomes:
  ```ts
  await prisma.itemTag.upsert({
    where: { itemId_tagId: { itemId: input.itemId, tagId: input.tagId } },
    update: { notes: clean(input.note) },
    create: { itemId: input.itemId, tagId: input.tagId, notes: clean(input.note) },
  });
  ```
In `src/actions/tags.ts`: `assignTag` input → `{ itemId: string; tagId: string; note?: string }`, passed through to `assignTagCore`.

- [ ] **Step 2: Pipe notes to the picker**

- `src/app/(app)/items/page.tsx`: the `tags` select becomes `tags: { select: { notes: true, tag: { select: { id: true, name: true, color: true } } } },`
- `src/components/ItemManager.tsx`:
  - `ItemRow.tags`: `{ notes: string | null; tag: { id: string; name: string; color: string } }[]`
  - In the `<ItemTagPicker ... />` render, keep `assignedTagIds={tagPickerItem.tags.map(({ tag }) => tag.id)}` and ADD:
    ```tsx
    assignedNotes={Object.fromEntries(tagPickerItem.tags.map(({ tag, notes }) => [tag.id, notes]))}
    ```

- [ ] **Step 3: Note editing in `ItemTagPicker`**

In `src/components/ItemTagPicker.tsx`:
- Add prop `assignedNotes: Record<string, string | null>` to the component's props type.
- Add local state for editable notes: `const [notes, setNotes] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(assignedNotes).map(([k, v]) => [k, v ?? ""])));`
- Add a save handler:
  ```ts
  async function saveNote(tagId: string) {
    const res = await assignTag({ itemId, tagId, note: notes[tagId] ?? "" });
    if (!res.ok) { setError(res.error); return; }
    router.refresh();
  }
  ```
- Inside the assigned-tag `<li>` (when `isAssigned`), render below the label a small note input:
  ```tsx
  {isAssigned && (
    <input
      type="text"
      value={notes[tag.id] ?? ""}
      onChange={(e) => setNotes((n) => ({ ...n, [tag.id]: e.target.value }))}
      onBlur={() => saveNote(tag.id)}
      placeholder={t(d, "catalog.tags.notePlaceholder")}
      className="mt-1 w-full rounded-lg border border-border px-2 py-1 text-sm"
    />
  )}
  ```

- [ ] **Step 4: i18n**

Add to `catalog.tags` in BOTH dictionaries:
- `en.ts`: `notePlaceholder: "Note (optional)",`
- `he.ts`: `notePlaceholder: "הערה (אופציונלי)",`

- [ ] **Step 5: Verify + commit**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npx tsc --noEmit && npm run lint && npx next build`
Expected: clean.

```bash
cd /Users/balanceshayma/Documents/GitHub/GroceryApp
git add src/lib/mutations/tags.ts src/actions/tags.ts src/app/\(app\)/items/page.tsx src/components/ItemManager.tsx src/components/ItemTagPicker.tsx src/i18n/dictionaries/en.ts src/i18n/dictionaries/he.ts
git commit -m "feat(tags): per-assignment item-tag notes (editable in the tag picker)"
```

---

## Task 4: ensureStoreTag

**Files:** Modify `src/lib/mutations/tags.ts`, `src/lib/mutations/prices.ts`.

**Interfaces — Produces:** `ensureStoreTag(householdId: string, store: string | null): Promise<void>`.

- [ ] **Step 1: The helper**

In `src/lib/mutations/tags.ts`, add (exported):

```ts
// Best-effort: ensure a store-type tag with this name exists for the household.
export async function ensureStoreTag(householdId: string, store: string | null): Promise<void> {
  const name = store?.trim();
  if (!name) return;
  const existing = await prisma.tag.findFirst({
    where: { householdId, name, type: "store" },
    select: { id: true },
  });
  if (existing) return;
  await prisma.tag.create({ data: { householdId, name, type: "store" } });
}
```

- [ ] **Step 2: Wire into the price cores**

In `src/lib/mutations/prices.ts`:
- Add `import { ensureStoreTag } from "./tags";`
- In `addPriceEntryCore`, after the successful `prisma.priceHistory.create(...)` and before `return { ok: true }`, add:
  ```ts
  await ensureStoreTag(householdId, clean(input.store)).catch(() => {});
  ```
- In `updatePriceEntryCore`, after the `count === 0` guard passes (i.e. before `return { ok: true }`), add the same line.

(Best-effort: the `.catch(() => {})` guarantees a store-tag failure never fails the price write.)

- [ ] **Step 3: Verify + commit**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npx tsc --noEmit && npm run lint`
Expected: clean.

```bash
cd /Users/balanceshayma/Documents/GitHub/GroceryApp
git add src/lib/mutations/tags.ts src/lib/mutations/prices.ts
git commit -m "feat(prices): auto-create a store tag when logging a price at a new store"
```

---

## Task 5: MCP surface — `autoTrackStock` + tag `notes`

**Files:** Modify `src/app/api/mcp/route.ts`.

**Interfaces — Consumes:** the extended cores (Tasks 1–4).

- [ ] **Step 1: Add the params**

In `src/app/api/mcp/route.ts`:
- **`create_item`** — add `autoTrackStock: z.boolean().optional()` to its zod schema and pass `autoTrackStock` in the `createItemCore(...)` input.
- **`edit_item`** — add `autoTrackStock: z.boolean().optional()` to its schema and pass it in the `updateItemCore(...)` input.
- **`tag_item`** — add `notes: z.string().optional()` to its schema; on the attach path pass it: `assignTagCore(hh(extra), { itemId, tagId, note: notes })`. (The `unassign` path ignores it.)

(No change to `mark_list_item`/`log_price`/`edit_price` — they inherit auto-track / ensureStoreTag via the cores.)

- [ ] **Step 2: Verify + commit**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npx tsc --noEmit && npm run lint`
Expected: clean.

```bash
cd /Users/balanceshayma/Documents/GitHub/GroceryApp
git add src/app/api/mcp/route.ts
git commit -m "feat(mcp): create_item/edit_item autoTrackStock; tag_item notes"
```

---

## Verification (controller-run — needs the live DB)

- [ ] **1. Offline gate:** `npx tsc --noEmit && npm run lint && npx vitest run && npx next build` all clean.

- [ ] **2. Live smoke** (`PORT=3001 npm run dev`, seeded household + token — the prior-phase pattern):
  - **Auto-track:** put an item on a list (qty 3), note its current stock; `mark_list_item bought:true` → stock rises by 3, the line's `stockUpdated` is true; `bought:false` → stock falls back by 3. Set the item's `autoTrackStock` false (via `edit_item` or the form) → marking bought no longer moves stock. Marking an already-bought line bought again doesn't double-count.
  - **ensureStoreTag:** `log_price` with `store:"NewMart"` (a store with no tag) → a `store`-type tag "NewMart" now exists (`list_tags type:store`); logging again at "NewMart" → still one tag (no dup).
  - **Tag notes:** `tag_item { itemId, tagId, notes:"weekly" }` → the ItemTag carries the note; re-`tag_item` with a different note updates it; the web picker shows/edits it. Confirm the migrated 16 notes render in the picker.
  - Web parity: the item form's autoTrackStock checkbox persists; the tag picker note input saves on blur.
  - Clean up seeded rows.

- [ ] **3. Final whole-branch review** (most capable model) over the Phase 6c range; then push `next-migration`.

---

## Self-Review

**Spec coverage:** `computeAutoTrack` + `setListItemBoughtCore` stock upsert (transactional, idempotent via `stockUpdated`) ✓ (Task 1); item `autoTrackStock` toggle across core/action/page/form/i18n ✓ (Task 2); `assignTagCore` note + picker note UI + notes piped from the page ✓ (Task 3); `ensureStoreTag` best-effort in both price cores ✓ (Task 4); MCP `autoTrackStock`/`notes` params (mark_list_item/log_price inherit) ✓ (Task 5); household scoping preserved (cores already gated; the new load uses `list: { householdId }`) ✓; unit test for the pure decision logic ✓; live smoke ✓.

**Placeholder scan:** No TBD/TODO. UI insertions reference concrete existing patterns (the item form's `Textarea`, the picker's assigned-`<li>`). The action-passthrough note in Task 2 Step 2 ("confirm they pass the whole `input`") is a read-the-file instruction, not a placeholder — the items actions were written in Phase 6b to spread `input` into the core.

**Type consistency:** `computeAutoTrack` return (`{ stockDelta: number | null; stockUpdated: boolean }`) is consumed identically in the core. `autoTrackStock?: boolean` is threaded consistently core→action→form→MCP. `note?: string` on `assignTagCore` matches the action + MCP `tag_item` (`note: notes`) + the picker's `assignTag({ itemId, tagId, note })`. `assignedNotes: Record<string, string | null>` matches the page's `Object.fromEntries(... [tag.id, notes])`. `ensureStoreTag(householdId, string | null)` matches both call sites passing `clean(input.store)`. The item page `select` gains `autoTrackStock` + tag `notes`, matching the `ItemRow` type additions.
