import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useRefreshOnFocus } from './useRefreshOnFocus'
import * as grocery from '../lib/grocery'

export function useItems(categoryId = null) {
  const { profile } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const ctx = profile?.household_id ? { householdId: profile.household_id, userId: profile.id } : null

  const fetch = useCallback(async () => {
    if (!ctx) {
      setLoading(false)
      return
    }
    console.log('[useItems] Fetching...')
    setLoading(true)
    setError(null)
    try {
      const data = await grocery.fetchItems(supabase, ctx, { categoryId })
      console.log(`[useItems] Loaded ${data.length} items`)
      setItems(data)
    } catch (e) {
      console.error('[useItems] Failed:', e)
      setError(e.message || 'Failed to load items')
    }
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.household_id, profile?.id, categoryId])

  useEffect(() => {
    fetch()
  }, [fetch])

  useRefreshOnFocus(fetch)

  const addItem = async (item) => {
    const data = await grocery.createItem(supabase, ctx, { item })
    setItems((prev) => [data, ...prev])
    return data
  }

  const updateItem = async (id, updates) => {
    const data = await grocery.updateItem(supabase, ctx, { itemId: id, updates })
    setItems((prev) => prev.map((i) => (i.id === id ? data : i)))
    return data
  }

  const deleteItem = async (id) => {
    const photoPath = items.find((i) => i.id === id)?.photo_path
    await grocery.deleteItem(supabase, ctx, { itemId: id })
    setItems((prev) => prev.filter((i) => i.id !== id))
    if (photoPath) {
      supabase.storage
        .from('item-photos')
        .remove([photoPath])
        .then(({ error: e }) => {
          if (e) console.warn('[useItems] failed to remove photo blob:', e.message)
        })
    }
  }

  return { items, loading, error, refetch: fetch, addItem, updateItem, deleteItem }
}
