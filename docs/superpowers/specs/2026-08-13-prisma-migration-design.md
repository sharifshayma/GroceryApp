# GroceryApp → Next.js + Prisma migration — design

**Date:** 2026-08-13
**Status:** Phase 1 design (roadmap + Foundation), pending user review

## Why

Two goals drive this migration:

1. **Get off Supabase.** The Supabase project keeps pausing (free-tier inactivity),
   taking the app offline until it's manually resumed.
2. **Own the schema, migrations, and seed in the repo** — Prisma-style — for control
   and repeatable demos, instead of the Supabase dashboard.

## Target stack

Match the stack already shipped in **FitFlow** and the **storefront**, so all three apps
share one set of patterns:

- **Next.js 16** (App Router, React Server Components, server actions) — replaces the Vite SPA.
- **Prisma + Prisma Postgres** — replaces Supabase Postgres. Always-on serverless, native
  Prisma pooling, schema/migrations/seed in-repo. (FitFlow already runs this.)
- **better-auth** (email + password, email-OTP reset) — replaces Supabase Auth.
- **Application-level authorization** (every query scoped by household) — replaces Postgres RLS.
- Keeps the app **bilingual EN/HE with RTL** and the **PWA**; MCP server is rebuilt on Prisma.

## Why a rebuild, not a DB swap

GroceryApp today is a **client-side Vite SPA** that talks directly to Supabase from the
browser (anon key), with **Row-Level Security** enforcing household isolation in the database.
Prisma is server-only — it cannot be called from a browser. So leaving Supabase forces a
server layer to exist, and every data operation must move behind it. Rebuilding on Next.js
(rather than bolting an API onto the Vite app) lets us reuse the storefront's proven
better-auth/Prisma/scoping/i18n-RTL/seed machinery wholesale, and puts data access in server
actions next to the UI — no separate API to design and secure.

## Repo strategy

Build in-place in the existing `GroceryApp` repo on a long-lived **`next-migration`** branch.
`main` (the live Vite/Supabase app) stays untouched and keeps serving grocerylist.shayma.me
until cutover. The branch replaces the Vite files with the Next.js app; the two stacks live
on different branches, never intermingled. Cutover (phase 7) is a merge.

## Phased roadmap

Each phase is its own design → plan → build → verify cycle. The live Supabase app keeps
running until phase 7.

1. **Foundation** (this spec) — Next.js skeleton, full Prisma schema + initial migration,
   Prisma Postgres, better-auth, household model, i18n scaffold, auth UI. You can sign up,
   log in, and create/join a household.
2. **Catalog** — categories, items, tags (master data + UI).
3. **Lists** — shopping lists, check-off mode, carry-over of unbought items.
4. **Stock & prices** — stock levels, low-stock alerts, price history.
5. **MCP server** — the "manage groceries from Claude" tools, rebuilt on Prisma + a token model.
6. **Demo seed + data migration** — Prisma seed (the card's demo login) and a one-time move of
   real Supabase data into Prisma Postgres.
7. **Deploy & cutover** — point grocerylist.shayma.me at the new app; retire Supabase.

**Interim demo:** the app card needs a working "Try the demo" login now, before this multi-phase
migration finishes. The already-written Supabase demo seed (`scripts/seed-demo.mjs` on the
`demo-household-seed` branch) can be run as a stopgap against the current live app — independent
of this migration — once the Supabase service-role key is available.

---

## Phase 1 — Foundation (detailed design)

**Goal:** the new app boots on the new stack. A user can sign up, log in, and create or join a
household. No grocery features yet.

### Prisma schema (translated from the Supabase SQL)

Phase 1 defines the **entire** schema + initial migration up front (so later phases add
features, not tables). Tables map as follows:

- `profiles` → folded into **User** (better-auth). better-auth's `User` carries id/name/email/
  timestamps; we extend it with `householdId?`, `role` (owner|member), `language` (en|he).
  A user belongs to **one** household (`householdId` nullable, `SetNull` on household delete) —
  faithful to today's behavior; not multi-household.
- `households` → **Household** { id, name, inviteCode @unique, createdById, createdAt } with
  relations to members (User[]), categories, items, tags, lists, stock, priceHistory, invitations.
- `categories` → **Category** { id, householdId, name, nameHe?, emoji, photoUrl?, sortOrder,
  isDefault, createdAt }.
- `items` → **Item** { id, householdId, categoryId?, name, nameHe?, emoji, defaultUnit, notes?,
  autoTrackStock=true, photoUrl?, photoPath?, createdById?, createdAt }.
- `tags` → **Tag** { id, householdId, name, type (enum recipe|store|custom), description?,
  color, createdAt }.
- `item_tags` → **ItemTag** { itemId, tagId, notes?, @@id([itemId, tagId]) }.
- `grocery_lists` → **GroceryList** { id, householdId, name, status (enum draft|active|completed),
  createdById?, createdAt, completedAt? }.
- `list_items` → **ListItem** { id, listId, itemId?, quantity, unit, isBought, boughtById?,
  boughtAt?, notes?, stockUpdated=false }.
- `stock` → **Stock** { id, householdId, itemId, quantity, unit, lowThreshold, updatedAt,
  updatedById?, @@unique([householdId, itemId]) }.
- `price_history` → **PriceHistory** { id, itemId, householdId, price, currency="ILS", store?,
  quantityAmount?, quantityUnit?, purchasedAt (date), loggedById?, createdAt }.
- `invitations` → **Invitation** { id, householdId, email?, invitedById?, status (enum
  pending|accepted|expired), createdAt }.
- `mcp_tokens` → **deferred to Phase 5** (MCP).

better-auth models (**User, Session, Account, Verification**) are added from the storefront's setup.

**Types:** `quantity`, `lowThreshold`, `quantityAmount` are `Float` (fractional quantities like
1.5 kg). `price` is `Decimal` (currency precision). All household-owned rows carry `householdId`;
child-of-child rows (ListItem, ItemTag) reach the household through their parent. FK deletes mirror
the Supabase schema (household delete cascades its data; user references `SetNull`).

### Auth (better-auth)

Copy the storefront's `auth-server.ts` setup: email + password enabled, email-OTP for password
reset. On signup the app creates the User; the user then **creates a household** (becomes `owner`)
or **joins one** via invite code (becomes `member`) — replacing the Supabase `handle_new_user`
trigger + client join flow. `language` defaults to `he`.

### Authorization (replaces RLS)

A `requireUser()` / `requireHousehold()` helper (mirroring the storefront's `requireStore`)
resolves the session user and their household. **Every** query and mutation is scoped by
`householdId = <current user's household>`; there is no unscoped data access. This is the
application-level replacement for the Postgres RLS policies.

### i18n

Reuse the storefront's bilingual-RTL i18n approach (dictionary + `t()` + locale provider,
`dir` switching). Phase 1 wires EN/HE and the RTL layout so the auth screens render correctly
in both; grocery-feature strings come in later phases.

### UI (Phase 1 only)

- **Signup**, **login**, **password-reset** pages (mirror storefront auth pages).
- **Create-or-join-household** screen (create with a name → become owner; or enter an invite
  code → join). 
- An authenticated **empty dashboard shell** (nav skeleton) proving the session + household load.

### Out of scope for Phase 1

Categories/items/lists/stock/prices UI, the MCP server, data migration, deploy/cutover. The
live Supabase app is untouched.

### Setup dependency

A **Prisma Postgres database** must be provisioned (a connection string in a gitignored `.env`).
This needs the user's Prisma account — handled at the start of Phase 1 build (spin one up and
paste the connection string, or run the Prisma setup while logged in).

### Testing

- Prisma schema validates (`prisma validate`) and the initial migration applies cleanly.
- Unit-test the pure auth/household helpers (invite-code generation, `requireHousehold` scoping
  logic) where they can be isolated from the DB.
- Manual: sign up → create household → log out → log in → see the household; join flow via a
  second account + invite code.

## Security / integrity principles (whole migration)

- No unscoped queries: every household-owned read/write filters by the current user's household,
  enforced in a shared data-access layer — the app-level stand-in for RLS.
- Invite codes are the only cross-household surface; joining requires a valid code.
- Secrets (DB URL, auth secret, service keys) live only in gitignored env, never committed.
