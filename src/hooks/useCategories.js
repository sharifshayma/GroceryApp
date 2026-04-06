import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useRefreshOnFocus } from './useRefreshOnFocus'

export function useCategories() {
  const { profile } = useAuth()
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!profile?.household_id) return
    setLoading(true)

    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('household_id', profile.household_id)
      .order('sort_order', { ascending: true })

    if (data) setCategories(data)
    if (error) console.error('Failed to fetch categories:', error)
    setLoading(false)
  }, [profile?.household_id])

  useEffect(() => {
    fetch()
  }, [fetch])

  useRefreshOnFocus(fetch)

  return { categories, loading, refetch: fetch }
}
