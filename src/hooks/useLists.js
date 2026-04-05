import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useLists() {
  const { profile } = useAuth()
  const [lists, setLists] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!profile?.household_id) return
    setLoading(true)

    const { data, error } = await supabase
      .from('grocery_lists')
      .select('*, list_items(id, item_id, quantity, unit, is_bought, items(name, name_he, emoji, category_id, categories(name, name_he, emoji)))')
      .eq('household_id', profile.household_id)
      .order('created_at', { ascending: false })

    if (data) setLists(data)
    if (error) console.error('Failed to fetch lists:', error)
    setLoading(false)
  }, [profile?.household_id])

  useEffect(() => {
    fetch()
  }, [fetch])

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
    refetch: fetch,
    createList,
    updateListStatus,
    deleteList,
    duplicateList,
    toggleBought,
  }
}
