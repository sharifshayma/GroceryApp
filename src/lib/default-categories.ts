import type { Prisma, PrismaClient } from "@prisma/client";

export interface DefaultCategory {
  name: string;
  nameHe: string;
  emoji: string;
}

// The 21 standard categories, ported from the Vite app's seedCategories.js.
export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { name: "Vegetables & Fruits", nameHe: "ירקות ופירות", emoji: "🥬" },
  { name: "Nuts & Dried Fruit", nameHe: "אגוזים ופירות יבשים", emoji: "🥜" },
  { name: "Eggs", nameHe: "ביצים", emoji: "🥚" },
  { name: "Dairy", nameHe: "מוצרי חלב", emoji: "🧀" },
  { name: "Meat, Poultry & Fish", nameHe: "בשר, עוף ודגים", emoji: "🥩" },
  { name: "Deli Meat & Salads", nameHe: "נקניקים וסלטים", emoji: "🥗" },
  { name: "Bakery", nameHe: "מאפייה", emoji: "🍞" },
  { name: "Pantry", nameHe: "מזווה", emoji: "🫙" },
  { name: "Chocolate & Sweets", nameHe: "שוקולד וממתקים", emoji: "🍫" },
  { name: "Cakes & Cookies", nameHe: "עוגות ועוגיות", emoji: "🍪" },
  { name: "Ice Cream & Popsicles", nameHe: "גלידות וארטיקים", emoji: "🍦" },
  { name: "Frozen Food", nameHe: "מזון קפוא", emoji: "🧊" },
  { name: "Coffee, Tea & Hot Chocolate", nameHe: "קפה, תה ושוקו", emoji: "☕" },
  { name: "Soft Drinks", nameHe: "משקאות קלים", emoji: "🥤" },
  { name: "Alcohol", nameHe: "אלכוהול", emoji: "🍷" },
  { name: "Baby Food & Products", nameHe: "מזון ומוצרי תינוקות", emoji: "🍼" },
  { name: "Pet Products", nameHe: "מוצרים לחיות מחמד", emoji: "🐾" },
  { name: "House Cleaning & Disposable", nameHe: "ניקיון וחד פעמי", emoji: "🧹" },
  { name: "Hygiene & Care", nameHe: "היגיינה וטיפוח", emoji: "🧴" },
  { name: "Health Care / First Aid", nameHe: "בריאות ועזרה ראשונה", emoji: "💊" },
  { name: "Laundry Products", nameHe: "מוצרי כביסה", emoji: "👕" },
];

// Accepts the prisma client or a $transaction client (both expose `.category`).
type Db = PrismaClient | Prisma.TransactionClient;

export async function seedDefaultCategories(db: Db, householdId: string): Promise<void> {
  await db.category.createMany({
    data: DEFAULT_CATEGORIES.map((c, i) => ({
      householdId,
      name: c.name,
      nameHe: c.nameHe,
      emoji: c.emoji,
      sortOrder: i + 1,
      isDefault: true,
    })),
  });
}
