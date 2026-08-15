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
