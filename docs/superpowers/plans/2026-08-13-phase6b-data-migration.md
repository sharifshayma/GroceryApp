# GroceryApp Phase 6b — Supabase Data Migration + Claim-on-Signup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the user's one real household ("Demo" → renamed **"Shaymas household"**) and all its content from the old Supabase Postgres into the new Prisma Postgres, and attach its members to their data when they sign up fresh (by email).

**Architecture:** A one-off ETL script reads the source household from Supabase (via `pg`, connecting with manually-parsed discrete credentials) and writes it via Prisma, **preserving the original UUIDs as the new string ids** (so every FK maps with zero remapping), nulling user-attribution fields, mapping text→enums, and carrying `barcode`/`description` (re-added to the schema). It also writes a `MigrationClaim` row per member. A better-auth `databaseHooks.user.create.after` hook consumes a claim on signup to attach the new user to the migrated household.

**Tech Stack:** Prisma 6, `pg` (source read), better-auth, `tsx`, TypeScript.

## Global Constraints

- Branch `next-migration`, never `main`. Personal git identity (`sharifshayma`). Never commit `.env`.
- **Read-only on Supabase.** The migration only SELECTs from Supabase; it never writes there. **Never reset the Supabase DB password** (the live app on `main` still uses it).
- `SUPABASE_DATABASE_URL` (source) and `DATABASE_URL` (destination Prisma Postgres) live in `.env` (gitignored). The source password contains a char that breaks URL parsers — **parse the URL manually into discrete `{host,port,user,password,database}` fields** (do NOT rely on `new URL()` or `pg`'s connection-string parser).
- `tsx` doesn't resolve the `@/` alias — scripts use their own `new PrismaClient()` + **relative** imports.
- Lint is **`npm run lint`** (bare eslint).
- The ONE household to migrate: **source id `66d5aaf7-193c-4eee-ba70-8b8600a2e6a1`** (rename to `"Shaymas household"`). Ignore the two "Test Household"s.
- Preserve source UUIDs as ids. Null user-refs (`created_by`/`bought_by`/`logged_by`/`updated_by`) — attribution is dropped, content is kept. Keep `is_bought`+`bought_at` (content, not attribution).
- Idempotent: re-running the migration first deletes the migrated household (by source id, cascades) + its claims, then re-inserts.

## Source → destination field map (verified against the live schema)

| Source table.col | Prisma model.field | note |
|---|---|---|
| households.id/name/invite_code/created_at | Household.id/name(→"Shaymas household")/inviteCode(← ?? generateInviteCode())/createdAt | createdById → null |
| categories.* | Category (name_he→nameHe, photo_url→photoUrl, sort_order→sortOrder, is_default→isDefault) | emoji ?? "📦" |
| items.* | Item (name_he→nameHe, default_unit→defaultUnit, auto_track_stock→autoTrackStock, photo_url→photoUrl, photo_path→photoPath) | emoji ?? "🛒", defaultUnit ?? "pcs", createdById → null |
| tags.* | Tag (type→enum) | |
| item_tags.item_id/tag_id/notes | ItemTag.itemId/tagId/notes | composite pk |
| grocery_lists.* | GroceryList (status→enum, completed_at→completedAt) | createdById → null |
| list_items.* | ListItem (list_id→listId, item_id→itemId, is_bought→isBought, bought_at→boughtAt, stock_updated→stockUpdated) | boughtById → null |
| stock.* | Stock (item_id→itemId, low_threshold→lowThreshold, updated_at→updatedAt) | updatedById → null |
| price_history.* | PriceHistory (quantity_amount→quantityAmount, quantity_unit→quantityUnit, purchased_at→purchasedAt, **barcode**, **description**) | loggedById → null |
| profiles (of this household) | MigrationClaim (email, householdId, role→enum, language→enum, display_name→displayName) | 3 rows |

Enum coercion: `status ∈ {draft,active,completed}` (else draft); `tag.type ∈ {recipe,store,custom}` (else custom); `role = "owner" ? owner : member`; `language = "he" ? he : en`.

---

## Task 1: Schema — barcode/description + MigrationClaim + migration

**Files:** Modify `prisma/schema.prisma`.

**Interfaces — Produces:** `PriceHistory.barcode`/`.description`; a `MigrationClaim` model; `prisma.migrationClaim` accessor.

- [ ] **Step 1: Add the fields + model**

In `prisma/schema.prisma`, add to `model PriceHistory` (alongside its other optional fields):

```prisma
  barcode     String?
  description String?
```

Add a new model + a back-relation on `Household`:

```prisma
model MigrationClaim {
  id          String   @id @default(cuid())
  email       String   @unique
  householdId String
  household   Household @relation(fields: [householdId], references: [id], onDelete: Cascade)
  role        Role      @default(member)
  language    Language  @default(en)
  displayName String?
  createdAt   DateTime  @default(now())

  @@index([householdId])
}
```

In `model Household { ... }` add the back-relation line: `migrationClaims MigrationClaim[]`.

- [ ] **Step 2: Validate + generate**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npx prisma validate && npx prisma generate`
Expected: valid; client generated (`prisma.migrationClaim` typed; `barcode`/`description` on PriceHistory).

> **Migration is run by the controller** (needs the live DB): `npx prisma migrate dev --name add_barcode_desc_and_migration_claim`. Do NOT run it here.

- [ ] **Step 3: Commit**

```bash
cd /Users/balanceshayma/Documents/GitHub/GroceryApp
git add prisma/schema.prisma
git commit -m "feat(db): re-add price barcode/description; add MigrationClaim model"
```

---

## Task 2: Supabase read connection (pg) — spike

**This de-risks the source connection before the ETL depends on it.** The source password breaks URL parsers, so we parse manually and pass discrete fields to `pg`.

**Files:** Modify `package.json` (add `pg`); Create `scripts/supabase-source.ts`.

**Interfaces — Produces:** `supabaseConfig()` → `{host,port,user,password,database,ssl}`; `withSource(fn)` → opens a `pg` client, runs `fn(client)`, closes it. Verified it reads the source household counts.

- [ ] **Step 1: Add pg**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npm install --save-dev pg @types/pg`

- [ ] **Step 2: Write the source module**

Create `scripts/supabase-source.ts`:

```ts
import { Client } from "pg";

export function supabaseConfig() {
  const u = process.env.SUPABASE_DATABASE_URL ?? "";
  const m = u.match(/^postgres(?:ql)?:\/\/([^:]+):(.*)@([^:/@]+):(\d+)\/([^?]+)/);
  if (!m) throw new Error("SUPABASE_DATABASE_URL missing or unparseable");
  const [, user, password, host, port, database] = m;
  return {
    host,
    port: Number(port),
    user,
    password,
    database: database.split("?")[0],
    ssl: { rejectUnauthorized: false }, // Supabase pooler cert
  };
}

export async function withSource<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const client = new Client(supabaseConfig());
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}
```

- [ ] **Step 3: Verify the connection reads the source household**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && node --env-file=.env --import tsx -e "
import('./scripts/supabase-source.ts').then(async ({ withSource }) => {
  const H = '66d5aaf7-193c-4eee-ba70-8b8600a2e6a1';
  await withSource(async (c) => {
    for (const t of ['categories','items','tags','item_tags','grocery_lists','list_items','stock','price_history']) {
      const col = t === 'item_tags' ? 'item_id in (select id from items where household_id=\$1)' : (t === 'list_items' ? 'list_id in (select id from grocery_lists where household_id=\$1)' : 'household_id=\$1');
      const r = await c.query('select count(*)::int n from '+t+' where '+col, [H]);
      console.log(t, r.rows[0].n);
    }
    const p = await c.query('select count(*)::int n from profiles where household_id=\$1', [H]);
    console.log('profiles', p.rows[0].n);
  });
});
"`
Expected (matches the source): categories 63, items 137, tags 10, item_tags 64, grocery_lists 11, list_items ~140, stock 21, price_history 84, profiles 3.

- [ ] **Step 4: Commit**

```bash
cd /Users/balanceshayma/Documents/GitHub/GroceryApp
git add package.json package-lock.json scripts/supabase-source.ts
git commit -m "feat(migrate): pg-based Supabase read connection (manual creds parse)"
```

---

## Task 3: The ETL migration script

**Files:** Create `scripts/migrate-supabase.ts`.

**Interfaces — Consumes:** `withSource` (Task 2); Prisma (its own client); `generateInviteCode` (`../src/lib/invite-code`). Reads the source household, writes to Prisma preserving ids.

- [ ] **Step 1: Write the ETL script**

Create `scripts/migrate-supabase.ts`. It reads each source table for the one household, transforms per the field map, and `createMany`s into Prisma in FK order. Coerce enums; null user-refs; carry barcode/description; rename the household.

```ts
import { PrismaClient } from "@prisma/client";
import { withSource } from "./supabase-source";
import { generateInviteCode } from "../src/lib/invite-code";

const prisma = new PrismaClient();
const H = "66d5aaf7-193c-4eee-ba70-8b8600a2e6a1"; // the real household
const NEW_NAME = "Shaymas household";

const asStatus = (s: string | null) => (["draft", "active", "completed"].includes(s ?? "") ? (s as "draft" | "active" | "completed") : "draft");
const asType = (t: string | null) => (["recipe", "store", "custom"].includes(t ?? "") ? (t as "recipe" | "store" | "custom") : "custom");
const asRole = (r: string | null) => (r === "owner" ? "owner" : "member") as "owner" | "member";
const asLang = (l: string | null) => (l === "he" ? "he" : "en") as "he" | "en";
const d = (v: unknown) => (v ? new Date(v as string) : null);

async function main() {
  const data = await withSource(async (c) => {
    const q = (sql: string) => c.query(sql, [H]).then((r) => r.rows);
    return {
      household: (await c.query("select * from households where id=$1", [H])).rows[0],
      profiles: await q("select * from profiles where household_id=$1"),
      categories: await q("select * from categories where household_id=$1"),
      items: await q("select * from items where household_id=$1"),
      tags: await q("select * from tags where household_id=$1"),
      itemTags: await q("select it.* from item_tags it join items i on i.id=it.item_id where i.household_id=$1"),
      lists: await q("select * from grocery_lists where household_id=$1"),
      listItems: await q("select li.* from list_items li join grocery_lists g on g.id=li.list_id where g.household_id=$1"),
      stock: await q("select * from stock where household_id=$1"),
      prices: await q("select * from price_history where household_id=$1"),
    };
  });

  // Idempotent reset (cascades content + claims via FK)
  await prisma.household.delete({ where: { id: H } }).catch(() => {});

  // Household (createdById nulled)
  await prisma.household.create({
    data: {
      id: H,
      name: NEW_NAME,
      inviteCode: data.household.invite_code ?? generateInviteCode(),
      createdAt: d(data.household.created_at) ?? new Date(),
    },
  });

  await prisma.category.createMany({
    data: data.categories.map((r) => ({
      id: r.id, householdId: H, name: r.name, nameHe: r.name_he, emoji: r.emoji ?? "📦",
      photoUrl: r.photo_url, sortOrder: r.sort_order ?? 0, isDefault: r.is_default ?? false,
      createdAt: d(r.created_at) ?? new Date(),
    })),
  });

  await prisma.item.createMany({
    data: data.items.map((r) => ({
      id: r.id, householdId: H, categoryId: r.category_id, name: r.name, nameHe: r.name_he,
      emoji: r.emoji ?? "🛒", defaultUnit: r.default_unit ?? "pcs", notes: r.notes,
      autoTrackStock: r.auto_track_stock ?? true, photoUrl: r.photo_url, photoPath: r.photo_path,
      createdAt: d(r.created_at) ?? new Date(),
    })),
  });

  await prisma.tag.createMany({
    data: data.tags.map((r) => ({
      id: r.id, householdId: H, name: r.name, type: asType(r.type), description: r.description,
      color: r.color ?? "#3B82F6", createdAt: d(r.created_at) ?? new Date(),
    })),
  });

  await prisma.itemTag.createMany({
    data: data.itemTags.map((r) => ({ itemId: r.item_id, tagId: r.tag_id, notes: r.notes })),
    skipDuplicates: true,
  });

  await prisma.groceryList.createMany({
    data: data.lists.map((r) => ({
      id: r.id, householdId: H, name: r.name, status: asStatus(r.status),
      completedAt: d(r.completed_at), createdAt: d(r.created_at) ?? new Date(),
    })),
  });

  await prisma.listItem.createMany({
    data: data.listItems.map((r) => ({
      id: r.id, listId: r.list_id, itemId: r.item_id, quantity: Number(r.quantity ?? 1),
      unit: r.unit ?? "pcs", isBought: r.is_bought ?? false, boughtAt: d(r.bought_at),
      notes: r.notes, stockUpdated: r.stock_updated ?? false,
    })),
  });

  await prisma.stock.createMany({
    data: data.stock.map((r) => ({
      id: r.id, householdId: H, itemId: r.item_id, quantity: Number(r.quantity ?? 0),
      unit: r.unit ?? "pcs", lowThreshold: Number(r.low_threshold ?? 1),
      updatedAt: d(r.updated_at) ?? new Date(),
    })),
  });

  await prisma.priceHistory.createMany({
    data: data.prices.map((r) => ({
      id: r.id, householdId: H, itemId: r.item_id, price: String(r.price), currency: r.currency ?? "ILS",
      store: r.store, quantityAmount: r.quantity_amount != null ? Number(r.quantity_amount) : null,
      quantityUnit: r.quantity_unit, purchasedAt: d(r.purchased_at) ?? new Date(),
      barcode: r.barcode, description: r.description, createdAt: d(r.created_at) ?? new Date(),
    })),
  });

  // Claims — one per member of this household
  await prisma.migrationClaim.createMany({
    data: data.profiles.map((r) => ({
      email: r.email, householdId: H, role: asRole(r.role), language: asLang(r.language),
      displayName: r.display_name,
    })),
    skipDuplicates: true,
  });

  const counts = {
    categories: data.categories.length, items: data.items.length, tags: data.tags.length,
    itemTags: data.itemTags.length, lists: data.lists.length, listItems: data.listItems.length,
    stock: data.stock.length, prices: data.prices.length, claims: data.profiles.length,
  };
  console.log("✅ Migrated 'Shaymas household':", JSON.stringify(counts));
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error("❌ Migration failed:", e); await prisma.$disconnect(); process.exit(1); });
```

- [ ] **Step 2: Typecheck**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npx tsc --noEmit && npm run lint`
Expected: clean. (Running the ETL against both live DBs is done by the controller in verification — the schema migration from Task 1 must be applied first.)

- [ ] **Step 3: Commit**

```bash
cd /Users/balanceshayma/Documents/GitHub/GroceryApp
git add scripts/migrate-supabase.ts
git commit -m "feat(migrate): ETL — migrate the real household from Supabase to Prisma"
```

---

## Task 4: Claim-on-signup hook

**Files:** Modify `src/lib/auth-server.ts`.

**Interfaces — Consumes:** `prisma`, `prisma.migrationClaim`. Produces: a `databaseHooks.user.create.after` that attaches a new user to their claimed household.

- [ ] **Step 1: Add the hook**

In `src/lib/auth-server.ts`, add a `databaseHooks` block to the `betterAuth({...})` config (leave `emailAndPassword`, `plugins`, etc. unchanged):

```ts
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // If this email was migrated from Supabase, attach them to their household.
          const claim = await prisma.migrationClaim.findUnique({ where: { email: user.email } });
          if (!claim) return;
          await prisma.user.update({
            where: { id: user.id },
            data: {
              householdId: claim.householdId,
              role: claim.role,
              language: claim.language,
              displayName: claim.displayName,
            },
          });
          await prisma.migrationClaim.delete({ where: { id: claim.id } });
        },
      },
    },
  },
```

> If better-auth's `create.after` hook signature differs in the installed version (e.g. `(user, ctx)` or wrapped as `{ user }`), adjust to the installed type — confirm against `node_modules/better-auth` types. The invariant: after a user is created, look up a `MigrationClaim` by `user.email` and, if present, set their `householdId`/`role`/`language`/`displayName` and delete the claim.

- [ ] **Step 2: Verify**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npx tsc --noEmit && npm run lint && npx next build`
Expected: clean; builds. (The live signup→attach flow is verified by the controller.)

- [ ] **Step 3: Commit**

```bash
cd /Users/balanceshayma/Documents/GitHub/GroceryApp
git add src/lib/auth-server.ts
git commit -m "feat(auth): claim-on-signup — attach migrated users to their household by email"
```

---

## Verification (controller-run — needs both live DBs)

- [ ] **1. Apply the schema migration:** `npx prisma migrate dev --name add_barcode_desc_and_migration_claim`; commit the migration file.

- [ ] **2. Run the ETL:** `node --env-file=.env --import tsx scripts/migrate-supabase.ts` → prints the migrated counts. Re-run once (idempotent — counts stable, no duplicate-key errors).

- [ ] **3. Verify counts match source** (destination household `66d5aaf7...` counts == the Task 2 source counts: 63 categories, 137 items, 10 tags, 64 item-tags, 11 lists, ~140 list-items, 21 stock, 84 prices; 3 migration claims); spot-check a price row carries `barcode`+`description`; confirm the household name is "Shaymas household"; confirm user-ref fields are null.

- [ ] **4. Claim-on-signup e2e:** start `PORT=3001 npm run dev`; sign up fresh via the app as `sharif.shayma@gmail.com` (a new password); confirm the new user is auto-attached to "Shaymas household" as **owner** (lands on `/dashboard`, not `/onboarding`; sees the 137 items) and the claim row for that email is gone (the other 2 claims remain). Then clean up the test signup if desired.

- [ ] **5. Final whole-branch review** (most capable model) over the Phase 6b range; then push `next-migration`.

---

## Self-Review

**Spec coverage:** barcode/description re-added + MigrationClaim model + migration ✓ (Task 1); pg source connection with manual cred parse, de-risked ✓ (Task 2); ETL migrating the one household with uuid preservation, nulled attribution, enum coercion, barcode/description, rename to "Shaymas household", 3 claims ✓ (Task 3); claim-on-signup hook attaching by email ✓ (Task 4); read-only-on-Supabase honored (only SELECTs) ✓; idempotent reset ✓; verification includes count-match + real signup→attach ✓.

**Placeholder scan:** No TBD/TODO. The better-auth hook-signature note is a concrete "confirm against installed types and adjust" instruction for an external API (like prior phases), resolved in Task 4's build — not a placeholder. The `~140 list-items` is an inexact source count (143 rows total, all with non-null item_id per inspection) — the verification checks destination==source, not a hardcoded number.

**Type consistency:** enum coercion helpers (`asStatus`/`asType`/`asRole`/`asLang`) return the exact Prisma enum string literals (lowercase). Source snake_case columns are mapped to Prisma camelCase consistently in every `createMany`. UUIDs are preserved as `id` on every table, so `categoryId`/`itemId`/`listId`/`tagId`/`householdId` FKs resolve without remapping. `MigrationClaim` fields (email/householdId/role/language/displayName) match Task 1's model and Task 4's hook read. `price` passed as `String(...)` for the Prisma `Decimal`. Dates wrapped via `d()` (source timestamptz → Date; `@db.Date purchased_at` → `new Date(...)`).
