-- Fix: add missing UPDATE policy on item_tags for saving notes
CREATE POLICY "Household members can update item_tags"
  ON item_tags FOR UPDATE
  USING (item_id IN (SELECT id FROM items WHERE household_id = get_my_household_id()));
