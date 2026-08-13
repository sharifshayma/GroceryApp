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
