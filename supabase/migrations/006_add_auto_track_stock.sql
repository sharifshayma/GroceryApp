-- Add auto_track_stock flag to items table (default ON)
-- When ON: buying items in a shopping list automatically updates stock quantities
-- When OFF: buying items removes them from stock (no quantity tracking)
ALTER TABLE items ADD COLUMN auto_track_stock BOOLEAN DEFAULT true NOT NULL;
