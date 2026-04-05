import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useTags() {
  const { profile } = useAuth()
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!profile?.household_id) {
      setLoading(false)
      return
    }
    setLoading(true)

    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .eq('household_id', profile.household_id)
      .order('type', { ascending: true })
      .order('name', { ascending: true })

    if (data) setTags(data)
    if (error) console.error('Failed to fetch tags:', error)
    setLoading(false)
  }, [profile?.household_id])

  useEffect(() => {
    fetch()
  }, [fetch])

  const createTag = async (tag) => {
    const { data, error } = await supabase
      .from('tags')
      .insert({ ...tag, household_id: profile.household_id })
      .select()
      .single()

    if (error) throw error
    setTags((prev) => [...prev, data])
    return data
  }

  const updateTag = async (id, updates) => {
    const { data, error } = await supabase
      .from('tags')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    setTags((prev) => prev.map((t) => (t.id === id ? data : t)))
    return data
  }

  const deleteTag = async (id) => {
    const { error } = await supabase.from('tags').delete().eq('id', id)
    if (error) throw error
    setTags((prev) => prev.filter((t) => t.id !== id))
  }

  const recipeTags = tags.filter((t) => t.type === 'recipe')
  const storeTags = tags.filter((t) => t.type === 'store')
  const customTags = tags.filter((t) => t.type === 'custom')

  return { tags, recipeTags, storeTags, customTags, loading, refetch: fetch, createTag, updateTag, deleteTag }
}

export function useItemTags(itemId) {
  const [itemTags, setItemTags] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!itemId) { setLoading(false); return }
    setLoading(true)

    const { data, error } = await supabase
      .from('item_tags')
      .select('*, tags(*)')
      .eq('item_id', itemId)

    if (data) setItemTags(data)
    if (error) console.error('Failed to fetch item tags:', error)
    setLoading(false)
  }, [itemId])

  useEffect(() => {
    fetch()
  }, [fetch])

  const assignTag = async (tagId, notes = null) => {
    const { data, error } = await supabase
      .from('item_tags')
      .upsert({ item_id: itemId, tag_id: tagId, notes }, { onConflict: 'item_id,tag_id' })
      .select('*, tags(*)')
      .single()

    if (error) throw error
    await fetch()
    return data
  }

  const removeTag = async (tagId) => {
    const { error } = await supabase
      .from('item_tags')
      .delete()
      .eq('item_id', itemId)
      .eq('tag_id', tagId)

    if (error) throw error
    setItemTags((prev) => prev.filter((it) => it.tag_id !== tagId))
  }

  return { itemTags, loading, refetch: fetch, assignTag, removeTag }
}
