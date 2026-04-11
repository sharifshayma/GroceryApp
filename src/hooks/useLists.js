import { useState, useEffect, useCallback } from 'react'
import { supabase, withTimeout } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useRefreshOnFocus } from './useRefreshOnFocus'

export function useLists() {
  const { profile } = useAuth()
  const [lists, setLists] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetch = useCallback(async () => {
    if (!profile?.household_id) {
      console.log('[useLists] Skipping fetch — no household_id')
      setLoading(false)
      return
    }
    console.log('[useLists] Fetching lists for household:', profile.household_id)
    setLoading(true)
    setError(null)

    // Try with extended columns first, fall back if migrations not applied yet
    let { data, error: fetchErr } = await withTimeout(
      supabase
        .from('grocery_lists')
        .select('*, list_items(id, item_id, quantity, unit, is_bought, notes, stock_updated, items(name, name_he, emoji, default_unit, category_id, categories(name, name_he, emoji)))')
        .eq('household_id', profile.household_id)
        .order('created_at', { ascending: false })
    )

    if (fetchErr) {
      console.warn('[useLists] Primary query failed, trying fallback:', fetchErr.message)
      const fallback = await withTimeout(
        supabase
          .from('grocery_lists')
          .select('*, list_items(id, item_id, quantity, unit, is_bought, items(name, name_he, emoji, default_unit, category_id, categories(name, name_he, emoji)))')
          .eq('household_id', profile.household_id)
          .order('created_at', { ascending: false })
      )
      data = fallback.data
      fetchErr = fallback.error
    }

    if (data) {
      console.log(`[useLists] Loaded ${data.length} lists`)
      setLists(data)
    }
    if (fetchErr) {
      console.error('[useLists] Failed to fetch lists:', fetchErr)
      setError(fetchErr.message || 'Failed to load lists')
    }
    setLoading(false)
  }, [profile?.household_id])

  useEffect(() => {
    fetch()
  }, [fetch])

  useRefreshOnFocus(fetch)

  const createList = async (name, items) => {
    // items: [{ item_id, quantity, unit }]
    const { data: list, error: listErr } = await supabase
      .from('grocery_lists')
      .insert({
        household_id: profile.household_id,
        name,
        status: 'draft',
        created_by: profile.id,
      })
      .select()
      .single()

    if (listErr) throw listErr

    if (items.length > 0) {
      const listItems = items.map((item) => ({
        list_id: list.id,
        item_id: item.item_id,
        quantity: item.quantity,
        unit: item.unit,
        ...(item.notes ? { notes: item.notes } : {}),
      }))

      const { error: itemsErr } = await supabase
        .from('list_items')
        .insert(listItems)

      if (itemsErr) throw itemsErr
    }

    await fetch()
    return list
  }

  const updateListStatus = async (id, status) => {
    const updates = { status }
    if (status === 'completed') updates.completed_at = new Date().toISOString()

    const { error } = await supabase
      .from('grocery_lists')
      .update(updates)
      .eq('id', id)

    if (error) throw error
    await fetch()
  }

  const deleteList = async (id) => {
    const { error } = await supabase.from('grocery_lists').delete().eq('id', id)
    if (error) throw error
    setLists((prev) => prev.filter((l) => l.id !== id))
  }

  const duplicateList = async (list) => {
    const newName = `${list.name} (copy)`
    const items = (list.list_items || []).map((li) => ({
      item_id: li.item_id,
      quantity: li.quantity,
      unit: li.unit,
    }))
    return createList(newName, items)
  }

  const completeAndCarryOver = async (list, carryOverName) => {
    const unboughtItems = (list.list_items || [])
      .filter((li) => !li.is_bought)
      .map((li) => ({
        item_id: li.item_id,
        quantity: li.quantity,
        unit: li.unit,
        ...(li.notes ? { notes: li.notes } : {}),
      }))

    // Complete the current list first (more important action)
    await updateListStatus(list.id, 'completed')

    // Create new draft with unbought items
    if (unboughtItems.length > 0) {
      const newList = await createList(carryOverName, unboughtItems)
      return newList
    }
    return null
  }

  const addItemToList = async (listId, item) => {
    // item: { item_id, quantity, unit, notes? }
    const { error } = await supabase
      .from('list_items')
      .insert({
        list_id: listId,
        item_id: item.item_id,
        quantity: item.quantity,
        unit: item.unit,
        ...(item.notes ? { notes: item.notes } : {}),
      })
    if (error) throw error
    await fetch()
  }

  const removeItemFromList = async (listItemId) => {
    const { error } = await supabase
      .from('list_items')
      .delete()
      .eq('id', listItemId)
    if (error) throw error
    await fetch()
  }

  const updateListItem = async (listItemId, updates) => {
    // updates: { quantity?, unit?, notes? }
    const { error } = await supabase
      .from('list_items')
      .update(updates)
      .eq('id', listItemId)
    if (error) throw error
    await fetch()
  }

  const updateListName = async (listId, name) => {
    const { error } = await supabase
      .from('grocery_lists')
      .update({ name })
      .eq('id', listId)
    if (error) throw error
    await fetch()
  }

  const toggleBought = async (listItemId, isBought) => {
    const updates = {
      is_bought: isBought,
      bought_by: isBought ? profile.id : null,
      bought_at: isBought ? new Date().toISOString() : null,
    }

    const { error } = await supabase
      .from('list_items')
      .update(updates)
      .eq('id', listItemId)

    if (error) throw error
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
