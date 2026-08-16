# GroceryApp

A household grocery management app for families and roommates. Create shopping lists, track what's in stock, and never forget what you need at the store.

**Live demo (current `main` app):** [grocerylist.shayma.me](https://grocerylist.shayma.me)

> **Branch note:** This is the `next-migration` branch — an in-progress rebuild of GroceryApp on Next.js + Prisma. `main` remains the live Vite + Supabase app and keeps serving the demo above until this branch is cut over. Phase 1 (this branch, so far) stands up the app shell, database schema, and auth/household foundation only — grocery list/stock/catalog features have not been ported yet.

## Tech Stack (next-migration branch)

- **Framework:** Next.js 16 (App Router), React 19, TypeScript
- **Database:** Prisma 6 + Prisma Postgres (via the Accelerate extension)
- **Auth:** better-auth (email + password, email-OTP password reset)
- **Styling:** Tailwind CSS 4
- **Validation:** Zod
- **Testing:** Vitest
- **i18n:** Custom EN/HE dictionary + `t()` helper, with RTL support for Hebrew

## Getting Started

### Prerequisites

- Node.js 18+
- A [Prisma](https://www.prisma.io) account (for Prisma Postgres — free tier is enough for local dev)

### Setup

1. Clone the repo and check out this branch:
   ```bash
   git clone https://github.com/sharifshayma/GroceryApp.git
   cd GroceryApp
   git checkout next-migration
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Provision a Prisma Postgres database:
   ```bash
   npx prisma init --db
   ```
   This logs you into Prisma (or prompts you to sign up), creates a Prisma Postgres database, and prints a `DATABASE_URL` (routed through Accelerate) and `DIRECT_URL` (direct connection, used for migrations).

4. Create your environment file:
   ```bash
   cp .env.example .env
   ```
   Fill in `.env` (gitignored — never commit it):
   ```
   DATABASE_URL="prisma+postgres://accelerate.prisma-data.net/?api_key=..."   # from step 3
   DIRECT_URL="postgres://USER:PASSWORD@HOST:5432/DB"                        # from step 3
   BETTER_AUTH_SECRET=""   # generate with: openssl rand -base64 32
   BETTER_AUTH_URL="http://localhost:3000"
   RESEND_API_KEY=""       # optional — needed only to actually send password-reset emails
   ```

5. Create the database schema:
   ```bash
   npx prisma migrate dev
   ```

6. Start the dev server:
   ```bash
   npm run dev
   ```
   The app runs at [http://localhost:3000](http://localhost:3000). Sign up at `/signup`, log in at `/login`.

### Verification (no database required)

```bash
npx tsc --noEmit   # typecheck
npm run test       # vitest
npm run lint       # eslint
npm run build      # prisma generate + next build
```

## Project Structure (next-migration branch)

```
prisma/
  schema.prisma        # full data model (auth tables + household/grocery domain)
src/
  app/
    (auth)/             # /login, /signup, /reset
    (app)/dashboard/     # authenticated shell (guarded: user + household required)
    onboarding/          # create-or-join household
    api/auth/[...all]/   # better-auth route handler
  actions/              # server actions (signUp, createHousehold, joinHousehold)
  lib/                  # prisma client, auth server/client/guard, household context,
                         # invite-code generator, validations, resend email helper
  i18n/                 # EN/HE dictionaries + t()/dirFor() helpers, LocaleProvider
  components/           # UI primitives + onboarding/auth components
src-vite-legacy/        # the old Vite + Supabase app, kept for reference during migration
```

## Connect to Claude (not yet ported)

The `main` branch exposes an MCP (Model Context Protocol) server at `/api/mcp` for managing groceries from Claude. This has **not** been ported to the Next.js stack yet — it's planned for a later migration phase. See `main`'s README for how it currently works.

## License

MIT
