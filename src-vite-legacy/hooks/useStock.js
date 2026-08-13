import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useRefreshOnFocus } from './useRefreshOnFocus'
import { emit, on } from '../lib/events'
import * as grocery from '../lib/grocery'

export function useStock() {
  const { profile } = useAuth()
  const [stockItems, setStockItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const ctx = profile?.household_id ? { householdId: profile.household_id, userId: profile.id } : null

  const fetch = useCallback(async () => {
    if (!ctx) {
      setLoading(false)
      return
    }
    console.log('[useStock] Fetching...')
    setLoading(true)
    setError(null)
    try {
      const data = await grocery.fetchStock(supabase, ctx)
      console.log(`[useStock] Loaded ${data.length} stock items`)
      setStockItems(data)
    } catch (e) {
      console.error('[useStock] Failed:', e)
      setError(e.message || 'Failed to load stock')
    }
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.household_id, profile?.id])

  useEffect(() => {
    fetch()
  }, [fetch])

  useRefreshOnFocus(fetch)

  useEffect(() => {
    return on('stock-changed', fetch)
  }, [fetch])

  const addToStock = async (itemId, quantity, unit, lowThreshold = 1) => {
    const data = await grocery.upsertStock(supabase, ctx, { itemId, quantity, unit, lowThreshold })
    await fetch()
    emit('stock-changed')
    return data
  }

  const updateQuantity = async (stockId, quantity) => {
    const safe = await grocery.updateStockQuantity(supabase, ctx, { stockId, quantity })
    setStockItems((prev) => prev.map((s) => (s.id === stockId ? { ...s, quantity: safe } : s)))
  }

  const updateThreshold = async (stockId, lowThreshold) => {
    const safe = await grocery.updateStockThreshold(supabase, ctx, { stockId, lowThreshold })
    setStockItems((prev) => prev.map((s) => (s.id === stockId ? { ...s, low_threshold: safe } : s)))
  }

  const updateStock = async (stockId, { quantity, unit, low_threshold }) => {
    const updates = await grocery.updateStockFields(supabase, ctx, {
      stockId,
      quantity,
      unit,
      lowThreshold: low_threshold,
    })
    setStockItems((prev) => prev.map((s) => (s.id === stockId ? { ...s, ...updates } : s)))
  }

  const addToStockIncremental = async (itemId, boughtQuantity, unit) => {
    await grocery.adjustStock(supabase, ctx, { itemId, deltaQty: boughtQuantity, unit })
  }

  const removeFromStockByItemId = async (itemId) => {
    const existing = stockItems.find((s) => s.item_id === itemId)
    if (existing) await removeFromStock(existing.id)
  }

  const removeFromStock = async (stockId) => {
    await grocery.deleteStock(supabase, ctx, { stockId })
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
