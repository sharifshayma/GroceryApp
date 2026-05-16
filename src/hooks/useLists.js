import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useRefreshOnFocus } from './useRefreshOnFocus'
import * as grocery from '../lib/grocery'

export function useLists() {
  const { profile } = useAuth()
  const [lists, setLists] = useState([])
  // `loading` only flips true for the initial load. Background refetches
  // (focus-refresh, post-mutation reconciliation if any) leave it false so
  // the page doesn't unmount into a spinner mid-interaction.
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const hasLoadedRef = useRef(false)
  // Keep the latest `lists` accessible inside async mutators without
  // re-creating callbacks on every render.
  const listsRef = useRef(lists)
  useEffect(() => { listsRef.current = lists }, [lists])

  const ctx = profile?.household_id ? { householdId: profile.household_id, userId: profile.id } : null

  const fetch = useCallback(async () => {
    if (!ctx) {
      console.log('[useLists] Skipping fetch — no household_id')
      setLoading(false)
      return
    }
    console.log('[useLists] Fetching lists for household:', profile.household_id)
    if (!hasLoadedRef.current) setLoading(true)
    setError(null)
    try {
      const data = await grocery.fetchLists(supabase, ctx)
      console.log(`[useLists] Loaded ${data.length} lists`)
      setLists(data)
      hasLoadedRef.current = true
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

  // Apply a transform to `lists` locally, then run the server mutation.
  // On failure, restore the pre-mutation snapshot and surface the error.
  // This is what keeps the shopping view feeling instant — the UI moves
  // synchronously; the network call rides in the background.
  const optimistic = async (transform, mutation) => {
    const snapshot = listsRef.current
    setLists(transform(snapshot))
    try {
      await mutation()
    } catch (e) {
      console.error('[useLists] Mutation failed, rolling back:', e)
      setLists(snapshot)
      setError(e.message || 'Failed to save')
      throw e
    }
  }

  const removeItemFromList = (listItemId) =>
    optimistic(
      (prev) =>
        prev.map((l) => ({
          ...l,
          list_items: (l.list_items || []).filter((li) => li.id !== listItemId),
        })),
      () => grocery.removeItemFromList(supabase, ctx, { listItemId })
    )

  const updateListItem = (listItemId, updates) =>
    optimistic(
      (prev) =>
        prev.map((l) => ({
          ...l,
          list_items: (l.list_items || []).map((li) =>
            li.id === listItemId ? { ...li, ...updates } : li
          ),
        })),
      () => grocery.updateListItemFields(supabase, ctx, { listItemId, updates })
    )

  const updateListName = (listId, name) =>
    optimistic(
      (prev) => prev.map((l) => (l.id === listId ? { ...l, name } : l)),
      () => grocery.updateListName(supabase, ctx, { listId, name })
    )

  const toggleBought = (listItemId, isBought, boughtQuantity = null) =>
    optimistic(
      (prev) =>
        prev.map((l) => ({
          ...l,
          list_items: (l.list_items || []).map((li) => {
            if (li.id !== listItemId) return li
            const next = {
              ...li,
              is_bought: isBought,
              bought_at: isBought ? new Date().toISOString() : null,
            }
            if (isBought && boughtQuantity !== null) next.quantity = boughtQuantity
            return next
          }),
        })),
      () =>
        grocery.setListItemBought(supabase, ctx, {
          listItemId,
          isBought,
          boughtQuantity,
        })
    )

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
