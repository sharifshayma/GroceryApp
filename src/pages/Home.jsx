import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useCategories } from '../hooks/useCategories'
import { useItems } from '../hooks/useItems'
import { useTags } from '../hooks/useTags'
import { useLists } from '../hooks/useLists'
import { getCategoryName } from '../lib/categoryName'
import HorizontalItemRow from '../components/HorizontalItemRow'
import AddToListModal from '../components/AddToListModal'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorBanner from '../components/ErrorBanner'
import { IconSearch, IconPlus, IconEdit, IllustrationNoResults, IllustrationNoItems } from '../components/Icons'

export default function Home() {
  const { t, i18n } = useTranslation()
  const { profile } = useAuth()
  const { categories, loading, error: categoriesError, refetch: refetchCategories } = useCategories()
  const { items: allItems } = useItems()
  const { tags } = useTags()
  const { lists, createList, addItemToList } = useLists()
  const [search, setSearch] = useState('')
  const [activeTag, setActiveTag] = useState(null)
  const [taggedItemData, setTaggedItemData] = useState(null) // Map<item_id, notes>
  const [frequentItems, setFrequentItems] = useState([])
  const [needToBuy, setNeedToBuy] = useState([])
  const [addToListItem, setAddToListItem] = useState(null)

  // Multi-select state
  const [selectMode, setSelectMode] = useState(false)
  const [selectedItems, setSelectedItems] = useState(new Map()) // Map<item_id, item>
  const [showListPicker, setShowListPicker] = useState(false)

  // Track which items are in active/draft lists
  const itemsInList = useMemo(() => {
    const set = new Set()
    lists
      .filter((l) => l.status === 'draft' || l.status === 'active')
      .forEach((l) => {
        ;(l.list_items || []).forEach((li) => set.add(li.item_id))
      })
    return set
  }, [lists])

  // Fetch frequently bought items
  useEffect(() => {
    if (!profile?.household_id) return

    async function fetchFrequent() {
      const { data } = await supabase
        .from('list_items')
        .select('item_id, items(id, name, name_he, emoji, default_unit), grocery_lists!inner(household_id)')
        .eq('is_bought', true)
        .eq('grocery_lists.household_id', profile.household_id)
        .not('items', 'is', null)

      if (data) {
        const counts = {}
        data.forEach((li) => {
          if (!li.items) return
          const id = li.items.id
          if (!counts[id]) counts[id] = { ...li.items, count: 0 }
          counts[id].count++
        })
        const sorted = Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 15)
        setFrequentItems(sorted)
      }
    }

    async function fetchNeedToBuy() {
      const unique = {}

      const { data: unbought } = await supabase
        .from('list_items')
        .select('item_id, items(id, name, name_he, emoji, default_unit), grocery_lists!inner(status, household_id)')
        .eq('is_bought', false)
        .eq('grocery_lists.status', 'completed')
        .eq('grocery_lists.household_id', profile.household_id)
        .not('items', 'is', null)

      if (unbought) {
        unbought.forEach((li) => {
          if (li.items) unique[li.items.id] = li.items
        })
      }

      const { data: lowStock } = await supabase
        .from('stock')
        .select('item_id, quantity, low_threshold, items(id, name, name_he, emoji, default_unit)')
        .eq('household_id', profile.household_id)

      if (lowStock) {
        lowStock
          .filter((s) => s.quantity <= s.low_threshold)
          .forEach((s) => {
            if (s.items) unique[s.items.id] = s.items
          })
      }

      setNeedToBuy(Object.values(unique))
    }

    fetchFrequent()
    fetchNeedToBuy()
  }, [profile?.household_id])

  // Fetch items + notes for active tag filter
  useEffect(() => {
    if (!activeTag) { setTaggedItemData(null); return }
    supabase
      .from('item_tags')
      .select('item_id, notes')
      .eq('tag_id', activeTag)
      .then(({ data }) => {
        if (data) {
          const map = new Map()
          data.forEach((d) => map.set(d.item_id, d.notes))
          setTaggedItemData(map)
        } else {
          setTaggedItemData(new Map())
        }
      })
  }, [activeTag])

  // Clear select mode when leaving tag/search
  useEffect(() => {
    setSelectMode(false)
    setSelectedItems(new Map())
  }, [activeTag, search])

  if (loading) return <LoadingSpinner fullScreen={false} />
  if (categoriesError) return <ErrorBanner error={categoriesError} onRetry={refetchCategories} />

  // Search filtering
  const searchResults = search.trim()
    ? allItems.filter((item) => {
        const q = search.toLowerCase()
        return (
          item.name?.toLowerCase().includes(q) ||
          item.name_he?.toLowerCase().includes(q) ||
          item.notes?.toLowerCase().includes(q)
        )
      })
    : null

  const handleAddToList = async (listId, item) => {
    await addItemToList(listId, item)
  }

  const handleCreateAndAdd = async (item) => {
    const today = new Date().toLocaleDateString(i18n.language === 'he' ? 'he-IL' : 'en-US', {
      month: 'short',
      day: 'numeric',
    })
    const name = `${t('nav.lists')} — ${today}`
    const list = await createList(name, [item])
    return list
  }

  const toggleSelect = (item) => {
    setSelectedItems((prev) => {
      const next = new Map(prev)
      if (next.has(item.id)) next.delete(item.id)
      else next.set(item.id, item)
      return next
    })
  }

  const handleItemTap = (item) => {
    if (selectMode) {
      toggleSelect(item)
    } else {
      setAddToListItem(item)
    }
  }

  // Bulk add all selected items to a list, skipping duplicates
  const handleBulkAdd = async (listId) => {
    const allSelected = [...selectedItems.values()].map((item) => ({
      item_id: item.id,
      quantity: 1,
      unit: item.default_unit || 'pcs',
      ...(taggedItemData?.get(item.id) ? { notes: taggedItemData.get(item.id) } : {}),
    }))

    // Filter out items already in the target list
    const targetList = listId ? lists.find((l) => l.id === listId) : null
    const existingItemIds = new Set((targetList?.list_items || []).map((li) => li.item_id))
    const items = allSelected.filter((i) => !existingItemIds.has(i.item_id))

    if (items.length === 0) {
      setSelectedItems(new Map())
      setSelectMode(false)
      return
    }

    const openLists = lists.filter((l) => l.status === 'draft' || l.status === 'active')

    if (listId) {
      // Add to specific list
      for (const item of items) {
        await addItemToList(listId, item)
      }
    } else if (openLists.length === 0) {
      // Create new list
      const today = new Date().toLocaleDateString(i18n.language === 'he' ? 'he-IL' : 'en-US', { month: 'short', day: 'numeric' })
      await createList(`${t('nav.lists')} — ${today}`, items)
    } else if (openLists.length === 1) {
      for (const item of items) {
        await addItemToList(openLists[0].id, item)
      }
    } else {
      // Multiple lists — show picker
      setShowListPicker(true)
      return // don't clear selection yet
    }

    setSelectedItems(new Map())
    setSelectMode(false)
  }

  // Render an item card (used in tag filter + search results)
  const renderItemCard = (item, tagNotes) => {
    const isSelected = selectedItems.has(item.id)
    const inList = itemsInList.has(item.id)

    return (
      <button
        key={item.id}
        onClick={() => !inList && handleItemTap(item)}
        disabled={inList && !selectMode}
        className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-start ${
          inList && !selectMode
            ? 'bg-neutral/10 border-neutral/30 opacity-60'
            : isSelected
              ? 'bg-primary/10 border-primary'
              : 'bg-surface border-neutral/50 hover:border-primary/30'
        }`}
      >
        {selectMode && (
          <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
            isSelected ? 'bg-primary border-primary text-white' : 'border-neutral'
          }`}>
            {isSelected && <span className="text-xs">✓</span>}
          </span>
        )}
        <span className="text-2xl flex-shrink-0">{item.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className={`font-semibold truncate ${inList && !selectMode ? 'line-through' : ''}`}>{item.name}</p>
          {item.categories && (
            <p className="text-xs text-text-secondary">
              {item.categories.emoji} {getCategoryName(item.categories)}
            </p>
          )}
          {tagNotes && (
            <p className="text-xs text-primary italic mt-0.5">{tagNotes}</p>
          )}
        </div>
        {inList && !selectMode ? (
          <span className="w-6 h-6 rounded-full bg-green text-white flex items-center justify-center flex-shrink-0 text-xs">✓</span>
        ) : !selectMode ? (
          <IconPlus className="w-5 h-5 text-text-secondary flex-shrink-0" />
        ) : null}
      </button>
    )
  }

  const openLists = lists.filter((l) => l.status === 'draft' || l.status === 'active')

  return (
    <div className="px-4 pt-6 pb-8 max-w-lg mx-auto animate-fade-in">
      {/* Search bar */}
      <div className="relative mb-6">
        <IconSearch className="absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('items.search')}
          className="w-full ps-10 pe-4 py-3 rounded-xl border border-neutral bg-surface text-text placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute end-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-neutral/50 flex items-center justify-center text-text-secondary hover:text-text"
          >
            ×
          </button>
        )}
      </div>

      {/* Tag filter chips */}
      {tags.length > 0 && !search && (
        <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar">
          {activeTag && (
            <button
              onClick={() => setActiveTag(null)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold bg-neutral/30 text-text-secondary"
            >
              ✕ {i18n.language === 'he' ? 'הצג הכל' : 'Clear'}
            </button>
          )}
          {tags.map((tag) => (
            <button
              key={tag.id}
              onClick={() => setActiveTag(activeTag === tag.id ? null : tag.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                activeTag === tag.id
                  ? 'text-white'
                  : 'bg-surface border border-neutral text-text-secondary'
              }`}
              style={activeTag === tag.id ? { backgroundColor: tag.color } : {}}
            >
              {tag.type === 'recipe' ? '🍽️' : tag.type === 'store' ? '🏪' : '🏷️'} {tag.name}
            </button>
          ))}
        </div>
      )}

      {/* Tag filter results */}
      {activeTag && taggedItemData && !search && (
        <div className="mb-6">
          {(() => {
            const tag = tags.find((t) => t.id === activeTag)
            const filtered = allItems.filter((i) => taggedItemData.has(i.id))
            return (
              <>
                {tag?.description && (
                  <p className="text-sm text-text-secondary mb-3 bg-surface rounded-xl p-3 border border-neutral/30">
                    {tag.description}
                  </p>
                )}

                {/* Tag toolbar: Select mode + Edit tag */}
                {filtered.length > 0 && (
                  <div className="flex items-center justify-between mb-3 py-2 px-3 rounded-xl bg-surface border border-neutral/30">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (selectMode) {
                            setSelectMode(false)
                            setSelectedItems(new Map())
                          } else {
                            setSelectMode(true)
                          }
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                          selectMode ? 'bg-primary text-white' : 'bg-white border border-neutral/50 text-text-secondary'
                        }`}
                      >
                        {selectMode
                          ? (i18n.language === 'he' ? 'ביטול' : 'Cancel')
                          : (i18n.language === 'he' ? 'בחירה מרובה' : 'Select')}
                      </button>
                      {selectMode && (
                        <button
                          onClick={() => {
                            if (selectedItems.size === filtered.length) {
                              setSelectedItems(new Map())
                            } else {
                              const all = new Map()
                              filtered.forEach((i) => all.set(i.id, i))
                              setSelectedItems(all)
                            }
                          }}
                          className="px-3 py-1.5 rounded-full text-xs font-semibold text-primary"
                        >
                          {selectedItems.size === filtered.length
                            ? (i18n.language === 'he' ? 'בטל הכל' : 'Deselect all')
                            : (i18n.language === 'he' ? 'בחר הכל' : 'Select all')}
                        </button>
                      )}
                    </div>
                    {!selectMode && (
                      <Link
                        to="/manage-tags"
                        className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-white border border-neutral/50 text-text-secondary hover:text-primary transition-colors"
                      >
                        <IconEdit className="w-3.5 h-3.5" />
                        {i18n.language === 'he' ? 'ערוך תגיות' : 'Edit tags'}
                      </Link>
                    )}
                  </div>
                )}

                {filtered.length === 0 ? (
                  <p className="text-center text-text-secondary py-6">
                    {i18n.language === 'he' ? 'אין פריטים עם תגית זו' : 'No items with this tag'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {filtered.map((item) => renderItemCard(item, taggedItemData.get(item.id)))}
                  </div>
                )}
              </>
            )
          })()}
        </div>
      )}

      {/* Search results */}
      {searchResults ? (
        <div className="space-y-2">
          {searchResults.length === 0 ? (
            <div className="text-center py-8">
              <div className="flex justify-center mb-3"><IllustrationNoResults /></div>
              <p className="text-text-secondary">{t('empty.noItems')}</p>
            </div>
          ) : (
            searchResults.map((item) => renderItemCard(item, null))
          )}
        </div>
      ) : (
        <>
          {/* Need to Buy */}
          <HorizontalItemRow
            title={i18n.language === 'he' ? 'צריך לקנות' : 'Need to Buy'}
            icon="🔴"
            items={needToBuy}
            accentClass="border-t-danger"
            onItemClick={(item) => setAddToListItem(item)}
            itemsInList={itemsInList}
          />

          {/* Frequently Bought */}
          <HorizontalItemRow
            title={i18n.language === 'he' ? 'קונים הרבה' : 'Frequently Bought'}
            icon="⭐"
            items={frequentItems}
            accentClass="border-t-secondary"
            onItemClick={(item) => setAddToListItem(item)}
            itemsInList={itemsInList}
          />

          {/* Category grid */}
          {categories.length === 0 ? (
            <div className="text-center py-12">
              <div className="flex justify-center mb-4"><IllustrationNoItems className="w-28 h-28" /></div>
              <h2 className="text-xl font-bold mb-2">{t('empty.welcome')}</h2>
              <p className="text-text-secondary">{t('empty.welcomeDesc')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  to={`/category/${cat.id}`}
                  className="bg-surface rounded-2xl border-b-2 border-primary/30 p-3 flex flex-col items-center justify-center aspect-square shadow-sm hover:shadow-md hover:border-primary/60 transition-all active:scale-95"
                >
                  <span className="text-3xl mb-1">{cat.emoji}</span>
                  <span className="text-xs font-semibold text-center leading-tight">
                    {getCategoryName(cat)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      {/* Floating bulk add button */}
      {selectMode && selectedItems.size > 0 && (
        <div className="fixed bottom-20 inset-x-0 px-4 z-20" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          <button
            onClick={() => handleBulkAdd(null)}
            className="w-full max-w-lg mx-auto block py-3.5 rounded-xl bg-primary text-white font-bold text-lg shadow-lg active:scale-[0.98] transition-transform"
          >
            {i18n.language === 'he'
              ? `הוסף ${selectedItems.size} פריטים לרשימה`
              : `Add ${selectedItems.size} item${selectedItems.size > 1 ? 's' : ''} to list`}
          </button>
        </div>
      )}

      {/* Add to List Modal (single item) */}
      {addToListItem && (
        <AddToListModal
          item={addToListItem}
          lists={lists}
          onAddToList={handleAddToList}
          onCreateAndAdd={handleCreateAndAdd}
          onClose={() => setAddToListItem(null)}
        />
      )}

      {/* List picker for bulk add (when multiple lists exist) */}
      {showListPicker && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50 animate-backdrop" onClick={() => setShowListPicker(false)} />
          <div
            className="relative bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[85vh] overflow-y-auto animate-slide-up sm:animate-fade-in"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
          >
            <div className="px-5 pt-5 pb-3 border-b border-neutral/50 flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-text">
                {i18n.language === 'he' ? 'בחר רשימה' : 'Choose List'}
              </h2>
              <button onClick={() => setShowListPicker(false)} className="w-11 h-11 rounded-full bg-neutral/30 flex items-center justify-center text-text hover:bg-neutral/50 transition-colors text-xl font-medium">×</button>
            </div>
            <div className="p-4 pb-20 space-y-2">
              {openLists.map((list) => (
                <button
                  key={list.id}
                  onClick={async () => {
                    setShowListPicker(false)
                    await handleBulkAdd(list.id)
                  }}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border border-neutral/20 bg-white hover:bg-bg transition-colors min-h-[56px]"
                >
                  <span className="text-lg">🛒</span>
                  <div className="flex-1 text-start">
                    <p className="font-semibold text-sm">{list.name}</p>
                    <p className="text-xs text-text-secondary">
                      {(list.list_items || []).length} {i18n.language === 'he' ? 'פריטים' : 'items'}
                    </p>
                  </div>
                </button>
              ))}
              <button
                onClick={async () => {
                  setShowListPicker(false)
                  const items = [...selectedItems.values()].map((item) => ({
                    item_id: item.id,
                    quantity: 1,
                    unit: item.default_unit || 'pcs',
                    ...(taggedItemData?.get(item.id) ? { notes: taggedItemData.get(item.id) } : {}),
                  }))
                  const today = new Date().toLocaleDateString(i18n.language === 'he' ? 'he-IL' : 'en-US', { month: 'short', day: 'numeric' })
                  await createList(`${t('nav.lists')} — ${today}`, items)
                  setSelectedItems(new Map())
                  setSelectMode(false)
                }}
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors min-h-[56px]"
              >
                <span className="text-lg">+</span>
                <p className="font-semibold text-sm text-primary">
                  {i18n.language === 'he' ? 'רשימה חדשה' : 'New List'}
                </p>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
