import { useState, useEffect, useCallback } from 'react'
import { supabase, withTimeout } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useRefreshOnFocus } from './useRefreshOnFocus'

export function useCategories() {
  const { profile } = useAuth()
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetch = useCallback(async () => {
    if (!profile?.household_id) {
      setLoading(false)
      return
    }
    console.log('[useCategories] Fetching...')
    setLoading(true)
    setError(null)

    const { data, error: fetchErr } = await withTimeout(
      supabase
        .from('categories')
        .select('*')
        .eq('household_id', profile.household_id)
        .order('sort_order', { ascending: true })
    )

    if (data) {
      console.log(`[useCategories] Loaded ${data.length} categories`)
      setCategories(data)
    }
    if (fetchErr) {
      console.error('[useCategories] Failed:', fetchErr)
      setError(fetchErr.message || 'Failed to load categories')
    }
    setLoading(false)
  }, [profile?.household_id])

  useEffect(() => {
    fetch()
  }, [fetch])

  useRefreshOnFocus(fetch)

  return { categories, loading, error, refetch: fetch }
}
