-- Add photo_url (public URL for display) and photo_path (storage path for deletes)
-- to items. Photo replaces emoji in the UI when set; emoji stays as the fallback.
ALTER TABLE items ADD COLUMN photo_url TEXT;
ALTER TABLE items ADD COLUMN photo_path TEXT;

-- Public storage bucket for item photos. Public so <img src> works without
-- signed URLs (items are already household-scoped by the items RLS). The path
-- starts with the household_id so storage policies can scope writes to members.
INSERT INTO storage.buckets (id, name, public)
VALUES ('item-photos', 'item-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Only members of a household can write under {household_id}/...
CREATE POLICY "item-photos: household members can upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'item-photos'
    AND (storage.foldername(name))[1] = (
      SELECT household_id::text FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "item-photos: household members can update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'item-photos'
    AND (storage.foldername(name))[1] = (
      SELECT household_id::text FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "item-photos: household members can delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'item-photos'
    AND (storage.foldername(name))[1] = (
      SELECT household_id::text FROM profiles WHERE id = auth.uid()
    )
  );

-- Reads are public (bucket is public), so no SELECT policy is needed.
