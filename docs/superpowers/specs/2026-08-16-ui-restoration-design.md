# GroceryApp — UI Restoration design

**Date:** 2026-08-16
**Status:** Design, pending user review
**Depends on:** Phases 1–7 + 6c–6f — complete. The app is **live** on `grocery.thatsmy.app`
(`main` auto-deploys). This restoration is UI-only and reuses that live backend unchanged.

## Context / problem

The Next.js migration carried over the **data, features, and backend** (auth, MCP, prices, stock,
photos, the Prisma schema) but **rebuilt the frontend from scratch**, and it came out as a plain
item list + a tiles "Dashboard" with a different, darker theme. Trying the live demo, the app "changed
dramatically from the original." This project restores the original app's **look, navigation model, and
screens** on top of the existing Next.js data layer.

The original app is preserved in git history at **`cb425ac:src-vite-legacy/`** — it is the visual and
behavioral reference for every screen below. (Original stack: Vite + React Router + react-i18next +
Supabase; mobile-first PWA.)

## Decisions (locked in brainstorming)

1. **Faithful mobile-first** — recreate the original exactly: a centered phone-width column
   (`max-w-lg mx-auto`), a bottom tab bar, slide-up sheets. On a laptop it's a centered column.
2. **Full parity** — every original screen and modal.
3. **English default + Hebrew toggle + RTL** — default locale English (already the `User.language`
   default), but fully restore the in-app language toggle and RTL; items show `nameHe` in Hebrew.
4. **Replace the current theme** with the original bright-orange + Nunito palette (this also restyles
   the login/signup pages).
5. **Retire the `/dashboard` tiles** — Home becomes the landing.
6. **Branch + staged cutover** — build on `feat/ui-restoration`; the live demo keeps running the current
   app until a coherent milestone (M1–M4) lands. **One design spec (this doc) → five per-milestone
   implementation plans.**

## Non-goals

- **No schema or backend changes.** No auth/MCP/mutation-core changes. The only data-layer addition is
  one **additive read query** (Frequently-Bought aggregation). No migrations.
- **No new product features** beyond restoring original parity. (Prices/unit-price, photos, and MCP
  tokens existed in the original too — they are restored, not invented.)
- No desktop-specific responsive layouts (explicitly deferred — faithful mobile-first only).

## Architecture / strategy

Rebuild the **UI layer only**. Reuse, unchanged:

- **Prisma schema** (all models already support parity — see Data mapping).
- **Server actions** (`src/actions/*`) and **mutation cores** (`src/lib/mutations/*`) for writes.
- **Read queries** (`src/lib/mcp-queries.ts`, `src/lib/need-to-buy.ts`) for reads, plus one new query.
- **i18n machinery** (`src/i18n/*` + `LocaleProvider`) — currently unused; this project wires it up.

Recreate the original screens/components 1:1 against this layer, mapping the old Supabase shapes to the
current Prisma shapes:

### Data mapping (old Supabase → current Prisma)

| Original (snake_case) | Current (Prisma) | Notes |
|---|---|---|
| `items.name` / `name_he` / `emoji` / `default_unit` / `notes` | `Item.name` / `nameHe` / `emoji` / `defaultUnit` / `notes` | + `photoUrl`, `autoTrackStock` |
| `items.category_id` | `Item.categoryId` | |
| `categories.name` / `name_he` / `emoji` | `Category.name` / `nameHe` / `emoji` | + `sortOrder`, `isDefault` |
| `tags.type` (`recipe`/`store`/`custom`) / `name` / `color` / `description` | `Tag.type` (enum `TagType`) / `name` / `color` / `description` | enum values identical |
| `item_tags.notes` | `ItemTag.notes` | |
| `grocery_lists.status` (`draft`/`active`/`completed`) / `name` | `GroceryList.status` (enum `ListStatus`) / `name` | + `completedAt` |
| `list_items.is_bought` / `quantity` / `unit` / `notes` | `ListItem.isBought` / `quantity` / `unit` / `notes` | + `boughtBy/At`, `stockUpdated` |
| stock rows (qty / threshold) | `Stock.quantity` / `lowThreshold` / `unit` | |

No parity data is missing from the schema. Bilingual display uses `getItemName`/`getCategoryName`
helpers (below).

## Theme restoration — `src/app/globals.css` + font

Replace the current tokens (brick `#b5542c` on `#fdf8f0`, no Nunito) with the **original design system**
(from `cb425ac:src-vite-legacy/index.css`):

- **Palette (CSS vars, exact):** `--color-primary #F28B30`, `primary-dark #E8611A`, `primary-light
  #F2A665`, `secondary #E8C840`, `secondary-light #F2E085`, `green #8BC34A`, `green-dark #5A9E3E`,
  `green-light #C5E1A5`, `neutral #D4C48A`, `bg #FFF8E7`, `surface #FFFFFF`, `danger #E8611A`,
  `text #3D2E1E`, `text-secondary #8A7A6A`.
- **Font:** **Nunito** via `next/font/google` (weights 400/500/600/700/800), exposed as `--font-sans`
  and applied on `<body>`.
- **Animations:** `fade-in`, `slide-up` (sheets), `backdrop-fade`, exposed as utilities
  `animate-fade-in` / `animate-slide-up` / `animate-backdrop` (Tailwind v4 `@utility`).
- **Mobile niceties:** `input,textarea,select { font-size:16px }` (no iOS zoom), `-webkit-tap-highlight-
  color: transparent`, `.no-scrollbar`, `env(safe-area-inset-*)` padding on fixed bars.

Token **names match the original** so ported component classes (`bg-surface`, `text-primary`,
`border-neutral`, `bg-danger`, `text-text-secondary`, `bg-bg`, …) resolve directly. The existing
`brand`/`ink`/`paper`/etc. tokens are removed; any current screen kept during the transition (auth pages)
is restyled to the new tokens as part of M1.

## i18n + RTL — wire up the existing machinery

The pieces exist (`getDictionary`, `dirFor`, `t`, `en`/`he` dictionaries, `LocaleProvider`, `useT()`) but
are unused (components hardcode `getDictionary("en")`). This project activates them:

- **Locale source:** the signed-in user's `User.language` (defaults `en`). The `(app)` layout reads it
  server-side and wraps children in `<LocaleProvider locale={user.language}>`; it also sets
  `<html lang dir>` (`dirFor(locale)`) so RTL flips document-wide.
- **Consume via `useT()`** in client components (`const { t, d, locale, dir } = useT()`), replacing every
  hardcoded `getDictionary("en")`.
- **LanguageToggle** (`src/components/LanguageToggle.tsx`) — a small control **on the Profile screen**
  (its location in the original) that calls a new `setLanguage` server action updating `User.language`,
  then refreshes so the provider + `<html dir>` update. Mirrors
  `cb425ac:src-vite-legacy/components/LanguageToggle.jsx`.
- **Bilingual display helpers** (`src/lib/i18n-names.ts`): `getItemName(item, locale)` →
  `locale==="he" ? (nameHe || name) : name`; `getCategoryName(category, locale)` likewise. Pure,
  unit-tested. (Ports `lib/itemName.js` / `lib/categoryName.js`.)
- **Dictionaries:** extend `en.ts`/`he.ts` with the strings the restored screens need (nav labels,
  Home sections "Need to Buy"/"Frequently Bought", filter labels, sheet copy, Stock/Lists/Profile). Keys
  grouped by screen. RTL-aware spacing uses logical properties (`ps-`/`pe-`/`start`/`end`) as the
  original did.

## App shell / navigation — `src/app/(app)/layout.tsx` + `TabBar`

- **Layout:** centered `max-w-lg mx-auto` column on `bg-bg`, `<main>` with bottom padding for the tab
  bar, `LocaleProvider` + `<html dir>` wiring, auth/household guards (unchanged: no user → `/login`,
  no household → `/onboarding`).
- **TabBar** (`src/components/TabBar.tsx`, ports `cb425ac:.../components/TabBar.jsx`): fixed bottom,
  `bg-surface border-t border-neutral`, safe-area padding, `max-w-lg` centered, four tabs with
  filled/outline icons:
  - **Home** `/` (active also on `/category/*`)
  - **Lists** `/lists`
  - **Stock** `/stock` — red **low-stock count badge** (from `getNeedToBuy`/stock)
  - **Profile** `/profile`
  Hidden when the on-screen keyboard is visible (port `useKeyboardVisible`).
- **Icons** (`src/components/Icons.tsx`): port the original SVG icon set (tab icons filled+outline,
  search, settings, chevrons, plus the no-results / no-items illustrations).
- **Routing changes:** retire `/dashboard` (delete the tiles page). `/` and post-login redirect →
  `/` Home (the `(app)` index). Existing feature routes are replaced by the restored screens (below).

## Screens (full parity)

Each is recreated to match its original file 1:1 in layout and behavior, on the Prisma/server-action
layer. Reference files are under `cb425ac:src-vite-legacy/`.

### Home — `pages/Home.jsx` (the main screen)
- Header ("Items"/"פריטים") + settings gear → Manage Categories / Manage Tags.
- **Search** (name / `nameHe` / notes) via `searchItems` (or client filter over loaded items).
- **Filter chips** (when not searching): Categories dropdown + Tag-type chips (Recipes 🍽️ / Stores 🏪 /
  Custom 🏷️ from `listTags(type)`), colored by `Tag.color`; multi-select mode.
- **Default view:** `HorizontalItemRow` "Need to Buy" 🔴 (from `getNeedToBuy`) + "Frequently Bought" ⭐
  (from the new `getFrequentlyBought`), then a **category-pill browser** → selected category's items as
  `ItemCard`s.
- Tap item → **AddToListModal**; multi-select → bulk add + list-picker sheet.
- Components: `ItemCard`, `ItemImage` (uses `photoUrl`, emoji fallback), `HorizontalItemRow`,
  `AddToListModal` — all ported from `.../components/`.

### Lists — `pages/Lists.jsx`, `CreateList.jsx`, `EditList.jsx`
- List index (open vs completed via `ListStatus`), list detail with **check-off** (calls the existing
  `setListItemBought` core → auto-stock via `stockUpdated`), create/edit, and **carry-over**
  (`CarryOverModal`) of un-bought items into a new list.

### Stock — `pages/Stock.jsx`
- Stock levels, low-stock highlighting (`quantity ≤ lowThreshold`), quantity + threshold editing via the
  existing stock cores/actions.

### Profile — `pages/Profile.jsx` (+ `ManageCategories.jsx`, `ManageTags.jsx`)
- Profile info, **LanguageToggle**, **MCP tokens** ("Connect to Claude" — port `McpTokensSection`, reuse
  the existing token-generation action/route), household/invite + **ShareSheet**, logout, and links to
  **Manage Categories** and **Manage Tags** (CRUD via existing category/tag actions).

### Category — `pages/Category.jsx`
- A single category's items as `ItemCard`s (the Home tab stays active for `/category/*`).

### Sheets / modals
- Port `AddToListModal`, `AddItemModal`, `CarryOverModal`, `ShareSheet` on a shared **bottom-sheet
  primitive** (`animate-slide-up` + `animate-backdrop`, safe-area). `AddToListModal` also manages stock
  for the tapped item (add-to-stock / update qty / update threshold) via existing stock actions.

## New data query — Frequently-Bought

`getFrequentlyBought(householdId, limit = 15)` in `src/lib/mcp-queries.ts`: aggregate `ListItem` rows with
`isBought = true` for the household's lists, count by `itemId`, return the top-N items (id, name, nameHe,
emoji, defaultUnit). Pure aggregation over existing data; additive; unit-tested on the counting/sort.
(Mirror of the original Home `fetchFrequent`.)

## Authorization / integrity

- All reads/writes go through the **existing household-scoped** queries, actions, and mutation cores;
  the UI adds **no new access surface**. `getFrequentlyBought` is scoped by `householdId` like its peers.
- `setLanguage` only updates the caller's own `User.language` (from the session).
- The auth/household guards in the `(app)` layout are preserved verbatim.

## Testing

- **Unit (pure logic):** `getItemName`/`getCategoryName` (locale fallbacks incl. missing `nameHe`);
  `getFrequentlyBought` counting/sort/limit; `dirFor` (already covered). Vitest.
- **Per-milestone live smoke (controller, against the demo household on `PORT` dev):** each milestone
  ends with an explicit smoke — e.g. M1: app shell renders, tab bar navigates, toggling language flips
  `<html dir>` and item names; M2: Need-to-Buy/Frequently-Bought/category browser render, tapping an item
  opens the sheet and adds to a list, bulk-add works; M3: check-off marks bought + moves stock; M4: low
  stock highlights + threshold edits persist; M5: language toggle persists, MCP token generates, category/
  tag CRUD works.
- **Visual parity check** against the original screen (side-by-side with `cb425ac:src-vite-legacy/`).
- `tsc`/`lint`/`vitest`/`build` clean each milestone.

## Delivery / milestones

Build on **`feat/ui-restoration`** (off `main`). Each milestone is its own implementation plan +
subagent-driven build + review, and a working increment.

| Milestone | Contents | Shippable |
|---|---|---|
| **M1 Foundation** | theme tokens + Nunito + animations; i18n/RTL wiring (LocaleProvider, `<html dir>`, `useT()` swap, helpers, `setLanguage`); app shell (`(app)` layout + TabBar + Icons); retire `/dashboard`; restyle auth pages | internal (nav works, screens still stubs) |
| **M2 Home** | Home screen + `ItemCard`/`ItemImage`/`HorizontalItemRow` + `AddToListModal` + bottom-sheet primitive + `getFrequentlyBought` + multi-select bulk add | ✅ core |
| **M3 Lists** | Lists index/detail (check-off→auto-stock)/create/edit + `CarryOverModal` | ✅ |
| **M4 Stock** | Stock levels + low-stock + threshold editing | ✅ |
| **M5 Profile** | Profile + LanguageToggle + MCP tokens + Manage Categories + Manage Tags + `ShareSheet` + `AddItemModal` | ✅ |

**Cutover:** merge `feat/ui-restoration` → `main` once **M1–M4** are coherent (Home / Lists / Stock
navigable through the tab bar); **M5 follows** on `main` (Profile replaces the current `/settings`).
Rollback-ready: `vercel rollback`, and the branch is revertible as one range; no DB changes to undo.

## Verification

`tsc`/`lint`/`vitest`/`build` clean; per-milestone live smoke passes on the demo household; visual parity
confirmed against `cb425ac:src-vite-legacy/`; language toggle flips document direction and item names;
the demo (`demo@grocery.app`) lands on the restored Home and can browse → add to a list → check off →
see stock move, all in the original look and feel. Branch merges to `main` at the M1–M4 cutover.
