-- Add notes column to list_items for storing tag notes at list creation time
ALTER TABLE list_items ADD COLUMN notes TEXT;
