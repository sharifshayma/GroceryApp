import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useRefreshOnFocus } from './useRefreshOnFocus'
import * as grocery from '../lib/grocery'

export function useLists() {
  const { profile } = useAuth()
  const [lists, setLists] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const ctx = profile?.household_id ? { householdId: profile.household_id, userId: profile.id } : null

  const fetch = useCallback(async () => {
    if (!ctx) {
      console.log('[useLists] Skipping fetch — no household_id')
      setLoading(false)
      return
    }
    console.log('[useLists] Fetching lists for household:', profile.household_id)
    setLoading(true)
    setError(null)
    try {
      const data = await grocery.fetchLists(supabase, ctx)
      console.log(`[useLists] Loaded ${data.length} lists`)
      setLists(data)
    } catch (e) {
      console.error('[useLists] Failed to fetch lists:', e)
      setError(e.message || 'Failed to load lists')
    }
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.household_id, profile?.id])

  useEffect(() => {
    fetch()
  }, [fetch])

  useRefreshOnFocus(fetch)

  const createList = async (name, items) => {
    const list = await grocery.createList(supabase, ctx, { name, items })
    await fetch()
    return list
  }

  const updateListStatus = async (id, status) => {
    await grocery.updateListStatus(supabase, ctx, { listId: id, status })
    await fetch()
  }

  const deleteList = async (id) => {
    await grocery.deleteList(supabase, ctx, { listId: id })
    setLists((prev) => prev.filter((l) => l.id !== id))
  }

  const duplicateList = async (list) => {
    const newList = await grocery.duplicateList(supabase, ctx, { list })
    await fetch()
    return newList
  }

  const completeAndCarryOver = async (list, carryOverName) => {
    const newList = await grocery.completeAndCarryOver(supabase, ctx, { list, carryOverName })
    await fetch()
    return newList
  }

  const addItemToList = async (listId, item) => {
    await grocery.addItemToList(supabase, ctx, {
      listId,
      itemId: item.item_id,
      quantity: item.quantity,
      unit: item.unit,
      notes: item.notes,
    })
    await fetch()
  }

  const removeItemFromList = async (listItemId) => {
    await grocery.removeItemFromList(supabase, ctx, { listItemId })
    await fetch()
  }

  const updateListItem = async (listItemId, updates) => {
    await grocery.updateListItemFields(supabase, ctx, { listItemId, updates })
    await fetch()
  }

  const updateListName = async (listId, name) => {
    await grocery.updateListName(supabase, ctx, { listId, name })
    await fetch()
  }

  const toggleBought = async (listItemId, isBought, boughtQuantity = null) => {
    await grocery.setListItemBought(supabase, ctx, { listItemId, isBought, boughtQuantity })
    await fetch()
  }

  return {
    lists,
    loading,
    error,
    refetch: fetch,
    createList,
    updateListStatus,
    deleteList,
    duplicateList,
    completeAndCarryOver,
    toggleBought,
    addItemToList,
    removeItemFromList,
    updateListItem,
    updateListName,
  }
}
