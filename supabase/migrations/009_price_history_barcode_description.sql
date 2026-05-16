-- GroceryApp V2 - Add barcode + description to price_history, and an UPDATE policy.
-- Run this in Supabase SQL Editor.

ALTER TABLE price_history
  ADD COLUMN IF NOT EXISTS barcode TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT;

CREATE INDEX IF NOT EXISTS idx_price_history_barcode ON price_history(barcode);

-- The original migration only declared SELECT / INSERT / DELETE policies on
-- price_history. We need UPDATE so the user can edit existing entries from
-- the item modal.
DROP POLICY IF EXISTS "Household members can update price history" ON price_history;
CREATE POLICY "Household members can update price history"
  ON price_history FOR UPDATE
  USING (household_id = (SELECT household_id FROM profiles WHERE id = auth.uid()));
