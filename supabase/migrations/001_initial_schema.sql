-- GroceryApp V2 - Initial Schema
-- Run this in Supabase SQL Editor

-- ============================================================
-- TABLES
-- ============================================================

-- Households
CREATE TABLE households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  invite_code TEXT UNIQUE DEFAULT substr(md5(random()::text), 1, 8),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- User profiles (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  household_id UUID REFERENCES households(id) ON DELETE SET NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  language TEXT DEFAULT 'he' CHECK (language IN ('en', 'he')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Categories (emoji now, photo_url for later)
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_he TEXT,
  emoji TEXT DEFAULT '📦',
  photo_url TEXT,
  sort_order INT DEFAULT 0,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Master items
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  name_he TEXT,
  emoji TEXT DEFAULT '🛒',
  default_unit TEXT DEFAULT 'pcs',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tags
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('recipe', 'store', 'custom')),
  description TEXT,
  color TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Item-Tag junction
CREATE TABLE item_tags (
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  notes TEXT,
  PRIMARY KEY (item_id, tag_id)
);

-- Grocery lists
CREATE TABLE grocery_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- List items
CREATE TABLE list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES grocery_lists(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  quantity NUMERIC DEFAULT 1,
  unit TEXT DEFAULT 'pcs',
  is_bought BOOLEAN DEFAULT false,
  bought_by UUID REFERENCES auth.users(id),
  bought_at TIMESTAMPTZ
);

-- Home stock
CREATE TABLE stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  quantity NUMERIC DEFAULT 0,
  unit TEXT DEFAULT 'pcs',
  low_threshold NUMERIC DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  UNIQUE(household_id, item_id)
);

-- Price history
CREATE TABLE price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  price NUMERIC NOT NULL,
  currency TEXT DEFAULT 'ILS',
  store TEXT,
  quantity_amount NUMERIC,
  quantity_unit TEXT,
  purchased_at DATE DEFAULT CURRENT_DATE,
  logged_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Household invitations
CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  email TEXT,
  invited_by UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_profiles_household ON profiles(household_id);
CREATE INDEX idx_categories_household ON categories(household_id);
CREATE INDEX idx_items_household ON items(household_id);
CREATE INDEX idx_items_category ON items(category_id);
CREATE INDEX idx_tags_household ON tags(household_id);
CREATE INDEX idx_grocery_lists_household ON grocery_lists(household_id);
CREATE INDEX idx_list_items_list ON list_items(list_id);
CREATE INDEX idx_stock_household ON stock(household_id);
CREATE INDEX idx_price_history_item ON price_history(item_id);
CREATE INDEX idx_price_history_household ON price_history(household_id);
CREATE INDEX idx_households_invite_code ON households(invite_code);

-- ============================================================
-- TRIGGER: Auto-create profile on auth.users insert
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE grocery_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Helper: get current user's household_id
-- (Used in policies below as a subquery)

-- === PROFILES ===
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can view household members"
  ON profiles FOR SELECT
  USING (household_id = (SELECT household_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "System can insert profiles"
  ON profiles FOR INSERT
  WITH CHECK (true);

-- === HOUSEHOLDS ===
CREATE POLICY "Members can view their household"
  ON households FOR SELECT
  USING (id = (SELECT household_id FROM profiles WHERE id = auth.uid()));

-- Allow lookup by invite_code for join flow
CREATE POLICY "Anyone can lookup by invite code"
  ON households FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create households"
  ON households FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Owners can update their household"
  ON households FOR UPDATE
  USING (created_by = auth.uid());

-- === CATEGORIES (household-scoped) ===
CREATE POLICY "Household members can view categories"
  ON categories FOR SELECT
  USING (household_id = (SELECT household_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Household members can insert categories"
  ON categories FOR INSERT
  WITH CHECK (household_id = (SELECT household_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Household members can update categories"
  ON categories FOR UPDATE
  USING (household_id = (SELECT household_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Household members can delete categories"
  ON categories FOR DELETE
  USING (household_id = (SELECT household_id FROM profiles WHERE id = auth.uid()));

-- === ITEMS (household-scoped) ===
CREATE POLICY "Household members can view items"
  ON items FOR SELECT
  USING (household_id = (SELECT household_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Household members can insert items"
  ON items FOR INSERT
  WITH CHECK (household_id = (SELECT household_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Household members can update items"
  ON items FOR UPDATE
  USING (household_id = (SELECT household_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Household members can delete items"
  ON items FOR DELETE
  USING (household_id = (SELECT household_id FROM profiles WHERE id = auth.uid()));

-- === TAGS (household-scoped) ===
CREATE POLICY "Household members can view tags"
  ON tags FOR SELECT
  USING (household_id = (SELECT household_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Household members can insert tags"
  ON tags FOR INSERT
  WITH CHECK (household_id = (SELECT household_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Household members can update tags"
  ON tags FOR UPDATE
  USING (household_id = (SELECT household_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Household members can delete tags"
  ON tags FOR DELETE
  USING (household_id = (SELECT household_id FROM profiles WHERE id = auth.uid()));

-- === ITEM_TAGS ===
CREATE POLICY "Household members can view item_tags"
  ON item_tags FOR SELECT
  USING (item_id IN (SELECT id FROM items WHERE household_id = (SELECT household_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Household members can insert item_tags"
  ON item_tags FOR INSERT
  WITH CHECK (item_id IN (SELECT id FROM items WHERE household_id = (SELECT household_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Household members can delete item_tags"
  ON item_tags FOR DELETE
  USING (item_id IN (SELECT id FROM items WHERE household_id = (SELECT household_id FROM profiles WHERE id = auth.uid())));

-- === GROCERY_LISTS (household-scoped) ===
CREATE POLICY "Household members can view lists"
  ON grocery_lists FOR SELECT
  USING (household_id = (SELECT household_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Household members can insert lists"
  ON grocery_lists FOR INSERT
  WITH CHECK (household_id = (SELECT household_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Household members can update lists"
  ON grocery_lists FOR UPDATE
  USING (household_id = (SELECT household_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Household members can delete lists"
  ON grocery_lists FOR DELETE
  USING (household_id = (SELECT household_id FROM profiles WHERE id = auth.uid()));

-- === LIST_ITEMS ===
CREATE POLICY "Household members can view list items"
  ON list_items FOR SELECT
  USING (list_id IN (SELECT id FROM grocery_lists WHERE household_id = (SELECT household_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Household members can insert list items"
  ON list_items FOR INSERT
  WITH CHECK (list_id IN (SELECT id FROM grocery_lists WHERE household_id = (SELECT household_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Household members can update list items"
  ON list_items FOR UPDATE
  USING (list_id IN (SELECT id FROM grocery_lists WHERE household_id = (SELECT household_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Household members can delete list items"
  ON list_items FOR DELETE
  USING (list_id IN (SELECT id FROM grocery_lists WHERE household_id = (SELECT household_id FROM profiles WHERE id = auth.uid())));

-- === STOCK (household-scoped) ===
CREATE POLICY "Household members can view stock"
  ON stock FOR SELECT
  USING (household_id = (SELECT household_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Household members can insert stock"
  ON stock FOR INSERT
  WITH CHECK (household_id = (SELECT household_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Household members can update stock"
  ON stock FOR UPDATE
  USING (household_id = (SELECT household_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Household members can delete stock"
  ON stock FOR DELETE
  USING (household_id = (SELECT household_id FROM profiles WHERE id = auth.uid()));

-- === PRICE_HISTORY (household-scoped) ===
CREATE POLICY "Household members can view price history"
  ON price_history FOR SELECT
  USING (household_id = (SELECT household_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Household members can insert price history"
  ON price_history FOR INSERT
  WITH CHECK (household_id = (SELECT household_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Household members can delete price history"
  ON price_history FOR DELETE
  USING (household_id = (SELECT household_id FROM profiles WHERE id = auth.uid()));

-- === INVITATIONS (household-scoped) ===
CREATE POLICY "Household members can view invitations"
  ON invitations FOR SELECT
  USING (household_id = (SELECT household_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Household members can insert invitations"
  ON invitations FOR INSERT
  WITH CHECK (household_id = (SELECT household_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Household members can update invitations"
  ON invitations FOR UPDATE
  USING (household_id = (SELECT household_id FROM profiles WHERE id = auth.uid()));
