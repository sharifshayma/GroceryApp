# GroceryApp Migration — Phase 1 (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up GroceryApp on the new stack — a Next.js app with the full Prisma schema, Prisma Postgres, better-auth, and a household model — so a user can sign up, log in, and create or join a household. No grocery features yet.

**Architecture:** Replace the Vite SPA with a Next.js 16 App Router app on the `next-migration` branch. Data access moves to server actions/components using Prisma against Prisma Postgres. Auth is better-auth (email+password, email-OTP reset). Household isolation is enforced in the application layer (a `requireHousehold()` helper), replacing Supabase RLS. Ported patterns come from the storefront app at `/Users/balanceshayma/Documents/GitHub/argw` (referred to below as **STOREFRONT**).

**Tech Stack:** Next.js 16.2.10, React 19.2.4, Prisma 6 + Prisma Postgres, better-auth ^1.6.26, Tailwind v4, Zod ^4, Vitest ^3, TypeScript.

## Global Constraints

- Work only on the `next-migration` branch of `/Users/balanceshayma/Documents/GitHub/GroceryApp`. Never touch `main` (the live Vite/Supabase app).
- `@/*` path alias maps to `./src/*` (matches STOREFRONT `tsconfig.json`).
- Bilingual **EN / HE**; `he` is RTL and the default language (`Language @default(he)`). (STOREFRONT uses EN/AR — same machinery, different second language.)
- No unscoped data access: every household-owned query/mutation filters by the current user's `householdId`. This is the app-level replacement for RLS.
- A user belongs to **one** household (`User.householdId` nullable, `SetNull` on household delete), with `role` owner|member. Not multi-household.
- Money/price is `Decimal`; quantities (`quantity`, `lowThreshold`, `quantityAmount`) are `Float`.
- Secrets (DATABASE_URL, DIRECT_URL, BETTER_AUTH_SECRET) live only in gitignored `.env` — never committed.
- Prisma Postgres requires the Accelerate client extension (`@prisma/extension-accelerate` + `.$extends(withAccelerate())`).

## File structure (Phase 1)

```
prisma/schema.prisma          # full schema (all tables) + initial migration
src/lib/prisma.ts             # Prisma client (Accelerate-extended)
src/lib/auth-server.ts        # better-auth server instance
src/lib/auth-client.ts        # better-auth React client
src/lib/auth-guard.ts         # getCurrentUser / requireUser
src/lib/household-context.ts  # getCurrentHousehold / requireHousehold
src/lib/invite-code.ts        # generateInviteCode (pure, tested)
src/lib/validations.ts        # zod schemas (signup, createHousehold, joinHousehold)
src/actions/auth.ts           # signUp, createHousehold, joinHousehold server actions
src/app/api/auth/[...all]/route.ts   # better-auth route handler
src/app/layout.tsx, globals.css, page.tsx
src/app/(auth)/signup, login, reset  # auth pages
src/app/onboarding/page.tsx   # create-or-join household
src/app/(app)/dashboard/page.tsx     # empty authenticated shell
src/i18n/{index.ts,LocaleProvider.tsx,dictionaries/{en,he}.ts}
```

---

### Task 1: Scaffold the Next.js app (replace Vite)

**Files:**
- Delete: `index.html`, `vite.config.js`, `src/main.jsx` (and other Vite entry files), the Vite-specific `eslint.config.js` if present
- Create: `package.json` (rewritten), `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`, `.env.example`, `vitest.config.mts`, `vitest.setup.ts`
- Modify: `.gitignore` (add `.next`, `.env*`)

**Interfaces:**
- Produces: a booting Next.js app. `npm run dev` serves a placeholder page; `npm run build` succeeds.

- [ ] **Step 1: Move the old Vite `src/` aside**

The existing Vite React components are ported feature-by-feature in later phases, not reused wholesale now. Move them out of the way so the Next `src/` is clean:

```bash
cd /Users/balanceshayma/Documents/GitHub/GroceryApp
git mv src src-vite-legacy
mkdir -p src/app src/lib src/i18n
```

- [ ] **Step 2: Write `package.json`**

Mirror STOREFRONT's `package.json` scripts/deps. Exact content:

```json
{
  "name": "groceryapp",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "prisma generate && next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:migrate": "prisma migrate deploy"
  },
  "prisma": { "seed": "tsx prisma/seed.ts" },
  "dependencies": {
    "@prisma/client": "^6.19.3",
    "@prisma/extension-accelerate": "^2.0.2",
    "better-auth": "^1.6.26",
    "clsx": "^2.1.1",
    "lucide-react": "^1.23.0",
    "next": "16.2.10",
    "prisma": "^6.19.3",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "resend": "^6.17.2",
    "tailwind-merge": "^3.6.0",
    "tsx": "^4.23.0",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@testing-library/jest-dom": "^7.0.0",
    "@testing-library/react": "^16.3.2",
    "@testing-library/user-event": "^14.6.3",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@vitejs/plugin-react": "^6.0.5",
    "eslint": "^9",
    "eslint-config-next": "16.2.10",
    "happy-dom": "^20.11.2",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```

- [ ] **Step 3: Copy config files from STOREFRONT, adapting**

Copy verbatim from STOREFRONT: `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `vitest.config.mts`, `vitest.setup.ts`, `eslint.config.mjs` (or `.js`). For `next.config.ts`, drop the `images.remotePatterns` block for now (no uploads in Phase 1) — leave `const nextConfig: NextConfig = {}`.

```bash
A=/Users/balanceshayma/Documents/GitHub/argw
for f in tsconfig.json postcss.config.mjs vitest.config.mts vitest.setup.ts; do cp "$A/$f" ./; done
```

- [ ] **Step 4: Write minimal `src/app/layout.tsx`, `globals.css`, `page.tsx`**

```tsx
// src/app/layout.tsx
import "./globals.css";

export const metadata = { title: "GroceryApp" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

```css
/* src/app/globals.css */
@import "tailwindcss";
```

```tsx
// src/app/page.tsx
export default function Home() {
  return <main style={{ padding: 24 }}>GroceryApp — Next.js foundation.</main>;
}
```

- [ ] **Step 5: Write `.env.example`**

```bash
# --- Database (Prisma Postgres) ---
# From `npx prisma init --db` or the Prisma console. DATABASE_URL routes through
# Accelerate; DIRECT_URL is the direct connection used for migrations.
DATABASE_URL="prisma+postgres://accelerate.prisma-data.net/?api_key=..."
DIRECT_URL="postgres://USER:PASSWORD@HOST:5432/DB"

# --- Auth (better-auth) ---
BETTER_AUTH_SECRET=""            # openssl rand -base64 32
BETTER_AUTH_URL="http://localhost:3000"

# --- Email (Resend) — optional ---
RESEND_API_KEY=""
```

- [ ] **Step 6: Install and verify the build**

```bash
npm install
npm run build
```
Expected: build succeeds (Prisma generate will no-op until Task 2 adds a schema — if it errors on a missing schema, proceed to Task 2 and re-run build there). If build blocks on Prisma, temporarily change the build script to `next build` for this step, then restore `prisma generate && next build` in Task 2.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(phase1): scaffold Next.js app, move Vite app to src-vite-legacy"
```

---

### Task 2: Prisma schema, client, and Prisma Postgres

**Files:**
- Create: `prisma/schema.prisma`, `src/lib/prisma.ts`
- Create: `prisma/migrations/**` (generated by `prisma migrate`)

**Interfaces:**
- Produces: `import { prisma } from "@/lib/prisma"` — an Accelerate-extended PrismaClient. All models below available on it.

- [ ] **Step 1: Provision Prisma Postgres** (setup dependency — needs the user's Prisma account)

Run `npx prisma init --db` (prompts a Prisma login + creates a Prisma Postgres database) OR create one in the Prisma console and copy its connection strings. Put `DATABASE_URL` and `DIRECT_URL` into a gitignored `.env`. Confirm `.env` is ignored (`git check-ignore .env`).

- [ ] **Step 2: Write `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

enum Role { owner member }
enum Language { en he }
enum TagType { recipe store custom }
enum ListStatus { draft active completed }
enum InvitationStatus { pending accepted expired }

// ---- better-auth ----
model User {
  id            String    @id
  name          String
  email         String    @unique
  emailVerified Boolean   @default(false)
  image         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  sessions      Session[]
  accounts      Account[]

  // profile fields (folds the old `profiles` table into the user)
  householdId String?
  household   Household? @relation("HouseholdMembers", fields: [householdId], references: [id], onDelete: SetNull)
  role        Role       @default(member)
  language    Language   @default(he)
  displayName String?

  createdHouseholds Household[] @relation("HouseholdCreator")

  @@map("user")
}

model Session {
  id        String   @id
  expiresAt DateTime
  token     String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  ipAddress String?
  userAgent String?
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
  @@map("session")
}

model Account {
  id                    String    @id
  accountId             String
  providerId            String
  userId                String
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  accessToken           String?
  refreshToken          String?
  idToken               String?
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  password              String?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  @@index([userId])
  @@map("account")
}

model Verification {
  id         String   @id
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  @@index([identifier])
  @@map("verification")
}

// ---- GroceryApp domain ----
model Household {
  id          String   @id @default(cuid())
  name        String
  inviteCode  String   @unique
  createdById String?
  createdBy   User?    @relation("HouseholdCreator", fields: [createdById], references: [id], onDelete: SetNull)
  createdAt   DateTime @default(now())

  members      User[]         @relation("HouseholdMembers")
  categories   Category[]
  items        Item[]
  tags         Tag[]
  lists        GroceryList[]
  stock        Stock[]
  priceHistory PriceHistory[]
  invitations  Invitation[]

  @@index([inviteCode])
}

model Category {
  id          String    @id @default(cuid())
  householdId String
  household   Household @relation(fields: [householdId], references: [id], onDelete: Cascade)
  name        String
  nameHe      String?
  emoji       String    @default("📦")
  photoUrl    String?
  sortOrder   Int       @default(0)
  isDefault   Boolean   @default(false)
  createdAt   DateTime  @default(now())
  items       Item[]
  @@index([householdId])
}

model Item {
  id             String    @id @default(cuid())
  householdId    String
  household      Household @relation(fields: [householdId], references: [id], onDelete: Cascade)
  categoryId     String?
  category       Category? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  name           String
  nameHe         String?
  emoji          String    @default("🛒")
  defaultUnit    String    @default("pcs")
  notes          String?
  autoTrackStock Boolean   @default(true)
  photoUrl       String?
  photoPath      String?
  createdById    String?
  createdAt      DateTime  @default(now())
  tags           ItemTag[]
  listItems      ListItem[]
  stock          Stock[]
  priceHistory   PriceHistory[]
  @@index([householdId])
  @@index([categoryId])
}

model Tag {
  id          String    @id @default(cuid())
  householdId String
  household   Household @relation(fields: [householdId], references: [id], onDelete: Cascade)
  name        String
  type        TagType
  description String?
  color       String    @default("#3B82F6")
  createdAt   DateTime  @default(now())
  items       ItemTag[]
  @@index([householdId])
}

model ItemTag {
  itemId String
  item   Item   @relation(fields: [itemId], references: [id], onDelete: Cascade)
  tagId  String
  tag    Tag    @relation(fields: [tagId], references: [id], onDelete: Cascade)
  notes  String?
  @@id([itemId, tagId])
}

model GroceryList {
  id          String     @id @default(cuid())
  householdId String
  household   Household  @relation(fields: [householdId], references: [id], onDelete: Cascade)
  name        String
  status      ListStatus @default(draft)
  createdById String?
  createdAt   DateTime   @default(now())
  completedAt DateTime?
  items       ListItem[]
  @@index([householdId])
}

model ListItem {
  id           String       @id @default(cuid())
  listId       String
  list         GroceryList  @relation(fields: [listId], references: [id], onDelete: Cascade)
  itemId       String?
  item         Item?        @relation(fields: [itemId], references: [id], onDelete: Cascade)
  quantity     Float        @default(1)
  unit         String       @default("pcs")
  isBought     Boolean      @default(false)
  boughtById   String?
  boughtAt     DateTime?
  notes        String?
  stockUpdated Boolean      @default(false)
  @@index([listId])
}

model Stock {
  id           String    @id @default(cuid())
  householdId  String
  household    Household @relation(fields: [householdId], references: [id], onDelete: Cascade)
  itemId       String
  item         Item      @relation(fields: [itemId], references: [id], onDelete: Cascade)
  quantity     Float     @default(0)
  unit         String    @default("pcs")
  lowThreshold Float     @default(1)
  updatedAt    DateTime  @updatedAt
  updatedById  String?
  @@unique([householdId, itemId])
  @@index([householdId])
}

model PriceHistory {
  id             String    @id @default(cuid())
  itemId         String
  item           Item      @relation(fields: [itemId], references: [id], onDelete: Cascade)
  householdId    String
  household      Household @relation(fields: [householdId], references: [id], onDelete: Cascade)
  price          Decimal
  currency       String    @default("ILS")
  store          String?
  quantityAmount Float?
  quantityUnit   String?
  purchasedAt    DateTime  @default(now()) @db.Date
  loggedById     String?
  createdAt      DateTime  @default(now())
  @@index([itemId])
  @@index([householdId])
}

model Invitation {
  id          String           @id @default(cuid())
  householdId String
  household   Household        @relation(fields: [householdId], references: [id], onDelete: Cascade)
  email       String?
  invitedById String?
  status      InvitationStatus @default(pending)
  createdAt   DateTime         @default(now())
  @@index([householdId])
}
```

- [ ] **Step 3: Validate + create the initial migration**

```bash
npx prisma validate
npx prisma migrate dev --name init
```
Expected: `prisma validate` passes; the migration applies to Prisma Postgres and `prisma/migrations/*_init/migration.sql` is created.

- [ ] **Step 4: Write `src/lib/prisma.ts` (Accelerate-extended)**

```ts
import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof makeClient>;
};

function makeClient() {
  return new PrismaClient().$extends(withAccelerate());
}

export const prisma = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

- [ ] **Step 5: Verify generate + typecheck**

```bash
npx prisma generate
npx tsc --noEmit
```
Expected: both clean. Restore the build script to `prisma generate && next build` if it was temporarily changed in Task 1, and run `npm run build` — succeeds.

- [ ] **Step 6: Commit**

```bash
git add prisma src/lib/prisma.ts package.json
git commit -m "feat(phase1): full Prisma schema, Prisma Postgres, Accelerate client"
```

---

### Task 3: better-auth (server, client, route, guard)

**Files:**
- Create: `src/lib/auth-server.ts`, `src/lib/auth-client.ts`, `src/lib/auth-guard.ts`, `src/app/api/auth/[...all]/route.ts`, `src/lib/resend.ts`

**Interfaces:**
- Consumes: `prisma` (Task 2).
- Produces:
  - `auth` (better-auth instance) from `@/lib/auth-server`.
  - `getCurrentUser(): Promise<{id,email,name} | null>` and `requireUser()` from `@/lib/auth-guard`.
  - `authClient`, `signIn`, `signOut`, `useSession` from `@/lib/auth-client`.

- [ ] **Step 1: Port `auth-server.ts` from STOREFRONT**

Copy `/Users/balanceshayma/Documents/GitHub/argw/src/lib/auth-server.ts` verbatim. It already wires `prismaAdapter(prisma, { provider: "postgresql" })`, `emailAndPassword.enabled`, the `emailOTP` reset plugin, and `nextCookies()`. Its only import that needs to exist is `sendPasswordResetOtp` from `@/lib/resend`.

- [ ] **Step 2: Port `resend.ts` (minimal)**

Copy STOREFRONT `src/lib/resend.ts`. If it references store-specific copy, reduce it to a single `sendPasswordResetOtp(email: string, otp: string)` that sends via Resend when `RESEND_API_KEY` is set and logs a warning otherwise. The function signature `sendPasswordResetOtp(email: string, otp: string): Promise<void>` must match what `auth-server.ts` calls.

- [ ] **Step 3: Port `auth-client.ts`, `auth-guard.ts`, and the route handler verbatim**

```ts
// src/lib/auth-client.ts
import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";
export const authClient = createAuthClient({ plugins: [emailOTPClient()] });
export const { signIn, signOut, useSession } = authClient;
```

```ts
// src/lib/auth-guard.ts
import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth-server";

export type CurrentUser = { id: string; email: string; name: string };

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const { id, email, name } = session.user;
  return { id, email, name };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}
```

```ts
// src/app/api/auth/[...all]/route.ts
import { auth } from "@/lib/auth-server";
import { toNextJsHandler } from "better-auth/next-js";
export const { GET, POST } = toNextJsHandler(auth.handler);
```

- [ ] **Step 4: Typecheck + build**

```bash
npx tsc --noEmit && npm run build
```
Expected: clean. (A `BETTER_AUTH_SECRET` must be set in `.env` for the app to run; build does not require it.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth-server.ts src/lib/auth-client.ts src/lib/auth-guard.ts src/lib/resend.ts "src/app/api/auth/[...all]/route.ts"
git commit -m "feat(phase1): better-auth server/client/route/guard"
```

---

### Task 4: Household model — invite code, context, actions

**Files:**
- Create: `src/lib/invite-code.ts`, `src/lib/household-context.ts`, `src/lib/validations.ts`, `src/actions/auth.ts`
- Test: `src/lib/__tests__/invite-code.test.ts`

**Interfaces:**
- Consumes: `prisma`, `auth`, `getCurrentUser`/`requireUser`.
- Produces:
  - `generateInviteCode(): string` — 8-char lowercase alphanumeric.
  - `getCurrentHousehold(): Promise<Household | null>`, `requireHousehold(): Promise<Household>` from `@/lib/household-context`.
  - server actions from `@/actions/auth`: `signUp(input)`, `createHousehold(name)`, `joinHousehold(code)`, each returning `{ ok: true } | { ok: false; error: string }`.

- [ ] **Step 1: Write the failing test for `generateInviteCode`**

```ts
// src/lib/__tests__/invite-code.test.ts
import { describe, it, expect } from "vitest";
import { generateInviteCode } from "@/lib/invite-code";

describe("generateInviteCode", () => {
  it("returns an 8-char lowercase alphanumeric code", () => {
    for (let i = 0; i < 50; i++) {
      const c = generateInviteCode();
      expect(c).toMatch(/^[a-z0-9]{8}$/);
    }
  });
  it("is highly unlikely to collide across many draws", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) seen.add(generateInviteCode());
    expect(seen.size).toBeGreaterThan(495);
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/lib/__tests__/invite-code.test.ts` — FAIL (module not found).

- [ ] **Step 3: Implement `invite-code.ts`**

```ts
// src/lib/invite-code.ts
import { randomBytes } from "node:crypto";

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

// 8-char lowercase alphanumeric code (mirrors the old Supabase invite_code shape).
export function generateInviteCode(): string {
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx vitest run src/lib/__tests__/invite-code.test.ts` — PASS.

- [ ] **Step 5: Write `household-context.ts`**

```ts
// src/lib/household-context.ts
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-guard";
import type { Household } from "@prisma/client";

export const getCurrentHousehold = cache(async (): Promise<Household | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { household: true },
  });
  return row?.household ?? null;
});

export async function requireHousehold(): Promise<Household> {
  const hh = await getCurrentHousehold();
  if (!hh) throw new Error("No household");
  return hh;
}
```

- [ ] **Step 6: Write `validations.ts`**

```ts
// src/lib/validations.ts
import { z } from "zod";

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().trim().min(1),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const createHouseholdSchema = z.object({ name: z.string().trim().min(1) });
export const joinHouseholdSchema = z.object({ code: z.string().trim().length(8) });
```

- [ ] **Step 7: Write `src/actions/auth.ts`**

```ts
"use server";

import { auth } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-guard";
import { generateInviteCode } from "@/lib/invite-code";
import {
  signupSchema,
  createHouseholdSchema,
  joinHouseholdSchema,
  type SignupInput,
} from "@/lib/validations";

type Result = { ok: true } | { ok: false; error: string };

export async function signUp(input: SignupInput): Promise<Result> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid signup details" };
  const { email, password, displayName } = parsed.data;
  try {
    const res = await auth.api.signUpEmail({ body: { email, password, name: displayName } });
    await prisma.user.update({ where: { id: res.user.id }, data: { displayName } });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? (e as { body?: { message?: string } }).body?.message ?? e.message : "";
    if (msg.includes("USER_ALREADY_EXISTS")) return { ok: false, error: "That email is already registered" };
    return { ok: false, error: "Could not create the account" };
  }
}

export async function createHousehold(name: string): Promise<Result> {
  const parsed = createHouseholdSchema.safeParse({ name });
  if (!parsed.success) return { ok: false, error: "Please enter a household name" };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  // Retry on the (rare) inviteCode unique collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const hh = await prisma.household.create({
        data: { name: parsed.data.name, inviteCode: generateInviteCode(), createdById: user.id },
      });
      await prisma.user.update({
        where: { id: user.id },
        data: { householdId: hh.id, role: "owner" },
      });
      return { ok: true };
    } catch (e) {
      if (attempt === 4) return { ok: false, error: "Could not create the household" };
    }
  }
  return { ok: false, error: "Could not create the household" };
}

export async function joinHousehold(code: string): Promise<Result> {
  const parsed = joinHouseholdSchema.safeParse({ code });
  if (!parsed.success) return { ok: false, error: "Enter a valid 8-character code" };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Unauthorized" };
  const hh = await prisma.household.findUnique({ where: { inviteCode: parsed.data.code } });
  if (!hh) return { ok: false, error: "No household found for that code" };
  await prisma.user.update({
    where: { id: user.id },
    data: { householdId: hh.id, role: "member" },
  });
  return { ok: true };
}
```

- [ ] **Step 8: Typecheck + run tests + build**

```bash
npx tsc --noEmit && npx vitest run src/lib/__tests__/invite-code.test.ts && npm run build
```
Expected: all clean/pass.

- [ ] **Step 9: Commit**

```bash
git add src/lib/invite-code.ts src/lib/household-context.ts src/lib/validations.ts src/actions/auth.ts src/lib/__tests__/invite-code.test.ts
git commit -m "feat(phase1): household model — invite code, context, auth actions"
```

---

### Task 5: i18n scaffold (EN/HE + RTL)

**Files:**
- Create: `src/i18n/index.ts`, `src/i18n/LocaleProvider.tsx`, `src/i18n/dictionaries/en.ts`, `src/i18n/dictionaries/he.ts`
- Test: `src/i18n/__tests__/t.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `getDictionary(locale)`, `t(dict, path, vars?)`, `dirFor(locale)`, `type Locale = "en" | "he"`, and `LocaleProvider` + `useT()` for client components.

- [ ] **Step 1: Port `index.ts` from STOREFRONT, adapting AR→HE**

Copy STOREFRONT `src/i18n/index.ts`, replacing every `ar` with `he`: `import { he } from "./dictionaries/he"`, `type Locale = "en" | "he"`, `getDictionary` returns `en` for `"en"` else `he`, and `dirFor` returns `"ltr"` for `"en"` else `"rtl"`. Keep the `t()` function verbatim (it's the exact dot-path interpolator shown in the storefront).

- [ ] **Step 2: Write `t.test.ts`**

```ts
// src/i18n/__tests__/t.test.ts
import { describe, it, expect } from "vitest";
import { getDictionary, t, dirFor } from "@/i18n";

describe("i18n", () => {
  it("resolves a dotted key in both languages", () => {
    expect(t(getDictionary("en"), "auth.login.title")).toBe("Log in");
    expect(typeof t(getDictionary("he"), "auth.login.title")).toBe("string");
  });
  it("interpolates vars", () => {
    // 'common.greeting' = "Hi, {name}" in en
    expect(t(getDictionary("en"), "common.greeting", { name: "Sam" })).toBe("Hi, Sam");
  });
  it("returns the key path when missing", () => {
    expect(t(getDictionary("en"), "does.not.exist")).toBe("does.not.exist");
  });
  it("maps he to rtl and en to ltr", () => {
    expect(dirFor("he")).toBe("rtl");
    expect(dirFor("en")).toBe("ltr");
  });
});
```

- [ ] **Step 3: Write the two dictionaries with the Phase-1 keys the tests + UI need**

`src/i18n/dictionaries/en.ts` (and a parallel `he.ts` with Hebrew values):

```ts
// src/i18n/dictionaries/en.ts
export const en = {
  common: { greeting: "Hi, {name}", save: "Save", saving: "Saving...", loading: "Loading..." },
  auth: {
    login: { title: "Log in", email: "Email", password: "Password", submit: "Log in", noAccount: "No account? Sign up" },
    signup: { title: "Create account", name: "Your name", submit: "Sign up", haveAccount: "Have an account? Log in" },
    reset: { title: "Reset password", sendCode: "Send code", code: "Code", newPassword: "New password", submit: "Reset" },
    logout: "Log out",
  },
  onboarding: {
    title: "Set up your household",
    create: { heading: "Create a household", name: "Household name", submit: "Create" },
    join: { heading: "Join a household", code: "Invite code", submit: "Join" },
  },
  dashboard: { title: "Dashboard", empty: "Your household is set up. Grocery features are coming next." },
} as const;
```

`he.ts` mirrors the same key structure with Hebrew strings (e.g. `login.title: "התחברות"`, `signup.title: "יצירת חשבון"`, `onboarding.title: "הגדרת משק הבית"`, etc.), and `common.greeting: "שלום, {name}"`.

- [ ] **Step 4: Port `LocaleProvider.tsx` from STOREFRONT**

Copy STOREFRONT `src/i18n/LocaleProvider.tsx`, adapting the `Locale` type to `"en" | "he"`. It exposes `<LocaleProvider locale=... dict=...>` and a `useT()` hook returning `{ t }` for client components.

- [ ] **Step 5: Run tests + typecheck**

```bash
npx vitest run src/i18n/__tests__/t.test.ts && npx tsc --noEmit
```
Expected: pass/clean.

- [ ] **Step 6: Commit**

```bash
git add src/i18n
git commit -m "feat(phase1): i18n scaffold (EN/HE + RTL)"
```

---

### Task 6: Auth UI + onboarding + dashboard shell

**Files:**
- Create: `src/app/(auth)/signup/page.tsx`, `src/app/(auth)/login/page.tsx`, `src/app/(auth)/reset/page.tsx`
- Create: `src/app/onboarding/page.tsx` + `src/components/OnboardingForm.tsx`
- Create: `src/app/(app)/dashboard/page.tsx`, `src/app/(app)/layout.tsx`
- Create: `src/components/ui/{Button,Input}.tsx` (port from STOREFRONT)

**Interfaces:**
- Consumes: `signIn` (client), `signUp`/`createHousehold`/`joinHousehold` (actions), `getCurrentUser`, `getCurrentHousehold`, `getDictionary`/`t`.
- Produces: the Phase-1 routes and the redirect logic below.

**Routing/redirect rules (implement exactly):**
- `/(app)/layout.tsx` (server): `const user = await getCurrentUser(); if (!user) redirect("/login"); const hh = await getCurrentHousehold(); if (!hh) redirect("/onboarding");` — so the dashboard is only reachable when authenticated **and** in a household.
- `/onboarding` (server): if no user → `redirect("/login")`; if the user already has a household → `redirect("/dashboard")`; else render `<OnboardingForm/>`.
- After successful `signUp` (client) → `signIn.email(...)` then `router.push("/onboarding")`.
- After successful `createHousehold`/`joinHousehold` → `router.push("/dashboard")`.

- [ ] **Step 1: Port UI primitives**

Copy STOREFRONT `src/components/ui/Button.tsx` and `src/components/ui/Input.tsx` verbatim (they're generic, no store coupling).

- [ ] **Step 2: Build the login page** (client component)

A form with email + password using `signIn.email({ email, password })` from `@/lib/auth-client`; on success `router.push("/dashboard")` (the app-layout guard redirects onward to `/onboarding` if no household yet). Show the returned error on failure. Use `t(getDictionary("en"), "auth.login.*")` for labels (English for Phase 1; a full locale switch comes with the ported UI later).

- [ ] **Step 3: Build the signup page** (client component)

Form with name/email/password → call the `signUp` action; on `ok` call `signIn.email(...)` with the same credentials, then `router.push("/onboarding")`. On failure show `error`.

- [ ] **Step 4: Build the reset page** (client component)

Two-step: (a) enter email → `authClient.emailOtp.sendVerificationOtp({ email, type: "forget-password" })`; (b) enter code + new password → `authClient.emailOtp.resetPassword(...)` (match better-auth's emailOTP reset API used by STOREFRONT's reset flow — see STOREFRONT settings/password-change for the exact call names). On success → `router.push("/login")`.

- [ ] **Step 5: Build onboarding** (`OnboardingForm` client component + server page)

`OnboardingForm` shows two panels — "Create a household" (name → `createHousehold(name)`) and "Join a household" (code → `joinHousehold(code)`). On either `ok` → `router.push("/dashboard")`. The server `page.tsx` applies the redirect rules above.

- [ ] **Step 6: Build the app layout + dashboard shell**

`(app)/layout.tsx` applies the auth+household guard, renders a minimal top nav with a log-out button (`signOut()` then `router.push("/login")`). `(app)/dashboard/page.tsx` shows `t(d,"dashboard.title")` and `t(d,"dashboard.empty")`.

- [ ] **Step 7: Typecheck + build**

```bash
npx tsc --noEmit && npm run build
```
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/app src/components
git commit -m "feat(phase1): auth pages, onboarding, dashboard shell"
```

---

### Task 7: Manual verification + README

**Files:**
- Modify: `README.md` (replace Vite/Supabase setup with the new stack's setup)

- [ ] **Step 1: Full manual smoke test** (needs `.env` with DATABASE_URL/DIRECT_URL/BETTER_AUTH_SECRET)

```bash
npm run dev
```
Verify in the browser at http://localhost:3000:
1. `/signup` → create account → lands on `/onboarding`.
2. Create a household → lands on `/dashboard` showing the empty-state copy.
3. Log out → `/login` → log back in → lands on `/dashboard`.
4. In a second browser/incognito, sign up a new account → on `/onboarding`, use the **join** panel with the first household's invite code (read it from the DB via `npx prisma studio` → Household.inviteCode) → lands on `/dashboard` (now a member of the same household).
5. Visiting `/dashboard` while logged out redirects to `/login`; while logged in without a household redirects to `/onboarding`.

- [ ] **Step 2: Rewrite `README.md`**

Replace the Vite/Supabase "Getting started" with: Next.js dev (`npm run dev`), Prisma Postgres provisioning (`npx prisma init --db`), env vars (DATABASE_URL, DIRECT_URL, BETTER_AUTH_SECRET), `npx prisma migrate dev`. Note that this is the `next-migration` branch; `main` remains the current live app until cutover.

- [ ] **Step 3: Run the full suite + lint + build**

```bash
npm test && npm run lint && npm run build
```
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs(phase1): document the new Next.js + Prisma stack setup"
```

---

## Self-Review

**Spec coverage:**
- Next.js 16 skeleton → Task 1. ✅
- Full Prisma schema (all tables translated) + initial migration → Task 2. ✅
- Prisma Postgres + Accelerate client → Task 2. ✅
- better-auth (email+password, email-OTP reset) → Task 3. ✅
- Household model (one-per-user, role, language, inviteCode, create/join) → Task 4. ✅
- App-level authorization helper (`requireHousehold`) → Task 4. ✅
- i18n EN/HE + RTL scaffold → Task 5. ✅
- Auth UI + create-or-join + empty dashboard → Task 6. ✅
- Manual test flow + README → Task 7. ✅
- Out-of-scope items (catalog/lists/stock/prices UI, MCP, data migration, deploy) correctly excluded.

**Placeholder scan:** Ported files (auth-server, resend, UI primitives, LocaleProvider, reset API call names) reference exact STOREFRONT source paths to copy rather than reproducing long files — the source location and the specific adaptation (Store→Household, AR→HE) are given for each. No `TBD`/`TODO`/"add error handling" placeholders remain.

**Type consistency:** `Household`, `User.householdId`, `role` (owner|member), `language` (en|he), `inviteCode`, `generateInviteCode()`, `requireHousehold()`, and the `{ok:true}|{ok:false;error}` action return shape are used identically across Tasks 2, 4, and 6. Enum values are lowercase to match existing data semantics and ease the phase-6 migration.

## Setup dependency (execution gate)

Task 2 Step 1 provisions **Prisma Postgres** — it needs the user's Prisma account and produces `DATABASE_URL` + `DIRECT_URL` for a gitignored `.env`. Tasks 3–6 also need `BETTER_AUTH_SECRET`. Nothing in Tasks 1–6 can run the app or migrations until these exist; surface this before execution begins.
