# GroceryApp Phase 6a — Demo Household Seed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `npm run seed:demo` (re)creates a realistic, bilingual demo household reachable via a seeded email+password login.

**Architecture:** `prisma/seed.ts` (run by `prisma db seed` → `tsx`) with its own `PrismaClient`. It idempotently resets the demo household+user by email, creates the demo user + a better-auth credential (`Account` with a `hashPassword` hash), creates the household + owner + default categories, then seeds catalog/tags/lists/stock/prices. Task 1 stands up + verifies the credential (the risk); Task 2 adds the content.

**Tech Stack:** Prisma 6, better-auth (`better-auth/crypto`), `tsx`, TypeScript.

## Global Constraints

- Branch `next-migration`, never `main`. Personal git identity (`sharifshayma`). Never commit `.env`.
- **`tsx` does NOT resolve the `@/` tsconfig path alias.** `prisma/seed.ts` MUST use its own `new PrismaClient()` and **relative** imports for local helpers (`../src/lib/default-categories`, `../src/lib/invite-code`) — those files are alias-free (only `@prisma/client` / `node:crypto`). Package imports (`@prisma/client`, `better-auth/crypto`) resolve normally.
- The demo credential is created DIRECTLY (no `auth.api.signUpEmail` — its `nextCookies` plugin calls `next/headers` and throws outside a request). Insert a `User` + an `Account` (`providerId: "credential"`, `accountId: <userId>`, `password: await hashPassword(DEMO_PASSWORD)`).
- Idempotent: the reset deletes ONLY the household + user matching `DEMO_EMAIL`.
- Runs against whatever `DATABASE_URL` points to (the shared Prisma Postgres). `prisma db seed` loads `.env`.
- Demo content is bilingual (`nameHe` set); the demo user `language` is `"en"`.

## Constants (used across the file)

```ts
const DEMO_EMAIL = "demo@grocery.app";
const DEMO_PASSWORD = "DemoGrocery2026";
const DEMO_NAME = "Demo User";
const DEMO_HOUSEHOLD = "Demo Household";
```

---

## File Structure

- `package.json` — add the `seed:demo` script (Task 1).
- `prisma/seed.ts` — the whole seed; skeleton in Task 1, content added in Task 2.

---

## Task 1: Seed skeleton — reset + demo user + credential + household

**Files:**
- Modify: `package.json` (add script)
- Create: `prisma/seed.ts` (skeleton: reset, user+credential, household+categories, print, disconnect)

**Interfaces — Produces:** a runnable `npm run seed:demo` that creates the demo login + an empty-but-categorized demo household. Later task adds content between category seeding and the final print.

- [ ] **Step 1: Add the script**

In `package.json` `scripts`, add:

```json
"seed:demo": "prisma db seed"
```

- [ ] **Step 2: Write the skeleton `prisma/seed.ts`**

```ts
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { seedDefaultCategories } from "../src/lib/default-categories";
import { generateInviteCode } from "../src/lib/invite-code";

const prisma = new PrismaClient();

const DEMO_EMAIL = "demo@grocery.app";
const DEMO_PASSWORD = "DemoGrocery2026";
const DEMO_NAME = "Demo User";
const DEMO_HOUSEHOLD = "Demo Household";

async function resetDemo(): Promise<void> {
  const existing = await prisma.user.findUnique({
    where: { email: DEMO_EMAIL },
    select: { id: true, householdId: true },
  });
  if (!existing) return;
  if (existing.householdId) {
    // cascades categories/items/tags/lists/stock/prices/tokens
    await prisma.household.delete({ where: { id: existing.householdId } }).catch(() => {});
  }
  await prisma.user.delete({ where: { id: existing.id } }); // cascades accounts/sessions
}

async function main(): Promise<void> {
  await resetDemo();

  // 1. Demo user + credential (direct — valid better-auth email+password login)
  const userId = randomUUID();
  await prisma.user.create({
    data: {
      id: userId,
      name: DEMO_NAME,
      displayName: DEMO_NAME,
      email: DEMO_EMAIL,
      emailVerified: true,
      language: "en",
    },
  });
  await prisma.account.create({
    data: {
      id: randomUUID(),
      accountId: userId,
      providerId: "credential",
      userId,
      password: await hashPassword(DEMO_PASSWORD),
    },
  });

  // 2. Household + owner + default categories
  const household = await prisma.household.create({
    data: { name: DEMO_HOUSEHOLD, inviteCode: generateInviteCode(), createdById: userId },
  });
  await prisma.user.update({
    where: { id: userId },
    data: { householdId: household.id, role: "owner" },
  });
  await seedDefaultCategories(prisma, household.id);

  // 3. Content is added here in Task 2.

  console.log("✅ Demo seeded.");
  console.log(`   Login:    ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`   Household: ${household.id}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("❌ Seed failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
```

- [ ] **Step 3: Run the seed against the live DB**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npm run seed:demo`
Expected: prints "✅ Demo seeded." + the login + a household id, exit 0. (If the `better-auth/crypto` import fails under tsx, fall back to `import { hashPassword } from "@better-auth/utils/password"` — the same function `better-auth/crypto` re-exports — and note it in the report.)

- [ ] **Step 4: Verify the credential round-trips (no server needed)**

Run this check (proves the seeded hash is a valid better-auth credential — i.e. sign-in will accept `DEMO_PASSWORD`):

```bash
cd /Users/balanceshayma/Documents/GitHub/GroceryApp && node --env-file=.env -e "
const { PrismaClient } = require('@prisma/client');
import('better-auth/crypto').then(async ({ verifyPassword }) => {
  const p = new PrismaClient();
  const u = await p.user.findUnique({ where: { email: 'demo@grocery.app' }, select: { id: true } });
  const a = await p.account.findFirst({ where: { userId: u.id, providerId: 'credential' }, select: { password: true } });
  const ok = await verifyPassword({ hash: a.password, password: 'DemoGrocery2026' });
  const bad = await verifyPassword({ hash: a.password, password: 'wrong' });
  console.log('verify correct password:', ok, '| verify wrong password:', bad);
  await p.\$disconnect();
});
"`
```
Expected: `verify correct password: true | verify wrong password: false`.

- [ ] **Step 5: Verify idempotency**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npm run seed:demo`
Expected: succeeds again (resets + recreates). Then confirm exactly one demo user/household:

```bash
cd /Users/balanceshayma/Documents/GitHub/GroceryApp && node --env-file=.env -e "
const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient();
Promise.all([
  p.user.count({ where: { email: 'demo@grocery.app' } }),
  p.household.count({ where: { name: 'Demo Household' } }),
]).then(([u, h]) => { console.log('demo users:', u, '| demo households:', h); return p.\$disconnect(); });
"`
```
Expected: `demo users: 1 | demo households: 1`.

- [ ] **Step 6: Commit**

```bash
cd /Users/balanceshayma/Documents/GitHub/GroceryApp
git add package.json prisma/seed.ts
git commit -m "feat(seed): demo household seed skeleton — login credential + household + categories"
```

---

## Task 2: Seed the demo content

**Files:**
- Modify: `prisma/seed.ts` (insert content between category seeding and the print)

**Interfaces — Consumes:** the `household`, `userId`, and the seeded default categories from Task 1.

- [ ] **Step 1: Add a category lookup + the content**

Replace the `// 3. Content is added here in Task 2.` comment with the block below. It builds a `name → categoryId` map from the seeded categories, inserts items (capturing their ids), then tags/item-tags/lists/list-items/stock/prices.

```ts
  // 3. Content
  const cats = await prisma.category.findMany({
    where: { householdId: household.id },
    select: { id: true, name: true },
  });
  const catId = (name: string) => cats.find((c) => c.name === name)?.id ?? null;

  const ITEMS: { key: string; name: string; nameHe: string; emoji: string; unit: string; cat: string }[] = [
    { key: "milk", name: "Milk", nameHe: "חלב", emoji: "🥛", unit: "L", cat: "Dairy" },
    { key: "eggs", name: "Eggs", nameHe: "ביצים", emoji: "🥚", unit: "pcs", cat: "Eggs" },
    { key: "yogurt", name: "Yogurt", nameHe: "יוגורט", emoji: "🥛", unit: "pcs", cat: "Dairy" },
    { key: "bread", name: "Bread", nameHe: "לחם", emoji: "🍞", unit: "pcs", cat: "Bakery" },
    { key: "bananas", name: "Bananas", nameHe: "בננות", emoji: "🍌", unit: "kg", cat: "Vegetables & Fruits" },
    { key: "tomatoes", name: "Tomatoes", nameHe: "עגבניות", emoji: "🍅", unit: "kg", cat: "Vegetables & Fruits" },
    { key: "cucumber", name: "Cucumber", nameHe: "מלפפון", emoji: "🥒", unit: "kg", cat: "Vegetables & Fruits" },
    { key: "chicken", name: "Chicken", nameHe: "עוף", emoji: "🍗", unit: "kg", cat: "Meat, Poultry & Fish" },
    { key: "rice", name: "Rice", nameHe: "אורז", emoji: "🍚", unit: "kg", cat: "Pantry" },
    { key: "pasta", name: "Pasta", nameHe: "פסטה", emoji: "🍝", unit: "pcs", cat: "Pantry" },
    { key: "oil", name: "Olive Oil", nameHe: "שמן זית", emoji: "🫒", unit: "pcs", cat: "Pantry" },
    { key: "coffee", name: "Coffee", nameHe: "קפה", emoji: "☕", unit: "pcs", cat: "Coffee, Tea & Hot Chocolate" },
    { key: "dishsoap", name: "Dish Soap", nameHe: "סבון כלים", emoji: "🧽", unit: "pcs", cat: "House Cleaning & Disposable" },
    { key: "towels", name: "Paper Towels", nameHe: "מגבות נייר", emoji: "🧻", unit: "pcs", cat: "House Cleaning & Disposable" },
  ];

  const id: Record<string, string> = {};
  for (const it of ITEMS) {
    const row = await prisma.item.create({
      data: {
        householdId: household.id,
        categoryId: catId(it.cat),
        name: it.name,
        nameHe: it.nameHe,
        emoji: it.emoji,
        defaultUnit: it.unit,
        createdById: userId,
      },
      select: { id: true },
    });
    id[it.key] = row.id;
  }

  // Tags + a few links
  const recipeTag = await prisma.tag.create({ data: { householdId: household.id, name: "Weeknight Pasta", type: "recipe" }, select: { id: true } });
  const storeTag = await prisma.tag.create({ data: { householdId: household.id, name: "SuperSol", type: "store" }, select: { id: true } });
  const organicTag = await prisma.tag.create({ data: { householdId: household.id, name: "Organic", type: "custom" }, select: { id: true } });
  await prisma.itemTag.createMany({
    data: [
      { itemId: id.pasta, tagId: recipeTag.id },
      { itemId: id.tomatoes, tagId: recipeTag.id },
      { itemId: id.oil, tagId: recipeTag.id },
      { itemId: id.bananas, tagId: organicTag.id },
      { itemId: id.tomatoes, tagId: organicTag.id },
    ],
  });

  // Lists — one active (some bought), one completed
  const thisWeek = await prisma.groceryList.create({
    data: {
      householdId: household.id, name: "This Week", status: "active", createdById: userId,
      items: {
        create: [
          { itemId: id.milk, quantity: 2, unit: "L", isBought: true, boughtById: userId, boughtAt: new Date() },
          { itemId: id.bread, quantity: 1, unit: "pcs", isBought: true, boughtById: userId, boughtAt: new Date() },
          { itemId: id.eggs, quantity: 1, unit: "pcs", isBought: false },
          { itemId: id.bananas, quantity: 1, unit: "kg", isBought: false },
          { itemId: id.coffee, quantity: 1, unit: "pcs", isBought: false },
          { itemId: id.chicken, quantity: 1, unit: "kg", isBought: false },
        ],
      },
    },
  });
  await prisma.groceryList.create({
    data: {
      householdId: household.id, name: "Last Week", status: "completed", completedAt: new Date(), createdById: userId,
      items: {
        create: [
          { itemId: id.rice, quantity: 1, unit: "kg", isBought: true, boughtById: userId, boughtAt: new Date() },
          { itemId: id.pasta, quantity: 2, unit: "pcs", isBought: true, boughtById: userId, boughtAt: new Date() },
          { itemId: id.oil, quantity: 1, unit: "pcs", isBought: true, boughtById: userId, boughtAt: new Date() },
        ],
      },
    },
  });

  // Stock — 2 low (quantity <= lowThreshold) to drive Need-to-buy
  await prisma.stock.createMany({
    data: [
      { householdId: household.id, itemId: id.milk, quantity: 0, unit: "L", lowThreshold: 1 },      // low
      { householdId: household.id, itemId: id.coffee, quantity: 1, unit: "pcs", lowThreshold: 2 },  // low
      { householdId: household.id, itemId: id.eggs, quantity: 6, unit: "pcs", lowThreshold: 2 },
      { householdId: household.id, itemId: id.rice, quantity: 2, unit: "kg", lowThreshold: 1 },
      { householdId: household.id, itemId: id.pasta, quantity: 3, unit: "pcs", lowThreshold: 1 },
      { householdId: household.id, itemId: id.bananas, quantity: 5, unit: "kg", lowThreshold: 2 },
      { householdId: household.id, itemId: id.chicken, quantity: 2, unit: "kg", lowThreshold: 1 },
    ],
  });

  // Prices — a couple of stores; cheaper one wins the "cheapest" pick
  await prisma.priceHistory.createMany({
    data: [
      { householdId: household.id, itemId: id.milk, price: "7.50", store: "SuperSol" },
      { householdId: household.id, itemId: id.milk, price: "6.90", store: "Rami Levy" },
      { householdId: household.id, itemId: id.eggs, price: "12.00", store: "SuperSol" },
      { householdId: household.id, itemId: id.eggs, price: "11.50", store: "Rami Levy" },
      { householdId: household.id, itemId: id.coffee, price: "32.00", store: "SuperSol" },
      { householdId: household.id, itemId: id.coffee, price: "28.90", store: "Rami Levy" },
      { householdId: household.id, itemId: id.bread, price: "9.90", store: "SuperSol" },
    ],
  });
```

Then update the final print to summarize:

```ts
  console.log("✅ Demo seeded.");
  console.log(`   Login:    ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`   Content:  ${ITEMS.length} items, 3 tags, 2 lists, 7 stock rows (2 low), 7 price entries`);
```

- [ ] **Step 2: Run the full seed**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npm run seed:demo`
Expected: "✅ Demo seeded." with the content summary, exit 0.

- [ ] **Step 3: Verify the content**

```bash
cd /Users/balanceshayma/Documents/GitHub/GroceryApp && node --env-file=.env -e "
const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient();
(async () => {
  const u = await p.user.findUnique({ where: { email: 'demo@grocery.app' }, select: { householdId: true } });
  const h = u.householdId;
  const [items, tags, lists, stock, prices] = await Promise.all([
    p.item.count({ where: { householdId: h } }),
    p.tag.count({ where: { householdId: h } }),
    p.groceryList.findMany({ where: { householdId: h }, select: { name: true, status: true, _count: { select: { items: true } } } }),
    p.stock.findMany({ where: { householdId: h }, select: { quantity: true, lowThreshold: true } }),
    p.priceHistory.count({ where: { householdId: h } }),
  ]);
  const low = stock.filter((s) => s.quantity <= s.lowThreshold).length;
  console.log('items:', items, '| tags:', tags, '| prices:', prices);
  console.log('lists:', JSON.stringify(lists));
  console.log('stock rows:', stock.length, '| low:', low);
  await p.\$disconnect();
})();
"`
```
Expected: `items: 14 | tags: 3 | prices: 7`; lists = This Week (active, 6 items) + Last Week (completed, 3 items); `stock rows: 7 | low: 2`.

- [ ] **Step 4: Commit**

```bash
cd /Users/balanceshayma/Documents/GitHub/GroceryApp
git add prisma/seed.ts
git commit -m "feat(seed): demo content — bilingual items, tags, lists, stock, prices"
```

---

## Verification (controller-run)

- [ ] **1. Fresh seed:** `npm run seed:demo` → clean run + summary.

- [ ] **2. Real sign-in end-to-end** (the credential risk, proven against the running app): start `PORT=3001 npm run dev`; POST the demo credentials to the better-auth sign-in endpoint and confirm a session/200:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3001/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@grocery.app","password":"DemoGrocery2026"}'
```
Expected: `200`. (A wrong password → 401, as a control.)

- [ ] **3. App view:** signed in as the demo user, `/dashboard` shows the seeded counts; `/stock` Need-to-buy lists Milk + Coffee; `/prices` shows Milk cheapest at Rami Levy. (Controller may verify via the counts query if the browser is sandboxed.)

- [ ] **4. Idempotency + final review:** re-run `seed:demo` (counts stable); two-stage whole-branch review of the Phase 6a range; then push `next-migration`. Leave the demo household in place.

---

## Self-Review

**Spec coverage:** `prisma/seed.ts` + `seed:demo` script ✓ (Task 1); idempotent reset by email ✓ (Task 1 `resetDemo`); direct credential creation avoiding `next/headers` ✓ (Task 1, `hashPassword` + `Account`); household + owner + default categories ✓ (Task 1); bilingual items/tags/item-tags/lists(active+completed)/stock(2 low)/prices(cheapest) ✓ (Task 2); prints credentials + summary ✓; login verified (round-trip in Task 1, real sign-in in controller verification) ✓; idempotency verified ✓.

**Placeholder scan:** No TBD/TODO. The one conditional (fall back to `@better-auth/utils/password` if the `better-auth/crypto` import fails under tsx) is a concrete, bounded fallback for an external-import uncertainty, resolved in Task 1's run — not a placeholder.

**Type consistency:** `id` map keys (`milk`, `eggs`, …) are referenced consistently across items/tags/lists/stock/prices. `catId(name)` uses the exact `DEFAULT_CATEGORIES` names (`"Dairy"`, `"Eggs"`, `"Bakery"`, `"Vegetables & Fruits"`, `"Meat, Poultry & Fish"`, `"Pantry"`, `"Coffee, Tea & Hot Chocolate"`, `"House Cleaning & Disposable"`) — all present in the helper. `price` values are strings (Prisma `Decimal` accepts string). Relative import paths (`../src/lib/...`) match the files' actual locations from `prisma/`.
