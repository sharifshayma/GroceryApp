# GroceryApp Migration — Phase 3a (Lists + list items) design

**Date:** 2026-08-13
**Status:** Design, pending user review
**Depends on:** Phase 1 (Foundation) + Phase 2 (Catalog: categories, items, tags) — complete & verified.

## Scope

Shopping lists and their contents: create/rename/delete/duplicate a list, and add/edit/remove
the items on a list (drawn from the catalog). Ports the Vite app's `Lists`/`CreateList`/`EditList`
+ `lib/grocery.js` list functions. **Shopping check-off and complete/carry-over are Phase 3b.**

## Out of scope (later phases / 3b)

Marking items bought (check-off), completing a list, carry-over of unbought items (all **3b**);
stock (Phase 4), prices (Phase 4), MCP (Phase 5), the `searchLists`/`findOpenListItem` helpers
(fold into MCP, Phase 5).

## Data model

Tables already exist from Phase 1 — no schema changes:
- **GroceryList**: `id, householdId, name, status (enum draft|active|completed, default draft),
  createdById?, createdAt, completedAt?`.
- **ListItem**: `id, listId, itemId?, quantity (Float, default 1), unit (default "pcs"), isBought
  (default false), boughtById?, boughtAt?, notes?, stockUpdated`.
  - Phase 3a sets `listId, itemId, quantity, unit, notes`. `isBought`/`boughtById`/`boughtAt`/
    `stockUpdated` stay at defaults (Phase 3b owns them).

**Status:** lists are created `draft`. Phase 3a treats **open** (`draft` or `active`) vs
`completed` for grouping only; it does not transition status (3b sets `completed`). The `active`
value is unused this phase.

## Components

### 1. List server actions — `src/actions/lists.ts`

All `"use server"`, `requireHousehold()`-scoped, returning `{ ok: true } | { ok: false; error: string }`.
Because `ListItem` has no `householdId` of its own, ownership is checked through the parent list.
- `createList({ name })` — creates a `draft` list for the household (with `createdById`); returns
  `{ ok: true, id }` so the UI can navigate to `/lists/<id>`.
- `renameList({ id, name })` — scoped `updateMany` by `{ id, householdId }`, `count===0` → not found.
- `deleteList(id)` — scoped `deleteMany`; `ListItem` rows cascade via the FK (`onDelete: Cascade`).
- `duplicateList(id)` — in a `$transaction`: load the household's list + its items, create a new
  `draft` list named `"<name> (copy)"`, copy each item's `itemId/quantity/unit/notes`. Returns
  `{ ok: true, id }`.

### 2. List-item server actions — `src/actions/list-items.ts`

All `"use server"`, `requireHousehold()`-scoped. Ownership verified via the parent list.
- `addListItem({ listId, itemId, quantity, unit, notes })` — verify the **list** belongs to the
  household AND the **item** belongs to the household; then create the `ListItem`.
- `updateListItem({ listItemId, quantity, unit, notes })` — verify the list_item's list belongs to
  the household; update the mutable fields.
- `removeListItem(listItemId)` — verify ownership via the list; delete.

A shared helper resolves + authorizes: `listOwned(householdId, listId)` and
`listItemListId(householdId, listItemId)` (returns the list id if the list_item's list belongs to
the household, else null).

### 3. Pages (under the `(app)` guard)

- **`/lists`** (server, reads the household's lists with an item count, split into open vs
  completed) → a client list-of-lists with a **Create list** inline form (name), and per-row links
  to `/lists/<id>`, plus rename / delete / duplicate.
- **`/lists/[id]`** (server, reads the list + its items (with each item's name/emoji/defaultUnit) +
  the household's catalog items for the add picker) → a client `ListDetail`:
  - list name (with rename) + delete + duplicate,
  - the list's items (emoji + name + quantity + unit + notes), each editable (quantity/unit/notes)
    and removable,
  - an **Add item** control: pick a catalog item (select/search), quantity, unit (defaulting to the
    item's `defaultUnit`), optional notes → `addListItem`.
  - A 404 (`notFound()`) if the list isn't in the household.

### 4. Dashboard + i18n

- Dashboard gains a **Lists** nav card with a count (open lists), alongside Categories/Items/Tags.
- Add a `lists` i18n group (+ `catalog.nav.lists`, or a top-level `lists.*`) to both `en.ts` and
  `he.ts` (identical structure). English-facing pages.

## Authorization / integrity rules

- Every list/list-item read and mutation scoped by `requireHousehold()`; no unscoped
  `prisma.groceryList`/`prisma.listItem`.
- `ListItem` ownership is always checked through its parent list's `householdId` (list_items carry
  no household of their own) — a caller can never touch a list_item on another household's list.
- `addListItem` additionally verifies the catalog item belongs to the household — a list can never
  reference another household's item.
- Deleting a list cascades its list_items via the FK; deleting a catalog item (Phase 2a) leaves its
  list_items with `itemId` null (FK `SetNull`) — the list row survives (shown as a removed/unknown
  item; the detail view handles a null item gracefully).

## Testing

- Unit-test any pure helper extracted (e.g. splitting lists into open/completed groups, or a
  `listItemDefaults(item)` that derives default unit/quantity).
- Actions verified by build/typecheck + the manual smoke test: create a list; add catalog items;
  edit an item's quantity/notes; remove one; rename, duplicate, delete the list; scoping holds.
  Against the live Prisma Postgres from Phase 1.

## Verification

Manual smoke test on `npm run dev`: `/lists` create a list → open `/lists/<id>` → add two catalog
items with quantities → edit one's quantity/notes → remove one → rename the list → duplicate it
(the copy has the same items) → delete the original; `/dashboard` shows the open-list count.
Confirm no cross-household access.
