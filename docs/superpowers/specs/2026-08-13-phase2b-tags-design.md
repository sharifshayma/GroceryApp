# GroceryApp Migration — Phase 2b (Tags) design

**Date:** 2026-08-13
**Status:** Design, pending user review
**Depends on:** Phase 1 (Foundation) + Phase 2a (Categories + Items) — complete & verified.

## Scope

Complete the catalog: tag CRUD and item↔tag assignment. Tags have a `type`
(recipe / store / custom) and a color; items get tags via a **per-item picker**
(toggle assign/unassign). Ports the Vite app's `ManageTags` + `TagPicker`
(data layer: `lib/grocery.js` tag functions).

**Decisions:** assignment happens in a **per-item "Tags" picker modal** (not inside
the item edit form). **Per-assignment notes are deferred** (the `ItemTag.notes`
column stays for a later slice) — assignment is a simple on/off toggle.

## Out of scope (later phases)

`ItemTag.notes` editing, stock (Phase 4), lists (Phase 3), prices (Phase 4),
tag search / the store-tag ↔ price-tracking link (Phase 4/5), photos.

## Data model

Tables already exist from Phase 1 — no schema changes:
- **Tag**: `id, householdId, name, type (enum recipe|store|custom), description?, color (default #3B82F6), createdAt`.
- **ItemTag**: `@@id([itemId, tagId])`, `itemId`, `tagId`, `notes?`. FK `onDelete: Cascade`
  from both Item and Tag — so deleting a tag (or item) removes its assignments automatically.

## Components

### 1. Tag server actions — `src/actions/tags.ts`

All `"use server"`, `requireHousehold()`-scoped, returning `{ ok: true } | { ok: false; error: string }`:
- `createTag({ name, type, color })` — `type` must be one of `recipe|store|custom` (validate); default color `#3B82F6`.
- `updateTag({ id, name, type, color })` — scoped `updateMany` by `{ id, householdId }`, `count===0` → not found.
- `deleteTag(id)` — scoped `deleteMany`; ItemTag rows cascade away via the FK.
- `assignTag({ itemId, tagId })` — verify BOTH the item and the tag belong to the caller's
  household, then upsert the `ItemTag` (`@@id([itemId, tagId])`, idempotent). Reject if either
  doesn't belong to the household.
- `unassignTag({ itemId, tagId })` — delete the `ItemTag` for `{ itemId, tagId }` after the same
  household ownership check.

### 2. Tags page — `src/app/(app)/tags/page.tsx` + `src/components/TagManager.tsx`

- Server page reads the household's tags **with item counts** (`_count.items` on the `ItemTag`
  relation, or a group-by), ordered by `type` then `name`, scoped by `requireHousehold()`.
- `TagManager` (client): tags grouped by type (recipe/store/custom, each with its type icon
  🍽️/🏪/🏷️), each row showing name + color swatch + item count, with Edit / Delete (confirm,
  noting the assignment count) and an inline Add form (name, type `<select>`, color input). Calls
  the tag actions, `router.refresh()` on ok, shows errors. Uses the Phase-2a client conventions
  (`getDictionary("en")` + `t`, `Button`/`Input`).

### 3. Item tag assignment — extend `/items` (Phase 2a)

- The `/items` server page (`ItemManager`) additionally loads, per item, its assigned tags
  (`item.tags` → `ItemTag` → `Tag { id, name, color }`), and the household's full tag list.
- `ItemManager` gets, per item row: assigned-tag **chips** (name + color), and a **"Tags"** button
  opening an `ItemTagPicker` modal for that item. The picker lists all household tags grouped by
  type with a toggle (assigned/not) that calls `assignTag`/`unassignTag` then `router.refresh()`.
- The item create/edit form is unchanged (tags are managed via the picker on existing items).

### 4. Dashboard + i18n

- Dashboard (`/dashboard`) gains a **Tags** nav card with a count (alongside Categories/Items).
- Add a `catalog.tags` i18n group (+ any `catalog.nav.tags`) to both `en.ts` and `he.ts`
  (identical structure). English-facing pages.

## Authorization / integrity rules

- Every tag read/mutation scoped by `requireHousehold()`; no unscoped `prisma.tag`/`prisma.itemTag`.
- `assignTag`/`unassignTag` verify **both** the item and the tag belong to the household before
  touching `ItemTag` — an item can never be linked to another household's tag, or vice-versa.
- Tag delete relies on the FK cascade to clean up `ItemTag`; no orphaned assignments.

## Testing

- Unit-test any pure helper (e.g. a `tagType` validator, or grouping tags by type for display) if
  extracted.
- The actions are verified by build/typecheck + the manual smoke test: create tags of each type;
  assign/unassign to an item; item chips update; delete a tag and confirm its assignments vanish
  (item survives); household-scoping holds. Against the live Prisma Postgres from Phase 1.

## Verification

Manual smoke test on `npm run dev`: `/tags` create recipe/store/custom tags with colors → they
group by type with counts; on `/items`, open an item's Tags picker, assign two tags → chips appear
→ unassign one → chip removed; delete a tag → its chip disappears from the item, item still exists;
dashboard shows the tag count.
