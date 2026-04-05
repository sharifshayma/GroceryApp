import { supabase } from './supabase'

const DEFAULT_CATEGORIES = [
  { name: 'Vegetables & Fruits', name_he: 'ירקות ופירות', emoji: '🥬', sort_order: 1 },
  { name: 'Nuts & Dried Fruit', name_he: 'אגוזים ופירות יבשים', emoji: '🥜', sort_order: 2 },
  { name: 'Eggs', name_he: 'ביצים', emoji: '🥚', sort_order: 3 },
  { name: 'Dairy', name_he: 'מוצרי חלב', emoji: '🧀', sort_order: 4 },
  { name: 'Meat, Poultry & Fish', name_he: 'בשר, עוף ודגים', emoji: '🥩', sort_order: 5 },
  { name: 'Deli Meat & Salads', name_he: 'נקניקים וסלטים', emoji: '🥗', sort_order: 6 },
  { name: 'Bakery', name_he: 'מאפייה', emoji: '🍞', sort_order: 7 },
  { name: 'Pantry', name_he: 'מזווה', emoji: '🫙', sort_order: 8 },
  { name: 'Chocolate & Sweets', name_he: 'שוקולד וממתקים', emoji: '🍫', sort_order: 9 },
  { name: 'Cakes & Cookies', name_he: 'עוגות ועוגיות', emoji: '🍪', sort_order: 10 },
  { name: 'Ice Cream & Popsicles', name_he: 'גלידות וארטיקים', emoji: '🍦', sort_order: 11 },
  { name: 'Frozen Food', name_he: 'מזון קפוא', emoji: '🧊', sort_order: 12 },
  { name: 'Coffee, Tea & Hot Chocolate', name_he: 'קפה, תה ושוקו', emoji: '☕', sort_order: 13 },
  { name: 'Soft Drinks', name_he: 'משקאות קלים', emoji: '🥤', sort_order: 14 },
  { name: 'Alcohol', name_he: 'אלכוהול', emoji: '🍷', sort_order: 15 },
  { name: 'Baby Food & Products', name_he: 'מזון ומוצרי תינוקות', emoji: '🍼', sort_order: 16 },
  { name: 'Pet Products', name_he: 'מוצרים לחיות מחמד', emoji: '🐾', sort_order: 17 },
  { name: 'House Cleaning & Disposable', name_he: 'ניקיון וחד פעמי', emoji: '🧹', sort_order: 18 },
  { name: 'Hygiene & Care', name_he: 'היגיינה וטיפוח', emoji: '🧴', sort_order: 19 },
  { name: 'Health Care / First Aid', name_he: 'בריאות ועזרה ראשונה', emoji: '💊', sort_order: 20 },
  { name: 'Laundry Products', name_he: 'מוצרי כביסה', emoji: '👕', sort_order: 21 },
]

export async function seedDefaultCategories(householdId) {
  const rows = DEFAULT_CATEGORIES.map((cat) => ({
    household_id: householdId,
    name: cat.name,
    name_he: cat.name_he,
    emoji: cat.emoji,
    sort_order: cat.sort_order,
    is_default: true,
  }))

  const { error } = await supabase.from('categories').insert(rows)
  if (error) {
    console.error('Failed to seed categories:', error)
    throw error
  }
}
