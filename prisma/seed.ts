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
    await prisma.household
      .delete({ where: { id: existing.householdId } })
      .catch((e) => console.warn("reset: household delete skipped:", e instanceof Error ? e.message : e));
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

  console.log("✅ Demo seeded.");
  console.log(`   Login:    ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`   Content:  ${ITEMS.length} items, 3 tags, 2 lists, 7 stock rows (2 low), 7 price entries`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("❌ Seed failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
