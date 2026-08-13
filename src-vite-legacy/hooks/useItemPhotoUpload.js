import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { compressItemPhoto } from '../lib/imageProcessing'

const BUCKET = 'item-photos'

export function useItemPhotoUpload() {
  const { profile } = useAuth()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)

  // Uploads a compressed WebP. If `previousPath` is provided, the old blob
  // is removed after the new one is stored. Path is scoped to the caller's
  // household so RLS allows the write; the filename is a random UUID so we
  // don't need the item id up front (create and edit flows share this).
  const upload = useCallback(async (file, previousPath = null) => {
    if (!profile?.household_id) throw new Error('Not signed in')

    setUploading(true)
    setError(null)
    try {
      const { blob } = await compressItemPhoto(file)
      console.log(`[ItemPhoto] compressed to ${(blob.size / 1024).toFixed(1)} KB`)

      const path = `${profile.household_id}/${crypto.randomUUID()}.webp`
      const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, {
          contentType: 'image/webp',
          cacheControl: '31536000',
        })
      if (uploadErr) throw uploadErr

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path)

      if (previousPath && previousPath !== path) {
        supabase.storage.from(BUCKET).remove([previousPath]).then(({ error: e }) => {
          if (e) console.warn('[ItemPhoto] failed to remove old blob:', e.message)
        })
      }

      return { photo_url: urlData.publicUrl, photo_path: path }
    } catch (err) {
      console.error('[ItemPhoto] upload failed:', err)
      setError(err.message || 'Upload failed')
      throw err
    } finally {
      setUploading(false)
    }
  }, [profile?.household_id])

  const remove = useCallback(async (photoPath) => {
    if (!photoPath) return
    const { error: e } = await supabase.storage.from(BUCKET).remove([photoPath])
    if (e) console.warn('[ItemPhoto] failed to remove blob:', e.message)
  }, [])

  return { uploading, error, upload, remove }
}
