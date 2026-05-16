// Pure DB-facing business logic for the grocery domain.
// All functions take a Supabase client + a context { householdId, userId } so
// the same code path can be invoked from the React app (anon key + RLS) and
// from the MCP server (service role + manual household filtering).
//
// No React, no local state, no event emission — those concerns live in the
// hooks that wrap these functions.

import { withTimeout } from './withTimeout.js'

// ============================================================================
// Items + search
// ============================================================================

export async function fetchItems(supabase, ctx, { categoryId } = {}) {
  let q = supabase
    .from('items')
    .select('*, categories(name, name_he, emoji)')
    .eq('household_id', ctx.householdId)
    .order('created_at', { ascending: false })
  if (categoryId) q = q.eq('category_id', categoryId)
  const { data, error } = await withTimeout(q)
  if (error) throw error
  return data || []
}

export async function searchItems(supabase, ctx, { query, limit = 5 }) {
  const trimmed = (query || '').trim()
  if (!trimmed) return []
  const pattern = `%${trimmed.replace(/[%_]/g, (c) => `\\${c}`)}%`
  const { data, error } = await supabase
    .from('items')
    .select('*, categories(id, name, name_he, emoji)')
    .eq('household_id', ctx.householdId)
    .or(`name.ilike.${pattern},name_he.ilike.${pattern}`)
    .limit(Math.min(limit, 10))
  if (error) throw error
  return data || []
}

// Given a set of item ids, return maps of { item_id → stock row } and
// { item_id → on_lists[] } for the household.
export async function getItemsContext(supabase, ctx, { itemIds }) {
  if (!itemIds.length) return { stockByItem: new Map(), listsByItem: new Map() }

  const [stockRes, listRes] = await Promise.all([
    supabase
      .from('stock')
      .select('item_id, quantity, unit, low_threshold')
      .eq('household_id', ctx.householdId)
      .in('item_id', itemIds),
    supabase
      .from('list_items')
      .select('item_id, quantity, unit, is_bought, grocery_lists!inner(id, name, status, household_id)')
      .eq('grocery_lists.household_id', ctx.householdId)
      .in('item_id', itemIds),
  ])
  if (stockRes.error) throw stockRes.error
  if (listRes.error) throw listRes.error

  const stockByItem = new Map()
  ;(stockRes.data || []).forEach((s) => stockByItem.set(s.item_id, s))

  const listsByItem = new Map()
  ;(listRes.data || []).forEach((li) => {
    const arr = listsByItem.get(li.item_id) || []
    arr.push({
      list_id: li.grocery_lists.id,
      list_name: li.grocery_lists.name,
      status: li.grocery_lists.status,
      quantity: li.quantity,
      unit: li.unit,
      is_bought: li.is_bought,
    })
    listsByItem.set(li.item_id, arr)
  })

  return { stockByItem, listsByItem }
}

export async function createItem(supabase, ctx, { item }) {
  const { data, error } = await supabase
    .from('items')
    .insert({ ...item, household_id: ctx.householdId, created_by: ctx.userId })
    .select('*, categories(name, name_he, emoji)')
    .single()
  if (error) throw error
  return data
}

export async function updateItem(supabase, ctx, { itemId, updates }) {
  const { data, error } = await supabase
    .from('items')
    .update(updates)
    .eq('id', itemId)
    .select('*, categories(name, name_he, emoji)')
    .single()
  if (error) throw error
  return data
}

export async function deleteItem(supabase, ctx, { itemId }) {
  const { error } = await supabase.from('items').delete().eq('id', itemId)
  if (error) throw error
}

// ============================================================================
// Categories
// ============================================================================

export async function fetchCategories(supabase, ctx) {
  const { data, error } = await withTimeout(
    supabase
      .from('categories')
      .select('*')
      .eq('household_id', ctx.householdId)
      .order('sort_order', { ascending: true })
  )
  if (error) throw error
  return data || []
}

export async function searchCategories(supabase, ctx, { query, limit = 5 }) {
  const trimmed = (query || '').trim()
  if (!trimmed) return []
  const pattern = `%${trimmed.replace(/[%_]/g, (c) => `\\${c}`)}%`
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, name_he, emoji')
    .eq('household_id', ctx.householdId)
    .or(`name.ilike.${pattern},name_he.ilike.${pattern}`)
    .limit(Math.min(limit, 10))
  if (error) throw error
  return data || []
}

// ============================================================================
// Stock
// ============================================================================

const STOCK_SELECT_FULL =
  '*, items(id, name, name_he, emoji, photo_url, default_unit, auto_track_stock, category_id, categories(id, name, name_he, emoji, sort_order))'

export async function fetchStock(supabase, ctx) {
  const { data, error } = await withTimeout(
    supabase
      .from('stock')
      .select(STOCK_SELECT_FULL)
      .eq('household_id', ctx.householdId)
      .order('updated_at', { ascending: false })
  )
  if (error) throw error
  return data || []
}

export async function getStockByItemId(supabase, ctx, { itemId }) {
  const { data, error } = await supabase
    .from('stock')
    .select('*')
    .eq('household_id', ctx.householdId)
    .eq('item_id', itemId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function upsertStock(supabase, ctx, { itemId, quantity, unit, lowThreshold = 1 }) {
  const { data, error } = await supabase
    .from('stock')
    .upsert(
      {
        household_id: ctx.householdId,
        item_id: itemId,
        quantity,
        unit,
        low_threshold: lowThreshold,
        updated_by: ctx.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'household_id,item_id' }
    )
    .select(STOCK_SELECT_FULL)
    .single()
  if (error) throw error
  return data
}

export async function updateStockQuantity(supabase, ctx, { stockId, quantity }) {
  const safe = Math.max(0, quantity)
  const { error } = await supabase
    .from('stock')
    .update({
      quantity: safe,
      updated_by: ctx.userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', stockId)
  if (error) throw error
  return safe
}

export async function updateStockThreshold(supabase, ctx, { stockId, lowThreshold }) {
  const safe = Math.max(0, lowThreshold)
  const { error } = await supabase
    .from('stock')
    .update({ low_threshold: safe })
    .eq('id', stockId)
  if (error) throw error
  return safe
}

export async function updateStockFields(supabase, ctx, { stockId, quantity, unit, lowThreshold }) {
  const updates = {
    updated_by: ctx.userId,
    updated_at: new Date().toISOString(),
  }
  if (quantity !== undefined) updates.quantity = Math.max(0, quantity)
  if (unit !== undefined) updates.unit = unit
  if (lowThreshold !== undefined) updates.low_threshold = Math.max(0, lowThreshold)
  const { error } = await supabase.from('stock').update(updates).eq('id', stockId)
  if (error) throw error
  return updates
}

export async function deleteStock(supabase, ctx, { stockId }) {
  const { error } = await supabase.from('stock').delete().eq('id', stockId)
  if (error) throw error
}

export async function deleteStockByItemId(supabase, ctx, { itemId }) {
  const { error } = await supabase
    .from('stock')
    .delete()
    .eq('household_id', ctx.householdId)
    .eq('item_id', itemId)
  if (error) throw error
}

// Apply a relative change to stock. deltaQty positive adds, negative
// subtracts. Final quantity is clamped at 0. Creates the row if missing.
// Returns { quantity_before, quantity_after, action }.
export async function adjustStock(supabase, ctx, { itemId, deltaQty, unit }) {
  const existing = await getStockByItemId(supabase, ctx, { itemId })

  if (existing) {
    const newQty = Math.max(0, existing.quantity + deltaQty)
    const action = newQty === 0 && existing.quantity + deltaQty < 0 ? 'clamped_at_zero' : 'updated'
    const { error } = await supabase
      .from('stock')
      .update({
        quantity: newQty,
        unit: unit ?? existing.unit,
        updated_by: ctx.userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
    if (error) throw error
    return { quantity_before: existing.quantity, quantity_after: newQty, action }
  }

  const startQty = Math.max(0, deltaQty)
  const { error } = await supabase
    .from('stock')
    .upsert(
      {
        household_id: ctx.householdId,
        item_id: itemId,
        quantity: startQty,
        unit: unit || 'pcs',
        low_threshold: 1,
        updated_by: ctx.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'household_id,item_id' }
    )
  if (error) throw error
  return { quantity_before: 0, quantity_after: startQty, action: 'created' }
}

// ============================================================================
// Grocery lists
// ============================================================================

const LIST_SELECT_FULL =
  '*, list_items(id, item_id, quantity, unit, is_bought, notes, stock_updated, items(name, name_he, emoji, default_unit, auto_track_stock, category_id, categories(name, name_he, emoji)))'

const LIST_SELECT_FALLBACK =
  '*, list_items(id, item_id, quantity, unit, is_bought, items(name, name_he, emoji, default_unit, auto_track_stock, category_id, categories(name, name_he, emoji)))'

export async function fetchLists(supabase, ctx, { status } = {}) {
  let q = supabase
    .from('grocery_lists')
    .select(LIST_SELECT_FULL)
    .eq('household_id', ctx.householdId)
    .order('created_at', { ascending: false })
  if (status && status !== 'all') {
    if (status === 'open') q = q.in('status', ['draft', 'active'])
    else q = q.eq('status', status)
  }
  let { data, error } = await withTimeout(q)
  if (error) {
    let qf = supabase
      .from('grocery_lists')
      .select(LIST_SELECT_FALLBACK)
      .eq('household_id', ctx.householdId)
      .order('created_at', { ascending: false })
    if (status && status !== 'all') {
      if (status === 'open') qf = qf.in('status', ['draft', 'active'])
      else qf = qf.eq('status', status)
    }
    const fallback = await withTimeout(qf)
    data = fallback.data
    error = fallback.error
  }
  if (error) throw error
  return data || []
}

export async function searchLists(supabase, ctx, { query, statusFilter = 'open' }) {
  const trimmed = (query || '').trim()
  if (!trimmed) return []
  const pattern = `%${trimmed.replace(/[%_]/g, (c) => `\\${c}`)}%`
  let q = supabase
    .from('grocery_lists')
    .select('id, name, status, created_at')
    .eq('household_id', ctx.householdId)
    .ilike('name', pattern)
    .order('created_at', { ascending: false })
    .limit(5)
  if (statusFilter === 'open') q = q.in('status', ['draft', 'active'])
  else if (statusFilter && statusFilter !== 'all') q = q.eq('status', statusFilter)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function createList(supabase, ctx, { name, items = [] }) {
  const { data: list, error: listErr } = await supabase
    .from('grocery_lists')
    .insert({
      household_id: ctx.householdId,
      name,
      status: 'draft',
      created_by: ctx.userId,
    })
    .select()
    .single()
  if (listErr) throw listErr

  if (items.length > 0) {
    const rows = items.map((item) => ({
      list_id: list.id,
      item_id: item.item_id,
      quantity: item.quantity,
      unit: item.unit,
      ...(item.notes ? { notes: item.notes } : {}),
    }))
    const { error: itemsErr } = await supabase.from('list_items').insert(rows)
    if (itemsErr) throw itemsErr
  }

  return list
}

export async function updateListStatus(supabase, ctx, { listId, status }) {
  const updates = { status }
  if (status === 'completed') updates.completed_at = new Date().toISOString()
  const { error } = await supabase
    .from('grocery_lists')
    .update(updates)
    .eq('id', listId)
  if (error) throw error
}

export async function updateListName(supabase, ctx, { listId, name }) {
  const { error } = await supabase
    .from('grocery_lists')
    .update({ name })
    .eq('id', listId)
  if (error) throw error
}

export async function deleteList(supabase, ctx, { listId }) {
  const { error } = await supabase.from('grocery_lists').delete().eq('id', listId)
  if (error) throw error
}

export async function duplicateList(supabase, ctx, { list }) {
  const newName = `${list.name} (copy)`
  const items = (list.list_items || []).map((li) => ({
    item_id: li.item_id,
    quantity: li.quantity,
    unit: li.unit,
  }))
  return createList(supabase, ctx, { name: newName, items })
}

export async function completeAndCarryOver(supabase, ctx, { list, carryOverName }) {
  const unboughtItems = (list.list_items || [])
    .filter((li) => !li.is_bought)
    .map((li) => ({
      item_id: li.item_id,
      quantity: li.quantity,
      unit: li.unit,
      ...(li.notes ? { notes: li.notes } : {}),
    }))

  await updateListStatus(supabase, ctx, { listId: list.id, status: 'completed' })

  if (unboughtItems.length > 0) {
    return createList(supabase, ctx, { name: carryOverName, items: unboughtItems })
  }
  return null
}

// ============================================================================
// List items
// ============================================================================

export async function addItemToList(supabase, ctx, { listId, itemId, quantity, unit, notes }) {
  const { data, error } = await supabase
    .from('list_items')
    .insert({
      list_id: listId,
      item_id: itemId,
      quantity,
      unit,
      ...(notes ? { notes } : {}),
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function removeItemFromList(supabase, ctx, { listItemId }) {
  const { error } = await supabase.from('list_items').delete().eq('id', listItemId)
  if (error) throw error
}

export async function updateListItemFields(supabase, ctx, { listItemId, updates }) {
  const { error } = await supabase
    .from('list_items')
    .update(updates)
    .eq('id', listItemId)
  if (error) throw error
}

export async function setListItemBought(supabase, ctx, { listItemId, isBought, boughtQuantity = null }) {
  const updates = {
    is_bought: isBought,
    bought_by: isBought ? ctx.userId : null,
    bought_at: isBought ? new Date().toISOString() : null,
  }
  if (isBought && boughtQuantity !== null) updates.quantity = boughtQuantity
  const { error } = await supabase
    .from('list_items')
    .update(updates)
    .eq('id', listItemId)
  if (error) throw error
}

// Find an unbought list_item across the household's open lists for a given
// item — used by mark/edit tools when list_query isn't given. Returns the
// most recent open list's row, or null.
export async function findOpenListItemForItem(supabase, ctx, { itemId, listId = null }) {
  let q = supabase
    .from('list_items')
    .select('id, list_id, item_id, quantity, unit, is_bought, grocery_lists!inner(id, name, status, household_id, created_at)')
    .eq('item_id', itemId)
    .eq('grocery_lists.household_id', ctx.householdId)
    .in('grocery_lists.status', ['draft', 'active'])
    .order('created_at', { foreignTable: 'grocery_lists', ascending: false })
    .limit(1)
  if (listId) q = q.eq('list_id', listId)
  const { data, error } = await q
  if (error) throw error
  return (data && data[0]) || null
}

// ============================================================================
// Tags
// ============================================================================

export async function fetchTags(supabase, ctx, { type } = {}) {
  let q = supabase
    .from('tags')
    .select('*')
    .eq('household_id', ctx.householdId)
    .order('type', { ascending: true })
    .order('name', { ascending: true })
  if (type && type !== 'all') q = q.eq('type', type)
  const { data, error } = await withTimeout(q)
  if (error) throw error
  return data || []
}

export async function fetchTagsWithCounts(supabase, ctx, { type } = {}) {
  const tags = await fetchTags(supabase, ctx, { type })
  if (tags.length === 0) return []
  const { data: counts, error } = await supabase
    .from('item_tags')
    .select('tag_id')
    .in(
      'tag_id',
      tags.map((t) => t.id)
    )
  if (error) throw error
  const tally = new Map()
  ;(counts || []).forEach((row) => tally.set(row.tag_id, (tally.get(row.tag_id) || 0) + 1))
  return tags.map((t) => ({ ...t, item_count: tally.get(t.id) || 0 }))
}

export async function searchTags(supabase, ctx, { name, type }) {
  const pattern = `%${name.replace(/[%_]/g, (c) => `\\${c}`)}%`
  let q = supabase
    .from('tags')
    .select('*')
    .eq('household_id', ctx.householdId)
    .ilike('name', pattern)
  if (type && type !== 'all') q = q.eq('type', type)
  const { data, error } = await q.limit(5)
  if (error) throw error
  return data || []
}

export async function createTag(supabase, ctx, { name, type, color = '#3B82F6' }) {
  const { data, error } = await supabase
    .from('tags')
    .insert({ household_id: ctx.householdId, name, type, color })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateTag(supabase, ctx, { tagId, updates }) {
  const { data, error } = await supabase
    .from('tags')
    .update(updates)
    .eq('id', tagId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteTag(supabase, ctx, { tagId }) {
  const { error } = await supabase.from('tags').delete().eq('id', tagId)
  if (error) throw error
}

export async function getTagItemCount(supabase, ctx, { tagId }) {
  const { count, error } = await supabase
    .from('item_tags')
    .select('*', { count: 'exact', head: true })
    .eq('tag_id', tagId)
  if (error) return 0
  return count || 0
}

export async function assignTagToItem(supabase, ctx, { itemId, tagId, notes = null }) {
  const { data, error } = await supabase
    .from('item_tags')
    .upsert({ item_id: itemId, tag_id: tagId, notes }, { onConflict: 'item_id,tag_id' })
    .select('*, tags(*)')
    .single()
  if (error) throw error
  return data
}

export async function removeTagFromItem(supabase, ctx, { itemId, tagId }) {
  const { error } = await supabase
    .from('item_tags')
    .delete()
    .eq('item_id', itemId)
    .eq('tag_id', tagId)
  if (error) throw error
}

export async function fetchItemTags(supabase, ctx, { itemId }) {
  const { data, error } = await supabase
    .from('item_tags')
    .select('*, tags(*)')
    .eq('item_id', itemId)
  if (error) throw error
  return data || []
}

// ============================================================================
// Price history
// ============================================================================

export async function fetchPriceHistory(supabase, ctx, { itemId }) {
  const { data, error } = await supabase
    .from('price_history')
    .select('id, item_id, price, currency, store, barcode, description, purchased_at, logged_by, created_at')
    .eq('household_id', ctx.householdId)
    .eq('item_id', itemId)
    .order('purchased_at', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

// Insert a price entry. If `store` is given and no `tags` row of type='store'
// with that name exists for the household, we create one so it shows up in
// the store autocomplete next time.
export async function addPriceEntry(
  supabase,
  ctx,
  { itemId, price, store, purchasedAt, barcode, description, currency = 'ILS' }
) {
  const trimmedStore = (store || '').trim()
  if (trimmedStore) await ensureStoreTag(supabase, ctx, { name: trimmedStore })

  const row = {
    household_id: ctx.householdId,
    item_id: itemId,
    price,
    currency,
    store: trimmedStore || null,
    barcode: (barcode || '').trim() || null,
    description: (description || '').trim() || null,
    purchased_at: purchasedAt || new Date().toISOString().slice(0, 10),
    logged_by: ctx.userId,
  }
  const { data, error } = await supabase
    .from('price_history')
    .insert(row)
    .select('id, item_id, price, currency, store, barcode, description, purchased_at, logged_by, created_at')
    .single()
  if (error) throw error
  return data
}

export async function updatePriceEntry(supabase, ctx, { entryId, updates }) {
  const clean = {}
  if (updates.price !== undefined) clean.price = updates.price
  if (updates.store !== undefined) {
    const trimmed = (updates.store || '').trim()
    if (trimmed) await ensureStoreTag(supabase, ctx, { name: trimmed })
    clean.store = trimmed || null
  }
  if (updates.barcode !== undefined) clean.barcode = (updates.barcode || '').trim() || null
  if (updates.description !== undefined) clean.description = (updates.description || '').trim() || null
  if (updates.purchased_at !== undefined) clean.purchased_at = updates.purchased_at

  const { data, error } = await supabase
    .from('price_history')
    .update(clean)
    .eq('id', entryId)
    .eq('household_id', ctx.householdId)
    .select('id, item_id, price, currency, store, barcode, description, purchased_at, logged_by, created_at')
    .single()
  if (error) throw error
  return data
}

export async function deletePriceEntry(supabase, ctx, { entryId }) {
  const { error } = await supabase
    .from('price_history')
    .delete()
    .eq('id', entryId)
    .eq('household_id', ctx.householdId)
  if (error) throw error
}

// For a set of items, return the cheapest logged price per item as
// Map<item_id, { price, currency, store, purchased_at }>. Items with no
// price history are absent from the map.
export async function fetchCheapestPrices(supabase, ctx, { itemIds }) {
  const map = new Map()
  if (!itemIds || itemIds.length === 0) return map
  const { data, error } = await supabase
    .from('price_history')
    .select('item_id, price, currency, store, purchased_at')
    .eq('household_id', ctx.householdId)
    .in('item_id', itemIds)
  if (error) throw error
  for (const row of data || []) {
    const cur = map.get(row.item_id)
    if (!cur || Number(row.price) < Number(cur.price)) map.set(row.item_id, row)
  }
  return map
}

// Get-or-create a store tag for the household, matching case-insensitively
// on name. Returns the tag row.
export async function ensureStoreTag(supabase, ctx, { name }) {
  const trimmed = (name || '').trim()
  if (!trimmed) return null
  const { data: existing, error: findErr } = await supabase
    .from('tags')
    .select('*')
    .eq('household_id', ctx.householdId)
    .eq('type', 'store')
    .ilike('name', trimmed)
    .maybeSingle()
  if (findErr) throw findErr
  if (existing) return existing
  return createTag(supabase, ctx, { name: trimmed, type: 'store' })
}

// ============================================================================
// Need-to-buy / status views
// ============================================================================

export async function fetchNeedToBuy(supabase, ctx) {
  const [stockRes, listRes] = await Promise.all([
    supabase
      .from('stock')
      .select('item_id, quantity, low_threshold, items(id, name, name_he, emoji, default_unit)')
      .eq('household_id', ctx.householdId),
    supabase
      .from('list_items')
      .select(
        'item_id, quantity, unit, items(id, name, name_he, emoji, default_unit), grocery_lists!inner(id, name, status, household_id)'
      )
      .eq('is_bought', false)
      .in('grocery_lists.status', ['draft', 'active'])
      .eq('grocery_lists.household_id', ctx.householdId)
      .not('items', 'is', null),
  ])
  if (stockRes.error) throw stockRes.error
  if (listRes.error) throw listRes.error

  const lowMap = new Map()
  ;(stockRes.data || [])
    .filter((s) => s.quantity <= s.low_threshold)
    .forEach((s) => {
      if (!s.items) return
      lowMap.set(s.item_id, {
        item: s.items,
        stock: { quantity: s.quantity, low_threshold: s.low_threshold },
      })
    })

  const onListMap = new Map()
  ;(listRes.data || []).forEach((li) => {
    if (!li.items) return
    const existing = onListMap.get(li.item_id) || { item: li.items, on_lists: [] }
    existing.on_lists.push({ list_name: li.grocery_lists.name, quantity: li.quantity })
    onListMap.set(li.item_id, existing)
  })

  const ids = new Set([...lowMap.keys(), ...onListMap.keys()])
  const entries = []
  for (const id of ids) {
    const onList = onListMap.get(id)
    const low = lowMap.get(id)
    let reason
    if (onList && low) reason = 'both'
    else if (onList) reason = 'on_list'
    else reason = 'low_stock'
    entries.push({
      item: onList?.item || low?.item,
      reason,
      on_lists: onList?.on_lists || [],
      stock: low?.stock || null,
    })
  }

  return {
    entries,
    stock_low_count: lowMap.size,
    list_unbought_count: onListMap.size,
  }
}
