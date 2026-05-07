import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useRefreshOnFocus } from './useRefreshOnFocus'
import { emit, on } from '../lib/events'
import * as grocery from '../lib/grocery'

export function useTags() {
  const { profile } = useAuth()
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const ctx = profile?.household_id ? { householdId: profile.household_id, userId: profile.id } : null

  const fetch = useCallback(async () => {
    if (!ctx) {
      setLoading(false)
      return
    }
    console.log('[useTags] Fetching...')
    setLoading(true)
    setError(null)
    try {
      const data = await grocery.fetchTags(supabase, ctx)
      console.log(`[useTags] Loaded ${data.length} tags`)
      setTags(data)
    } catch (e) {
      console.error('[useTags] Failed:', e)
      setError(e.message || 'Failed to load tags')
    }
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.household_id, profile?.id])

  useEffect(() => {
    fetch()
  }, [fetch])

  useRefreshOnFocus(fetch)

  const createTag = async (tag) => {
    const data = await grocery.createTag(supabase, ctx, tag)
    setTags((prev) => [...prev, data])
    return data
  }

  const updateTag = async (id, updates) => {
    const data = await grocery.updateTag(supabase, ctx, { tagId: id, updates })
    setTags((prev) => prev.map((t) => (t.id === id ? data : t)))
    return data
  }

  const getTagUsageCount = async (tagId) => grocery.getTagItemCount(supabase, ctx, { tagId })

  const deleteTag = async (id) => {
    await grocery.deleteTag(supabase, ctx, { tagId: id })
    setTags((prev) => prev.filter((t) => t.id !== id))
    emit('tags-changed')
  }

  const recipeTags = tags.filter((t) => t.type === 'recipe')
  const storeTags = tags.filter((t) => t.type === 'store')
  const customTags = tags.filter((t) => t.type === 'custom')

  return { tags, recipeTags, storeTags, customTags, loading, error, refetch: fetch, createTag, updateTag, deleteTag, getTagUsageCount }
}

export function useItemTags(itemId) {
  const [itemTags, setItemTags] = useState([])
  const [loading, setLoading] = useState(true)

  // No household ctx needed: item_tags rows are scoped through items.
  const fetch = useCallback(async () => {
    if (!itemId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await grocery.fetchItemTags(supabase, null, { itemId })
      setItemTags(data)
    } catch (e) {
      console.error('Failed to fetch item tags:', e)
    }
    setLoading(false)
  }, [itemId])

  useEffect(() => {
    fetch()
  }, [fetch])

  useEffect(() => {
    return on('tags-changed', fetch)
  }, [fetch])

  const assignTag = async (tagId, notes = null) => {
    const data = await grocery.assignTagToItem(supabase, null, { itemId, tagId, notes })
    await fetch()
    return data
  }

  const removeTag = async (tagId) => {
    await grocery.removeTagFromItem(supabase, null, { itemId, tagId })
    setItemTags((prev) => prev.filter((it) => it.tag_id !== tagId))
  }

  return { itemTags, loading, refetch: fetch, assignTag, removeTag }
}
