import { useState, useEffect, useCallback } from 'react'
import { supabase, withTimeout } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useRefreshOnFocus } from './useRefreshOnFocus'
import { emit, on } from '../lib/events'

export function useStock() {
  const { profile } = useAuth()
  const [stockItems, setStockItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetch = useCallback(async () => {
    if (!profile?.household_id) {
      setLoading(false)
      return
    }
    console.log('[useStock] Fetching...')
    setLoading(true)
    setError(null)

    const { data, error: fetchErr } = await withTimeout(
      supabase
        .from('stock')
        .select('*, items(id, name, name_he, emoji, photo_url, default_unit, auto_track_stock, category_id, categories(id, name, name_he, emoji, sort_order))')
        .eq('household_id', profile.household_id)
        .order('updated_at', { ascending: false })
    )

    if (data) {
      console.log(`[useStock] Loaded ${data.length} stock items`)
      setStockItems(data)
    }
    if (fetchErr) {
      console.error('[useStock] Failed:', fetchErr)
      setError(fetchErr.message || 'Failed to load stock')
    }
    setLoading(false)
  }, [profile?.household_id])

  useEffect(() => {
    fetch()
  }, [fetch])

  useRefreshOnFocus(fetch)

  // Listen for stock invalidation from other hook instances
  useEffect(() => {
    return on('stock-changed', fetch)
  }, [fetch])

  const addToStock = async (itemId, quantity, unit, lowThreshold = 1) => {
    const { data, error } = await supabase
      .from('stock')
      .upsert({
        household_id: profile.household_id,
        item_id: itemId,
        quantity,
        unit,
        low_threshold: lowThreshold,
        updated_by: profile.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'household_id,item_id' })
      .select('*, items(id, name, name_he, emoji, default_unit, category_id, categories(id, name, name_he, emoji, sort_order))')
      .single()

    if (error) throw error
    await fetch()
    emit('stock-changed')
    return data
  }

  const updateQuantity = async (stockId, quantity) => {
    const { error } = await supabase
      .from('stock')
      .update({
        quantity: Math.max(0, quantity),
        updated_by: profile.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', stockId)

    if (error) throw error
    setStockItems((prev) =>
      prev.map((s) => (s.id === stockId ? { ...s, quantity: Math.max(0, quantity) } : s))
    )
  }

  const updateThreshold = async (stockId, lowThreshold) => {
    const { error } = await supabase
      .from('stock')
      .update({ low_threshold: lowThreshold })
      .eq('id', stockId)

    if (error) throw error
    setStockItems((prev) =>
      prev.map((s) => (s.id === stockId ? { ...s, low_threshold: lowThreshold } : s))
    )
  }

  const updateStock = async (stockId, { quantity, unit, low_threshold }) => {
    const updates = {
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
    }
    if (quantity !== undefined) updates.quantity = Math.max(0, quantity)
    if (unit !== undefined) updates.unit = unit
    if (low_threshold !== undefined) updates.low_threshold = Math.max(0, low_threshold)

    const { error } = await supabase
      .from('stock')
      .update(updates)
      .eq('id', stockId)

    if (error) throw error
    setStockItems((prev) =>
      prev.map((s) => (s.id === stockId ? { ...s, ...updates } : s))
    )
  }

  const addToStockIncremental = async (itemId, boughtQuantity, unit) => {
    // Query current stock directly from DB to avoid stale state when processing multiple items
    const { data: existing } = await supabase
      .from('stock')
      .select('id, quantity')
      .eq('household_id', profile.household_id)
      .eq('item_id', itemId)
      .single()

    if (existing) {
      const { error } = await supabase
        .from('stock')
        .update({
          quantity: existing.quantity + boughtQuantity,
          unit,
          updated_by: profile.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
      if (error) throw error
    } else {
      const { error } = await supabase
        .from('stock')
        .upsert({
          household_id: profile.household_id,
          item_id: itemId,
          quantity: boughtQuantity,
          unit,
          low_threshold: 1,
          updated_by: profile.id,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'household_id,item_id' })
      if (error) throw error
    }
  }

  const removeFromStockByItemId = async (itemId) => {
    const existing = stockItems.find((s) => s.item_id === itemId)
    if (existing) await removeFromStock(existing.id)
  }

  const removeFromStock = async (stockId) => {
    const { error } = await supabase.from('stock').delete().eq('id', stockId)
    if (error) throw error
    setStockItems((prev) => prev.filter((s) => s.id !== stockId))
    emit('stock-changed')
  }

  const lowStockItems = stockItems.filter((s) => s.quantity <= s.low_threshold)
  const lowStockCount = lowStockItems.length

  return {
    stockItems,
    loading,
    error,
    refetch: fetch,
    addToStock,
    addToStockIncremental,
    removeFromStockByItemId,
    updateQuantity,
    updateThreshold,
    updateStock,
    removeFromStock,
    lowStockItems,
    lowStockCount,
  }
}
