# M5 Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the restoration — the Profile tab (replacing the M1 stub), restored Manage Categories / Manage Tags screens, the ShareSheet (re-wired into Lists), item add/edit/delete on the Home screen, and a cutover-cleanup pass — so the whole branch (M1–M5) is ready to merge to `main`.

**Architecture:** Continue on branch `feat/ui-restoration`. Reuse existing actions (`createItem`/`updateItem`/`deleteItem`, category/tag CRUD, `assignTag`/`unassignTag`, MCP token actions) + the M2 `BottomSheet`/`ItemImage`/`ItemPhotoField`, `useT()`, and name helpers; add one small action (`updateDisplayName`). Rebuild the plain manager components into the original designs; port ShareSheet + AddItemModal.

**Tech Stack:** Next.js 16 (RSC + server actions), React 19, Prisma 6, Tailwind v4, Vitest 4, TypeScript.

## Global Constraints

- **Branch:** `feat/ui-restoration`. After M5, this branch merges to `main` (the M1–M5 cutover). Personal git identity (`sharifshayma`).
- **No schema changes / migrations.** Reuse existing actions/cores. The ONLY backend addition is `updateDisplayName` (thin, session-scoped).
- **Reference:** `cb425ac:src-vite-legacy/` — `pages/{Profile,ManageCategories,ManageTags}.jsx`, `components/{ShareSheet,AddItemModal,McpTokensSection}.jsx`. Match them.
- **Deferred / out of scope:** `FeedbackModal` (no feedback backend; the original's "Send Feedback" button is dropped). The `grocerylist.shayma.me` hardcoded share domain in the original ShareSheet → use `window.location.origin` instead.
- **Data mapping (Supabase → Prisma):** `display_name`→`displayName`, `invite_code`→`inviteCode`, `household_id`→`householdId`, `list_items`→`items`, `li.items`→`li.item`, `is_bought`→`isBought`, `li.items.categories`→`li.item.category`. `getItemName`/`getCategoryName` take a `locale` 2nd arg.
- **RTL:** logical CSS properties only. `useT()` for `t`/`locale`. All hooks at top. No `Date.now()`/`new Date()` in client render (client-time-only values like share links go in event handlers, and `window.location.origin` is fine in a handler).
- Each task ends `tsc`+`lint`+`build` clean (and `vitest` where tests exist).

---

## File Structure

**Create:**
- `src/actions/profile.ts` — `updateDisplayName`.
- `src/components/ShareSheet.tsx` — ported list-share sheet.
- `src/components/profile/ProfileClient.tsx` — the Profile screen client.
- `src/components/AddItemModal.tsx` — ported item add/edit sheet.

**Modify:**
- `src/app/(app)/profile/page.tsx` — replace the M1 stub with the real Profile (RSC loader → `ProfileClient`).
- `src/components/ListsManager.tsx`, `src/components/lists/ShoppingList.tsx` — re-add the Share buttons (→ `ShareSheet`), now that it exists.
- `src/components/CategoryManager.tsx`, `src/components/TagManager.tsx` — rebuild to the original Manage Categories / Manage Tags designs.
- `src/components/home/HomeClient.tsx` (+ `ItemCard`) — item edit/delete on Home cards + an "add item" affordance opening `AddItemModal`.
- `src/components/Icons.tsx` — add `IconShare`, `IconLink`, `IconClose` (port; `IconCopy`/`IconEdit`/`IconTrash` already exist).
- Cutover cleanup (Task 6): `src/app/globals.css` (remove legacy tokens), delete orphaned `src/app/(app)/{items,settings}/page.tsx` + `src/lib/partition-lists.ts`, eslint sweep.

---

### Task 1: `ShareSheet` + icons + re-wire Share into Lists

**Files:**
- Create: `src/components/ShareSheet.tsx`
- Modify: `src/components/Icons.tsx`, `src/components/ListsManager.tsx`, `src/components/lists/ShoppingList.tsx`

**Interfaces:**
- Produces: `ShareSheet({ list, onClose })` where `list = { id, name, items: { item: { name, nameHe, emoji, category: { name, nameHe, emoji } | null } | null; isBought: boolean; quantity: number; unit: string; notes: string | null }[] }`. Client-side share-as-text / copy / share-link (uses `navigator.share`/`clipboard`, `window.location.origin`). Re-added Share buttons on the Lists overview cards + the shopping-mode header.

- [ ] **Step 1: Icons** — port `IconShare`, `IconLink`, `IconClose` from `cb425ac:src-vite-legacy/components/Icons.jsx` into `src/components/Icons.tsx` (typed). `IconCopy` already exists.
- [ ] **Step 2: Port `ShareSheet`** — `cb425ac:src-vite-legacy/components/ShareSheet.jsx` → `src/components/ShareSheet.tsx`: wrap in `<BottomSheet onClose={onClose}>`; `"use client"`, named export; `useT()`; `li.items`→`li.item`, `li.items.categories`→`li.item.category`, `is_bought`→`isBought`, `getItemName(li.item, locale)`/`getCategoryName(li.item.category, locale)`; replace the hardcoded `grocerylist.shayma.me` with `window.location.origin` (computed inside the handlers). Keep the three actions (Share as Text / Copy / Share Link), the `copied` state, and the grouping/text-building byte-faithful.
- [ ] **Step 3: Re-wire Share** — add the Share buttons back (they were omitted in M3): in `ListsManager` (the active-list card + each other-list card) and `ShoppingList` (the header), a Share button opening `ShareSheet` for that list. The list data passed must include `items` with `item.category` — **expand the `/lists` and `/lists/[id]` loaders' item selects** to include `item.category { name, nameHe, emoji }` and `item.nameHe` if not already present.
- [ ] **Step 4: Build + smoke** — `npm run build` clean; dev: Share on a list opens the sheet; Copy/Share-as-Text produce the grouped list text.
- [ ] **Step 5: Commit** — `feat(lists): ShareSheet + re-wire Share into Lists`

---

### Task 2: Profile screen (replace the M1 stub)

**Files:**
- Create: `src/actions/profile.ts`, `src/components/profile/ProfileClient.tsx`
- Modify: `src/app/(app)/profile/page.tsx`

**Interfaces:**
- Produces: `updateDisplayName(name: string): Promise<Result>` (updates the session user's `displayName`); the Profile screen — user info (editable name), Language (`LanguageToggle`), Household (invite via `navigator.share`/clipboard of `${origin}/join/${inviteCode}` + members list), MCP tokens (`McpTokensCard`), and Sign out (`LogoutButton`). Ports `cb425ac:src-vite-legacy/pages/Profile.jsx` (minus FeedbackModal).

- [ ] **Step 1: Action** — `src/actions/profile.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guard";

export async function updateDisplayName(name: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Please enter a name" };
  const user = await requireUser();
  await prisma.user.update({ where: { id: user.id }, data: { displayName: trimmed } });
  revalidatePath("/profile");
  return { ok: true };
}
```

- [ ] **Step 2: RSC loader** — replace `src/app/(app)/profile/page.tsx` (`dynamic="force-dynamic"`): load the current user (`getCurrentUser` → `{ id, email }` + `displayName` via `prisma.user.findUnique`), the household (`getCurrentHousehold` → `{ id, name, inviteCode }`), the household members (`prisma.user.findMany({ where: { householdId }, select: { id, displayName, email } })`), and the MCP tokens (`listMcpTokens(user.id)` as `/settings` does). Render `<ProfileClient user=... household=... members=... />` + `<McpTokensCard tokens=... />`.
- [ ] **Step 3: `ProfileClient`** — port the Profile.jsx layout: header, user-info card (inline name edit → `updateDisplayName` + `router.refresh()`), Language card (`LanguageToggle`), Household card (invite button → build `${window.location.origin}/join/${inviteCode}` and `navigator.share`/`clipboard` in the handler; members list with initials), and Sign out (`LogoutButton` from `@/components/LogoutButton`). Drop the Feedback button. `useT()`; logical CSS.
- [ ] **Step 4: Build + smoke** — `npm run build` clean; dev: `/profile` shows name/email (editable), language toggle, household + invite, MCP token card, logout — no "coming in M5" stub remains.
- [ ] **Step 5: Commit** — `feat(profile): restore Profile screen (name, language, household, MCP tokens, logout)`

---

### Task 3: Manage Categories (restyle)

**Files:**
- Modify: `src/components/CategoryManager.tsx` (+ its `/categories` page if the loader needs more fields)

**Interfaces:**
- Produces: the Manage Categories screen restyled to `cb425ac:src-vite-legacy/pages/ManageCategories.jsx` — a back header, the list of categories (emoji + name, drag/reorder or sortOrder controls if the original had them, edit/delete), and an add-category form. Wire to the existing `createCategory`/`updateCategory`/`deleteCategory`/`moveCategory` actions (already present).

- [ ] **Step 1: Port** the original ManageCategories UI into `CategoryManager.tsx` (keep it a `"use client"` component fed by the `/categories` RSC loader): `useT()`, `getCategoryName(cat, locale)`, the restored card/list styling, add form, edit-inline, delete-confirm, and reorder (map the original's reorder to `moveCategory` if it exists; else omit reorder). Match the original's classes/strings; logical CSS.
- [ ] **Step 2: Build + smoke** — `npm run build` clean; dev: `/categories` (reached from Home settings gear + Profile) shows the restored design; add/edit/delete work.
- [ ] **Step 3: Commit** — `feat(categories): restore Manage Categories design`

---

### Task 4: Manage Tags (restyle)

**Files:**
- Modify: `src/components/TagManager.tsx` (+ its `/tags` page loader if needed)

**Interfaces:**
- Produces: Manage Tags restyled to `cb425ac:src-vite-legacy/pages/ManageTags.jsx` — tags grouped by type (Recipes / Stores / Custom), each with name + color + description, edit/delete, and an add-tag form (name, type, color, description). Wire to existing `createTag`/`updateTag`/`deleteTag` actions.

- [ ] **Step 1: Port** the original ManageTags UI into `TagManager.tsx`: `useT()`, the type-grouped list, color swatches, add/edit forms (type selector + color picker + description), delete-confirm. Match the original's design; logical CSS.
- [ ] **Step 2: Build + smoke** — `npm run build` clean; dev: `/tags` shows the restored design grouped by type; add/edit/delete work.
- [ ] **Step 3: Commit** — `feat(tags): restore Manage Tags design`

---

### Task 5: `AddItemModal` + item add/edit/delete on Home

**Files:**
- Create: `src/components/AddItemModal.tsx`
- Modify: `src/components/home/HomeClient.tsx`, `src/components/ItemCard.tsx`

**Interfaces:**
- Produces: `AddItemModal({ item, categories, tags, onClose })` — create (item null) or edit an item: name, nameHe, emoji, category, defaultUnit, photo (`ItemPhotoField`), tag assignment. Wires to `createItem`/`updateItem`/`deleteItem` + `assignTag`/`unassignTag`. On Home, `ItemCard` gets `showActions` (edit → open `AddItemModal` for that item; delete → confirm → `deleteItem`), and the Home header gets an "add item" (+) affordance opening `AddItemModal` with `item=null`.

- [ ] **Step 1: Port `AddItemModal`** — `cb425ac:src-vite-legacy/components/AddItemModal.jsx` → `src/components/AddItemModal.tsx` on `<BottomSheet>`: `"use client"`; `useT()`; map fields (`name_he`→`nameHe`, `default_unit`→`defaultUnit`, `auto_track_stock`→`autoTrackStock`); use the existing `ItemPhotoField` (`@/components/ItemPhotoField`) for the photo; category picker from `categories`; tag assignment via `assignTag`/`unassignTag` (or pass selected tags to `createItem`/`updateItem` if they accept them — check the action signatures). Create vs edit by presence of `item`. Delete button (edit mode) → `deleteItem` after confirm.
- [ ] **Step 2: Wire Home** — in `HomeClient`, add an "add item" (+) control (header or FAB) opening `AddItemModal` with `item=null` (pass `categories`/`tags` already loaded), and enable `ItemCard` `showActions` on the category-browser cards with `onEdit`→open `AddItemModal` for the item, `onDelete`→confirm + `deleteItem` + `router.refresh()`. (`ItemCard` already supports `showActions`/`onEdit`/`onDelete` from the M2 port.) `router.refresh()` after mutations.
- [ ] **Step 3: Build + smoke** — `npm run build` clean; dev: on Home, `+` opens the add-item sheet; creating an item shows it in its category; editing an item (photo/name/category/tags) persists; deleting removes it.
- [ ] **Step 4: Commit** — `feat(items): AddItemModal + item add/edit/delete on Home`

---

### Task 6: Cutover cleanup

**Files:**
- Modify: `src/app/globals.css` (remove legacy tokens)
- Delete: `src/app/(app)/items/page.tsx`, `src/app/(app)/settings/page.tsx`, `src/lib/partition-lists.ts` (+ its test) — if confirmed orphaned
- Modify: any lingering eslint-flagged files

**Interfaces:**
- Produces: a clean branch ready to merge — legacy theme tokens removed (all screens now use the restored tokens), orphaned pages/helpers deleted, `npm run lint` green.

- [ ] **Step 1: Remove legacy theme tokens** — in `src/app/globals.css`, delete the deprecated `:root` legacy block (`--paper/--ink/--brand/--brand-dark/--accent/--gold/--card/--muted/--border`) and its `@theme inline` mapping. First `grep -rnE "bg-brand|text-ink|bg-paper|border-border|text-brand|bg-card|text-muted|bg-accent|text-gold|brand-dark" src/` and restyle any remaining usages to the restored tokens (`primary`/`text`/`bg`/`neutral`/`surface`/…). Build must stay clean.
- [ ] **Step 2: Delete orphaned routes/helpers** — confirm nothing links to `/items` or `/settings` (the restored nav routes to `/`, `/lists`, `/stock`, `/profile`, `/categories`, `/tags`, `/create-list`, `/edit-list`, `/category`); `git grep -n '"/items"\|"/settings"'` should show only stale references. Delete `src/app/(app)/items/page.tsx`, `src/app/(app)/settings/page.tsx` (MCP tokens now live in Profile), and `src/lib/partition-lists.ts` + its test if unused (`git grep partitionLists`).
- [ ] **Step 3: ESLint sweep** — run `npx next lint`; resolve remaining errors (e.g. the `HomeClient` setState-in-effect — refactor or an eslint-disable with rationale; any residual `react-hooks/purity`). Goal: `npx next lint` clean.
- [ ] **Step 4: Full build + tsc + tests** — `npm run build` clean, `npx tsc --noEmit` clean, `npx vitest run` all pass.
- [ ] **Step 5: Commit** — `chore(ui): cutover cleanup — remove legacy tokens + orphaned pages, lint clean`

---

## Self-Review

**Spec coverage (M5 row):** Profile + LanguageToggle (Task 2) ✓; MCP tokens (Task 2, `McpTokensCard`) ✓; Manage Categories (Task 3) ✓; Manage Tags (Task 4) ✓; ShareSheet (Task 1) ✓; AddItemModal (Task 5) ✓. Plus cutover cleanup (Task 6).

**Deferred (flagged):** FeedbackModal (no backend); the hardcoded external share domain (replaced with `window.location.origin`).

**Type consistency:** `updateDisplayName` updates only the session user's `displayName` (from `requireUser()`). ShareSheet/AddItemModal reuse `BottomSheet`/`ItemImage`/`ItemPhotoField`. Item CRUD uses the existing `createItem`/`updateItem`/`deleteItem` (NOTE: `updateItem` requires `{ id, name, … }` and nulls omitted fields — `AddItemModal` must submit the FULL item, not a partial, to avoid wiping fields; confirm the action's field handling in Task 5 Step 1). Tag assignment via `assignTag`/`unassignTag`.

**Verify-before-relying (in-task):** the `moveCategory` action's shape (Task 3); whether `createItem`/`updateItem` accept tag ids or require separate `assignTag` calls (Task 5); `AddItemModal` must pass the full item to `updateItem` (field-nulling caveat); the `/lists` loader item select for ShareSheet (Task 1 Step 3). The implementer confirms each against the code.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-16-ui-restoration-m5-profile.md`. Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, two-stage review between tasks.
2. **Inline Execution** — execute tasks in this session with checkpoints.

Which approach? (After M5 + a final whole-branch review, we do the **M1–M5 cutover**: merge `feat/ui-restoration` → `main` → deploy the fully restored app.)
