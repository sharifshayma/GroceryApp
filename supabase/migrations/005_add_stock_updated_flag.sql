-- Add stock_updated flag to track which bought items have been synced to stock
ALTER TABLE list_items ADD COLUMN stock_updated BOOLEAN DEFAULT false;
