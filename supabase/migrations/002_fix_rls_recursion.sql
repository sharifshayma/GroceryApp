-- Fix: infinite recursion in profiles RLS policies
-- The profiles policies were subquerying profiles itself, causing a loop.
-- Solution: use a SECURITY DEFINER function that bypasses RLS to get household_id.

-- Step 1: Create helper function (bypasses RLS)
CREATE OR REPLACE FUNCTION get_my_household_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT household_id FROM public.profiles WHERE id = auth.uid();
$$;

-- Step 2: Drop the recursive profiles policy
DROP POLICY IF EXISTS "Users can view household members" ON profiles;

-- Step 3: Recreate it using the helper function
CREATE POLICY "Users can view household members"
  ON profiles FOR SELECT
  USING (household_id = get_my_household_id());

-- Step 4: Update all other policies to use the helper function too
-- (prevents potential recursion in other tables as well)

-- CATEGORIES
DROP POLICY IF EXISTS "Household members can view categories" ON categories;
DROP POLICY IF EXISTS "Household members can insert categories" ON categories;
DROP POLICY IF EXISTS "Household members can update categories" ON categories;
DROP POLICY IF EXISTS "Household members can delete categories" ON categories;

CREATE POLICY "Household members can view categories"
  ON categories FOR SELECT USING (household_id = get_my_household_id());
CREATE POLICY "Household members can insert categories"
  ON categories FOR INSERT WITH CHECK (household_id = get_my_household_id());
CREATE POLICY "Household members can update categories"
  ON categories FOR UPDATE USING (household_id = get_my_household_id());
CREATE POLICY "Household members can delete categories"
  ON categories FOR DELETE USING (household_id = get_my_household_id());

-- ITEMS
DROP POLICY IF EXISTS "Household members can view items" ON items;
DROP POLICY IF EXISTS "Household members can insert items" ON items;
DROP POLICY IF EXISTS "Household members can update items" ON items;
DROP POLICY IF EXISTS "Household members can delete items" ON items;

CREATE POLICY "Household members can view items"
  ON items FOR SELECT USING (household_id = get_my_household_id());
CREATE POLICY "Household members can insert items"
  ON items FOR INSERT WITH CHECK (household_id = get_my_household_id());
CREATE POLICY "Household members can update items"
  ON items FOR UPDATE USING (household_id = get_my_household_id());
CREATE POLICY "Household members can delete items"
  ON items FOR DELETE USING (household_id = get_my_household_id());

-- TAGS
DROP POLICY IF EXISTS "Household members can view tags" ON tags;
DROP POLICY IF EXISTS "Household members can insert tags" ON tags;
DROP POLICY IF EXISTS "Household members can update tags" ON tags;
DROP POLICY IF EXISTS "Household members can delete tags" ON tags;

CREATE POLICY "Household members can view tags"
  ON tags FOR SELECT USING (household_id = get_my_household_id());
CREATE POLICY "Household members can insert tags"
  ON tags FOR INSERT WITH CHECK (household_id = get_my_household_id());
CREATE POLICY "Household members can update tags"
  ON tags FOR UPDATE USING (household_id = get_my_household_id());
CREATE POLICY "Household members can delete tags"
  ON tags FOR DELETE USING (household_id = get_my_household_id());

-- ITEM_TAGS
DROP POLICY IF EXISTS "Household members can view item_tags" ON item_tags;
DROP POLICY IF EXISTS "Household members can insert item_tags" ON item_tags;
DROP POLICY IF EXISTS "Household members can delete item_tags" ON item_tags;

CREATE POLICY "Household members can view item_tags"
  ON item_tags FOR SELECT
  USING (item_id IN (SELECT id FROM items WHERE household_id = get_my_household_id()));
CREATE POLICY "Household members can insert item_tags"
  ON item_tags FOR INSERT
  WITH CHECK (item_id IN (SELECT id FROM items WHERE household_id = get_my_household_id()));
CREATE POLICY "Household members can delete item_tags"
  ON item_tags FOR DELETE
  USING (item_id IN (SELECT id FROM items WHERE household_id = get_my_household_id()));

-- GROCERY_LISTS
DROP POLICY IF EXISTS "Household members can view lists" ON grocery_lists;
DROP POLICY IF EXISTS "Household members can insert lists" ON grocery_lists;
DROP POLICY IF EXISTS "Household members can update lists" ON grocery_lists;
DROP POLICY IF EXISTS "Household members can delete lists" ON grocery_lists;

CREATE POLICY "Household members can view lists"
  ON grocery_lists FOR SELECT USING (household_id = get_my_household_id());
CREATE POLICY "Household members can insert lists"
  ON grocery_lists FOR INSERT WITH CHECK (household_id = get_my_household_id());
CREATE POLICY "Household members can update lists"
  ON grocery_lists FOR UPDATE USING (household_id = get_my_household_id());
CREATE POLICY "Household members can delete lists"
  ON grocery_lists FOR DELETE USING (household_id = get_my_household_id());

-- LIST_ITEMS
DROP POLICY IF EXISTS "Household members can view list items" ON list_items;
DROP POLICY IF EXISTS "Household members can insert list items" ON list_items;
DROP POLICY IF EXISTS "Household members can update list items" ON list_items;
DROP POLICY IF EXISTS "Household members can delete list items" ON list_items;

CREATE POLICY "Household members can view list items"
  ON list_items FOR SELECT
  USING (list_id IN (SELECT id FROM grocery_lists WHERE household_id = get_my_household_id()));
CREATE POLICY "Household members can insert list items"
  ON list_items FOR INSERT
  WITH CHECK (list_id IN (SELECT id FROM grocery_lists WHERE household_id = get_my_household_id()));
CREATE POLICY "Household members can update list items"
  ON list_items FOR UPDATE
  USING (list_id IN (SELECT id FROM grocery_lists WHERE household_id = get_my_household_id()));
CREATE POLICY "Household members can delete list items"
  ON list_items FOR DELETE
  USING (list_id IN (SELECT id FROM grocery_lists WHERE household_id = get_my_household_id()));

-- STOCK
DROP POLICY IF EXISTS "Household members can view stock" ON stock;
DROP POLICY IF EXISTS "Household members can insert stock" ON stock;
DROP POLICY IF EXISTS "Household members can update stock" ON stock;
DROP POLICY IF EXISTS "Household members can delete stock" ON stock;

CREATE POLICY "Household members can view stock"
  ON stock FOR SELECT USING (household_id = get_my_household_id());
CREATE POLICY "Household members can insert stock"
  ON stock FOR INSERT WITH CHECK (household_id = get_my_household_id());
CREATE POLICY "Household members can update stock"
  ON stock FOR UPDATE USING (household_id = get_my_household_id());
CREATE POLICY "Household members can delete stock"
  ON stock FOR DELETE USING (household_id = get_my_household_id());

-- PRICE_HISTORY
DROP POLICY IF EXISTS "Household members can view price history" ON price_history;
DROP POLICY IF EXISTS "Household members can insert price history" ON price_history;
DROP POLICY IF EXISTS "Household members can delete price history" ON price_history;

CREATE POLICY "Household members can view price history"
  ON price_history FOR SELECT USING (household_id = get_my_household_id());
CREATE POLICY "Household members can insert price history"
  ON price_history FOR INSERT WITH CHECK (household_id = get_my_household_id());
CREATE POLICY "Household members can delete price history"
  ON price_history FOR DELETE USING (household_id = get_my_household_id());

-- INVITATIONS
DROP POLICY IF EXISTS "Household members can view invitations" ON invitations;
DROP POLICY IF EXISTS "Household members can insert invitations" ON invitations;
DROP POLICY IF EXISTS "Household members can update invitations" ON invitations;

CREATE POLICY "Household members can view invitations"
  ON invitations FOR SELECT USING (household_id = get_my_household_id());
CREATE POLICY "Household members can insert invitations"
  ON invitations FOR INSERT WITH CHECK (household_id = get_my_household_id());
CREATE POLICY "Household members can update invitations"
  ON invitations FOR UPDATE USING (household_id = get_my_household_id());

-- HOUSEHOLDS (fix the member view policy too)
DROP POLICY IF EXISTS "Members can view their household" ON households;

CREATE POLICY "Members can view their household"
  ON households FOR SELECT
  USING (id = get_my_household_id());
