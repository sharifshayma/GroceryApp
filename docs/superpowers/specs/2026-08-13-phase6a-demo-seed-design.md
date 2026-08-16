# GroceryApp Migration — Phase 6a (demo household seed) design

**Date:** 2026-08-13
**Status:** Design, pending user review
**Depends on:** Phases 1–5 (full app + MCP) — complete & pushed on `next-migration`.

## Scope

Implement `prisma/seed.ts` + a `npm run seed:demo` command that (re)creates a **realistic demo
household** in the Prisma Postgres DB, accessible via a **seeded email+password login**. This fills the
already-wired-but-empty `prisma.seed` hook (`package.json` → `"seed": "tsx prisma/seed.ts"`). The demo
showcases every subsystem: bilingual catalog, tags, active + completed lists, stock with low-stock
"need to buy", and price history with a cheapest pick.

## Out of scope

Real data migration off Supabase → **Phase 6b** (separate; needs Supabase source access). No demo MCP
token (the demo user can mint one in `/settings`). No "one-click try demo" login-page button (chosen
model is a seeded email+password login).

## Decisions

- **Access:** a seeded demo user with a known **email + password**; the script prints the credentials.
- **Idempotent:** `seed:demo` is safely re-runnable — it resets (deletes) any existing demo household +
  user by the demo email, then recreates from scratch.
- **Bilingual content, English-facing user:** items/categories carry `nameHe` (showcasing the bilingual
  feature); the demo user's `language` is `en`.
- **Credential creation (the one real risk):** creating the demo login. `auth.api.signUpEmail(...)`
  runs the `nextCookies` plugin, which calls `next/headers` `cookies()` — that throws outside a request
  scope (a plain `tsx` script). **Recommended approach:** create the credential **directly** — insert
  the `User` row, then an `Account` row with `providerId: "credential"`, `accountId: <userId>`,
  `password: <better-auth hash>` (via better-auth's password hashing from `better-auth/crypto`). The
  plan prototypes this first and verifies a real sign-in succeeds before building the rest.

## Data model

No schema changes. Writes to existing tables: `User` + `Account` (credential), `Household`, `Category`
(via `seedDefaultCategories`), `Item`, `Tag`, `ItemTag`, `GroceryList`, `ListItem`, `Stock`,
`PriceHistory`.

## Components

### 1. `prisma/seed.ts` — the demo seed (run by `prisma db seed`)

Structure (top-level `main()`), using `@/lib/prisma` + the reusable `seedDefaultCategories`/
`DEFAULT_CATEGORIES`:

1. **Constants:** `DEMO_EMAIL` (e.g. `demo@grocery.app`), `DEMO_PASSWORD` (a clear demo string),
   `DEMO_NAME`, `DEMO_HOUSEHOLD` name.
2. **Idempotent reset:** find the user by `DEMO_EMAIL`; if found, delete their `householdId` household
   (cascades categories/items/tags/lists/stock/prices/tokens) then delete the user (cascades
   accounts/sessions). Safe when absent.
3. **Create the demo user + credential** (the prototyped approach): `User` row (`email`, `name`,
   `displayName`, `emailVerified: true`, `language: "en"`) + `Account` row (`providerId: "credential"`,
   `accountId: user.id`, `password:` better-auth hash of `DEMO_PASSWORD`).
4. **Create the household + owner:** `Household` (name, `inviteCode` via `generateInviteCode()`,
   `createdById`); set the user's `householdId` + `role: "owner"`; `seedDefaultCategories(prisma, hh.id)`.
5. **Seed content** (a small helper builds a `name → categoryId` map from the seeded categories):
   - **~14 items** (bilingual `name`/`nameHe`, `emoji`, `defaultUnit`, mapped to appropriate default
     categories) — e.g. Milk/חלב, Eggs/ביצים, Yogurt/יוגורט, Bread/לחם, Bananas/בננות, Tomatoes/עגבניות,
     Cucumber/מלפפון, Chicken/עוף, Rice/אורז, Pasta/פסטה, Olive Oil/שמן זית, Coffee/קפה, Dish
     Soap/סבון כלים, Paper Towels/מגבות נייר.
   - **3 tags** — one each of `recipe` (e.g. "Weeknight Pasta"), `store` (e.g. "SuperSol"), `custom`
     (e.g. "Organic") — with a few `ItemTag` links.
   - **2 lists** — "This Week" (`status: active`) with ~6 lines, 2–3 marked `isBought`; "Last Week"
     (`status: completed`, `completedAt` set) with all lines bought.
   - **Stock** for ~7 items; 2 with `quantity <= lowThreshold` (low → appear in Need-to-buy).
   - **Price history** for ~4 items with 1–2 entries each at different stores (e.g. Milk cheaper at one
     store) to showcase the cheapest pick.
6. **Print** the demo login (email + password) + a one-line content summary; exit cleanly
   (`prisma.$disconnect()`), non-zero on error.

### 2. `package.json` — the command

Add `"seed:demo": "prisma db seed"` (reuses the `prisma.seed` hook = `tsx prisma/seed.ts`; `prisma db
seed` loads `.env`, so `DATABASE_URL` + better-auth env are present). `tsx` is already a devDependency.

## Authorization / integrity rules

- The demo household is a normal household — fully isolated by the same household scoping as any real
  one; seeding it grants no special access. The demo password is intentionally public (a demo account).
- The reset step only ever deletes the household + user matching `DEMO_EMAIL` — never touches other data.
- The seed runs against whatever `DATABASE_URL` points to; intended for the shared Prisma Postgres so the
  demo is reachable (coexists with real data post-cutover), matching the storefront demo approach.

## Testing

- No unit tests (a data script). Correctness is verified by running it + checking effects.
- **Controller verification (live DB):**
  1. `npm run seed:demo` → completes, prints credentials + summary.
  2. **Login works:** POST the demo email/password to the better-auth sign-in endpoint
     (`/api/auth/sign-in/email`) on a running dev server → a session/200 (proves the seeded credential is
     valid — the prototyped risk).
  3. **Content present:** query the demo household → expected counts (categories, ~14 items, 3 tags, 2
     lists with the right statuses, ~7 stock rows incl. 2 low, price entries); Need-to-buy shows the low
     items; a priced item shows a cheapest store.
  4. **Idempotent:** run `seed:demo` again → succeeds, no duplicate demo household, counts stable.

## Verification

Manual: `npm run seed:demo`; sign in as the demo user on `npm run dev` and confirm the dashboard shows
the seeded catalog/lists/stock/prices; re-run the seed and confirm it resets cleanly. The demo household
is left in place (it is the deliverable). Branch stays `next-migration`.
