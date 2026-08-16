# GroceryApp Migration — Phase 3b (Shopping: check-off + carry-over) design

**Date:** 2026-08-13
**Status:** Design, pending user review
**Depends on:** Phase 1 + Phase 2 + Phase 3a (Lists + items) — complete & verified.

## Scope

The shopping flow on top of Phase 3a's lists: check items off as bought, see progress, and
**complete** a list — carrying any unbought items into a fresh list, or completing anyway. Ports
the Vite app's shopping/complete flow (`setListItemBought`, `completeAndCarryOver`,
`updateListStatus`).

## Out of scope (later phases)

The explicit "start shopping" (`draft`→`active`) transition (deferred — grouping is open =
`draft`|`active`, so it changes nothing visible); stock auto-decrement on bought (Phase 4 — the
`stockUpdated` flag stays untouched); `boughtQuantity` overrides; prices (Phase 4); MCP (Phase 5).

## Data model

No schema changes. This phase uses the `ListItem` fields Phase 3a left at defaults:
- `ListItem.isBought` (default false), `boughtById?`, `boughtAt?`.
- `GroceryList.status` → set to `completed`, and `completedAt` set, on completion.

## Components

### 1. `setListItemBought` — add to `src/actions/list-items.ts`

`"use server"`, `requireHousehold()`-scoped, ownership via the parent list (reuse `listItemListId`
from Phase 3a). `setListItemBought({ listItemId, isBought })`:
- when `isBought` true → set `isBought: true, boughtById: <current user>, boughtAt: now`;
- when false → set `isBought: false, boughtById: null, boughtAt: null`.
Returns `{ ok: true } | { ok: false; error: string }`. `revalidatePath` the list detail.

### 2. `completeList` — add to `src/actions/lists.ts`

`"use server"`, `requireHousehold()`-scoped. `completeList({ listId, carryOver })`:
- Verify the list belongs to the household (load it + its items scoped by `{ id, householdId }`);
  not found → `{ ok: false, error }`.
- In a `$transaction`: set the list `status: "completed", completedAt: now`. If `carryOver` is true
  AND there are unbought items, create a new **draft** list `"<name> (carried over)"` for the
  household with those unbought items (copy `itemId/quantity/unit/notes`; new items start unbought).
- Returns `{ ok: true; carriedOverListId?: string } | { ok: false; error: string }` —
  `carriedOverListId` is present only when a carry-over list was created.

### 3. UI — extend `src/components/ListDetail.tsx` (Phase 3a)

The `/lists/[id]` detail page's item select gains `isBought`, `boughtAt` (the server page adds them).
`ListDetail` gains:
- **Per-item bought checkbox** → `setListItemBought({ listItemId, isBought })` then `router.refresh()`;
  bought rows render dimmed + strikethrough. (Only shown when the list is open, not completed.)
- **Progress line**: "{bought} of {total} bought" (a small pure helper computes the counts).
- **Complete control** (open lists only): a **Complete list** button.
  - If all items are bought (or the list is empty) → `completeList({ listId, carryOver: false })`.
  - If some are unbought → show two choices: **Carry over unbought** (`completeList({ listId,
    carryOver: true })`) and **Complete anyway** (`completeList({ listId, carryOver: false })`).
  - After completion: if `carriedOverListId` is returned → `router.push('/lists/<id>')` (open the new
    list); otherwise → `router.push('/lists')`.
- **Completed state**: when `list.status === "completed"`, show a "Completed" badge and hide the
  bought checkboxes + Complete control + the add/edit item controls (a completed list is read-only).
  The item rows still render (with their bought state).

### 4. Dashboard + i18n

- **No dashboard change needed** — the open-list count already filters `status in (draft, active)`,
  so completing a list drops it out of the count automatically.
- Add the Phase-3b strings (bought, progress, complete, carryOver, completeAnyway, completed badge,
  the "(carried over)" suffix) to the `lists` i18n group in BOTH `en.ts` and `he.ts`.

## Authorization / integrity rules

- `setListItemBought` authorizes through the parent list (list_items carry no household); a caller
  can never mark a list_item bought on another household's list.
- `completeList` loads + mutates only the household's own list; the carry-over list is created for
  the same household. No unscoped `prisma.groceryList`/`prisma.listItem`.
- Completing is idempotent-safe: re-completing an already-completed list just re-sets completed
  fields (or is prevented in the UI by hiding the control on completed lists).

## Testing

- Unit-test a pure `shoppingProgress(items)` helper → `{ bought, total }` (all bought, none, mixed,
  empty).
- Actions verified by build/typecheck + lint + the manual smoke test: create a list, add items,
  check some off (progress updates), complete with **carry over** (new list appears with the unbought
  items, marked unbought; original is completed), and complete another **anyway** (no carry-over);
  scoping holds. Against the live Prisma Postgres.

## Verification

Manual smoke test on `npm run dev`: on a list with 3 items, check 2 → progress "2 of 3 bought" →
**Complete list** → choose **Carry over** → original is Completed (badge, read-only), a new
"<name> (carried over)" draft list holds the 1 unbought item (unbought); dashboard open-count reflects
the swap. Repeat with **Complete anyway** on a fully-unbought list → completed, no new list. Confirm
a completed list hides the shopping controls. Cross-household check-off/complete is rejected.
