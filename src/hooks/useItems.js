import { useState, useEffect, useCallback } from 'react'
import { supabase, withTimeout } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useRefreshOnFocus } from './useRefreshOnFocus'

export function useItems(categoryId = null) {
  const { profile } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetch = useCallback(async () => {
    if (!profile?.household_id) {
      setLoading(false)
      return
    }
    console.log('[useItems] Fetching...')
    setLoading(true)
    setError(null)

    let query = supabase
      .from('items')
      .select('*, categories(name, name_he, emoji)')
      .eq('household_id', profile.household_id)
      .order('created_at', { ascending: false })

    if (categoryId) {
      query = query.eq('category_id', categoryId)
    }

    const { data, error: fetchErr } = await withTimeout(query)

    if (data) {
      console.log(`[useItems] Loaded ${data.length} items`)
      setItems(data)
    }
    if (fetchErr) {
      console.error('[useItems] Failed:', fetchErr)
      setError(fetchErr.message || 'Failed to load items')
    }
    setLoading(false)
  }, [profile?.household_id, categoryId])

  useEffect(() => {
    fetch()
  }, [fetch])

  useRefreshOnFocus(fetch)

  const addItem = async (item) => {
    const { data, error } = await supabase
      .from('items')
      .insert({
        ...item,
        household_id: profile.household_id,
        created_by: profile.id,
      })
      .select('*, categories(name, name_he, emoji)')
      .single()

    if (error) throw error
    setItems((prev) => [data, ...prev])
    return data
  }

  const updateItem = async (id, updates) => {
    const { data, error } = await supabase
      .from('items')
      .update(updates)
      .eq('id', id)
      .select('*, categories(name, name_he, emoji)')
      .single()

    if (error) throw error
    setItems((prev) => prev.map((i) => (i.id === id ? data : i)))
    return data
  }

  const deleteItem = async (id) => {
    const { error } = await supabase.from('items').delete().eq('id', id)
    if (error) throw error
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  return { items, loading, error, refetch: fetch, addItem, updateItem, deleteItem }
}
