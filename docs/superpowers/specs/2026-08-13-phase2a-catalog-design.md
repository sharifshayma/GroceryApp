# GroceryApp Migration — Phase 2a (Categories + Items) design

**Date:** 2026-08-13
**Status:** Design, pending user review
**Depends on:** Phase 1 (Foundation) — complete & verified.

## Scope

Phase 2 (Catalog) is split into **2a (this doc): categories + items**, and **2b: tags** (next).
Item **photos are deferred** to a later slice — items keep their emoji for now.

Build the master-data layer on the new stack: seed default categories per household, and full
CRUD for categories and items — as Prisma server actions scoped by `requireHousehold()`, with
pages in the Phase-1 Next.js/Tailwind style. Ports the behavior of the Vite app's
`useCategories`/`useItems`/`ManageCategories`/`AddItemModal` (data layer: `lib/grocery.js`).

## Out of scope (later phases)

Tags + item↔tag assignment (2b), item photos (later 2 slice), stock (Phase 4), lists (Phase 3),
prices (Phase 4), search endpoints (fold into MCP, Phase 5). No changes to auth/household.

## Data model

All tables already exist from Phase 1 (`Category`, `Item`). No schema changes. Recap of the fields
this phase uses:
- **Category**: `id, householdId, name, nameHe?, emoji (default 📦), photoUrl?, sortOrder, isDefault, createdAt`.
- **Item**: `id, householdId, categoryId?, name, nameHe?, emoji (default 🛒), defaultUnit (default "pcs"), notes?, autoTrackStock, photoUrl?, photoPath?, createdById?, createdAt`.
  - Phase 2a sets `name, nameHe, emoji, defaultUnit, notes, categoryId, createdById`. `photoUrl/photoPath` stay null (photos deferred).

## Components

### 1. Default categories — `src/lib/default-categories.ts` + seed on household creation

- Port the 21 bilingual default categories from the Vite app's `src/lib/seedCategories.js` into
  `DEFAULT_CATEGORIES` (`{ name, nameHe, emoji }[]`, sort order = array index + 1).
- `seedDefaultCategories(householdId: string): Promise<void>` — inserts them (`isDefault: true`)
  for a household, via `prisma.category.createMany`.
- **Wire into `createHousehold`** (`src/actions/auth.ts`, Phase 1): after the household is created
  and the owner assigned (inside the existing `$transaction`), seed the defaults so every new
  household starts with the standard categories — matching today's behavior. `joinHousehold` does
  NOT seed (the household already has them).

### 2. Category server actions — `src/actions/categories.ts`

All `"use server"`, all resolve `requireHousehold()` and scope every query/mutation by
`household.id` (returning `{ ok: true } | { ok: false; error: string }`):
- `createCategory({ name, nameHe, emoji })` — appends at `sortOrder = max+1`.
- `updateCategory({ id, name, nameHe, emoji })` — scoped `updateMany` (throws/returns notFound if count 0).
- `deleteCategory(id)` — scoped delete. Items in that category have `categoryId` set null (FK `SetNull`),
  so items survive as "uncategorized".
- `moveCategory({ id, direction: "up" | "down" })` — swaps `sortOrder` with the adjacent category in
  the household's ordering (mirrors the Vite up/down swap), in a `$transaction`.

### 3. Item server actions — `src/actions/items.ts`

`"use server"`, `requireHousehold()`-scoped, `{ ok }|{ ok:false; error }`:
- `createItem({ categoryId, name, nameHe, emoji, defaultUnit, notes })` — sets `householdId`,
  `createdById`. `categoryId` optional; if provided, verify it belongs to the household.
- `updateItem({ id, categoryId, name, nameHe, emoji, defaultUnit, notes })` — scoped update.
- `deleteItem(id)` — scoped delete (cascades any future list/stock rows via FKs; none yet in 2a).

### 4. Pages (under the Phase-1 `(app)` group, so they inherit the auth+household guard)

- **`/categories`** (server page reads categories via `prisma`, ordered by `sortOrder`) →
  `CategoryManager` client component: list with emoji + name (+ Hebrew), inline add, edit, delete,
  and up/down reorder buttons calling the actions, with `router.refresh()` after each.
- **`/items`** (server page reads items with their category, grouped/labeled by category) →
  an item list + an **Add/Edit item** form (modal or inline panel): category `<select>`, name,
  Hebrew name, emoji, unit, notes. Create/edit/delete via the actions.
- **Dashboard** (`/dashboard`): replace the Phase-1 empty-state with nav cards/links to
  **Categories** and **Items** (and a short count summary). The empty i18n string is replaced.

### 5. i18n

Add a `catalog` (or `categories`/`items`) key group to `src/i18n/dictionaries/{en,he}.ts` for all
new labels (headings, form fields, buttons, empty states, confirms). English-facing for now (pages
call `getDictionary("en")`, per the Phase-1 convention), with Hebrew values present for structural
parity and future switching.

## Data-integrity / authorization rules

- Every read and mutation is scoped by the caller's `household.id` (via `requireHousehold()`), the
  app-level RLS replacement — no cross-household access.
- `categoryId` on item create/update must reference a category in the same household (verified before
  write); otherwise the action returns an error.
- Deleting a category never deletes its items (they become uncategorized via `SetNull`).

## Testing

- Unit-test the **pure** pieces (no DB): `default-categories.ts` (21 entries, unique names, sort
  order sequential, bilingual), and any pure helper extracted from the reorder/`sortOrder` logic
  (e.g. a `swapOrder(list, id, direction)` that computes the two updates — test that up/down at the
  ends is a no-op and the middle swaps correctly).
- Server actions are verified by build/typecheck + a manual smoke test at the end (create category →
  add item in it → edit → reorder → delete), against the live Prisma Postgres from Phase 1.

## Verification

Manual smoke test on `npm run dev`: new-signup household shows the 21 seeded categories; add a
custom category; add an item under it; edit the item; reorder categories; delete a category and
confirm its items become uncategorized (not deleted).
