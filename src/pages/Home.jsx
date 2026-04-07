import { useState, useEffect, useMemo, useRef } from 'react'
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
import { IconSearch, IconPlus, IconEdit, IconSettings, IconChevronDown, IconChevronRight, IllustrationNoResults, IllustrationNoItems } from '../components/Icons'

export default function Home() {
  const { t, i18n } = useTranslation()
  const { profile } = useAuth()
  const { categories, loading, error: categoriesError, refetch: refetchCategories } = useCategories()
  const { items: allItems } = useItems()
  const { tags, recipeTags, storeTags, customTags } = useTags()
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

  // Filter state
  const [activeCategory, setActiveCategory] = useState(null)
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)
  const [expandedTagType, setExpandedTagType] = useState(null)
  const [showSettings, setShowSettings] = useState(false)

  // Refs for click-outside dropdown closing
  const settingsRef = useRef(null)
  const categoryDropdownRef = useRef(null)
  const tagDropdownRef = useRef(null)

  useEffect(() => {
    if (!showSettings && !showCategoryDropdown && !expandedTagType) return
    const handleClickOutside = (e) => {
      if (showSettings && settingsRef.current && !settingsRef.current.contains(e.target)) setShowSettings(false)
      if (showCategoryDropdown && categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target)) setShowCategoryDropdown(false)
      if (expandedTagType && tagDropdownRef.current && !tagDropdownRef.current.contains(e.target)) setExpandedTagType(null)
    }
    // Use requestAnimationFrame to ensure the listener is added after the current event cycle
    const rafId = requestAnimationFrame(() => {
      document.addEventListener('mousedown', handleClickOutside)
    })
    return () => { cancelAnimationFrame(rafId); document.removeEventListener('mousedown', handleClickOutside) }
  }, [showSettings, showCategoryDropdown, expandedTagType])

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

  // Clear selections when switching filters
  useEffect(() => {
    setSelectedItems(new Map())
  }, [activeTag, activeCategory, search])

  // Mutual exclusivity: category and tag filters
  useEffect(() => {
    if (activeCategory) setActiveTag(null)
  }, [activeCategory])
  useEffect(() => {
    if (activeTag) setActiveCategory(null)
  }, [activeTag])

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

  // Computed: items filtered by active category
  const categoryFilteredItems = activeCategory
    ? allItems.filter((i) => i.category_id === activeCategory)
    : null

  // Tag type groups for filter chips
  const tagGroups = [
    { type: 'recipe', emoji: '🍽️', label: i18n.language === 'he' ? 'מתכונים' : 'Recipes', items: recipeTags },
    { type: 'store', emoji: '🏪', label: i18n.language === 'he' ? 'חנויות' : 'Stores', items: storeTags },
    { type: 'custom', emoji: '🏷️', label: i18n.language === 'he' ? 'מותאם' : 'Custom', items: customTags },
  ].filter((g) => g.items.length > 0)

  return (
    <div className="px-4 pt-6 pb-8 max-w-lg mx-auto animate-fade-in">
      {/* Header with settings gear */}
      <div ref={settingsRef} className="flex items-center justify-end mb-4 relative">
        <button
          onMouseDown={(e) => { e.preventDefault(); setShowSettings((v) => !v) }}
          className="w-10 h-10 rounded-xl bg-surface border border-neutral flex items-center justify-center text-text-secondary hover:text-text transition-colors"
        >
          <IconSettings />
        </button>
        {showSettings && (
          <>
            <div className="absolute end-0 top-full mt-1 z-20 bg-surface rounded-xl border border-neutral shadow-lg min-w-[200px] py-1">
              <Link
                to="/manage-categories"
                onClick={() => setShowSettings(false)}
                className="flex items-center justify-between px-4 py-3 hover:bg-bg transition-colors text-sm"
              >
                <span>{i18n.language === 'he' ? 'ניהול קטגוריות' : 'Manage Categories'}</span>
                <IconChevronRight className="w-4 h-4 text-text-secondary" />
              </Link>
              <Link
                to="/manage-tags"
                onClick={() => setShowSettings(false)}
                className="flex items-center justify-between px-4 py-3 hover:bg-bg transition-colors text-sm"
              >
                <span>{i18n.language === 'he' ? 'ניהול תגיות' : 'Manage Tags'}</span>
                <IconChevronRight className="w-4 h-4 text-text-secondary" />
              </Link>
            </div>
          </>
        )}
      </div>

      {/* Search bar + Select toggle */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
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
        <button
          onClick={() => {
            if (selectMode) {
              setSelectMode(false)
              setSelectedItems(new Map())
            } else {
              setSelectMode(true)
            }
          }}
          className={`flex-shrink-0 px-3 py-3 rounded-xl text-xs font-medium transition-colors ${
            selectMode ? 'bg-primary text-white' : 'bg-surface border border-neutral text-text-secondary'
          }`}
        >
          {selectMode
            ? (i18n.language === 'he' ? 'ביטול' : 'Cancel')
            : (i18n.language === 'he' ? 'בחירה' : 'Select')}
        </button>
      </div>

      {/* Filter row: Categories + Tag types */}
      {!search && (
        <div className="flex flex-wrap gap-2 mb-4 relative">
          {/* Categories filter */}
          <div ref={categoryDropdownRef} className="relative flex-shrink-0">
            <button
              onMouseDown={(e) => { e.preventDefault(); setShowCategoryDropdown((v) => !v); setExpandedTagType(null) }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                activeCategory
                  ? 'bg-primary text-white'
                  : 'bg-surface border border-neutral text-text-secondary'
              }`}
            >
              {activeCategory
                ? `${categories.find((c) => c.id === activeCategory)?.emoji || '📁'} ${getCategoryName(categories.find((c) => c.id === activeCategory))}`
                : `📁 ${i18n.language === 'he' ? 'קטגוריות' : 'Categories'}`}
              <IconChevronDown className="w-3 h-3" />
            </button>
            {showCategoryDropdown && (
              <>
                <div className="absolute start-0 top-full mt-1 z-20 bg-surface rounded-xl border border-neutral shadow-lg min-w-[200px] max-h-[60vh] overflow-y-auto py-1">
                  <button
                    onClick={() => { setActiveCategory(null); setShowCategoryDropdown(false) }}
                    className={`w-full flex items-center gap-2 px-4 py-2.5 hover:bg-bg transition-colors text-sm text-start ${!activeCategory ? 'text-primary font-medium' : ''}`}
                  >
                    {i18n.language === 'he' ? 'הצג הכל' : 'Show All'}
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => { setActiveCategory(cat.id); setShowCategoryDropdown(false) }}
                      className={`w-full flex items-center gap-2 px-4 py-2.5 hover:bg-bg transition-colors text-sm text-start ${activeCategory === cat.id ? 'bg-primary/10 text-primary font-medium' : ''}`}
                    >
                      <span>{cat.emoji}</span>
                      <span>{getCategoryName(cat)}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Tag type chips */}
          {tagGroups.map((group) => {
            const activeTagInGroup = tags.find((t) => t.id === activeTag && t.type === group.type)
            return (
              <div key={group.type} ref={expandedTagType === group.type ? tagDropdownRef : undefined} className="relative flex-shrink-0">
                <button
                  onMouseDown={(e) => { e.preventDefault(); setExpandedTagType((v) => v === group.type ? null : group.type); setShowCategoryDropdown(false) }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    activeTagInGroup
                      ? 'text-white'
                      : 'bg-surface border border-neutral text-text-secondary'
                  }`}
                  style={activeTagInGroup ? { backgroundColor: activeTagInGroup.color } : {}}
                >
                  {activeTagInGroup
                    ? `${group.emoji} ${activeTagInGroup.name}`
                    : `${group.emoji} ${group.label}`}
                  <IconChevronDown className="w-3 h-3" />
                </button>
                {expandedTagType === group.type && (
                  <>
                    <div className="absolute start-0 top-full mt-1 z-20 bg-surface rounded-xl border border-neutral shadow-lg min-w-[180px] max-h-[50vh] overflow-y-auto py-1">
                      {group.items.map((tag) => (
                        <button
                          key={tag.id}
                          onClick={() => {
                            setActiveTag(activeTag === tag.id ? null : tag.id)
                            setExpandedTagType(null)
                          }}
                          className={`w-full flex items-center gap-2 px-4 py-2.5 hover:bg-bg transition-colors text-sm text-start ${activeTag === tag.id ? 'font-medium' : ''}`}
                        >
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                          <span className={activeTag === tag.id ? 'text-primary' : ''}>{tag.name}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )
          })}

          {/* Add Tag chip (if no tags exist) */}
          {tags.length === 0 && (
            <Link
              to="/manage-tags"
              className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border border-dashed border-primary/30 text-primary"
            >
              + {i18n.language === 'he' ? 'הוסף תגית' : 'Add Tag'}
            </Link>
          )}

          {/* Select all / deselect all (visible in select mode with filtered items) */}
          {selectMode && (activeTag || activeCategory) && (
            <button
              onClick={() => {
                const currentItems = activeTag && taggedItemData
                  ? allItems.filter((i) => taggedItemData.has(i.id))
                  : categoryFilteredItems || []
                if (selectedItems.size === currentItems.length) {
                  setSelectedItems(new Map())
                } else {
                  const all = new Map()
                  currentItems.forEach((i) => all.set(i.id, i))
                  setSelectedItems(all)
                }
              }}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium text-primary"
            >
              {i18n.language === 'he' ? 'בחר הכל' : 'Select all'}
            </button>
          )}
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

      {/* Category filter results */}
      {activeCategory && !activeTag && !search && categoryFilteredItems && (
        <div className="mb-6">
          {categoryFilteredItems.length === 0 ? (
            <p className="text-center text-text-secondary py-6">
              {i18n.language === 'he' ? 'אין פריטים בקטגוריה זו' : 'No items in this category'}
            </p>
          ) : (
            <div className="space-y-2">
              {categoryFilteredItems.map((item) => renderItemCard(item, null))}
            </div>
          )}
        </div>
      )}

      {/* Search results */}
      {searchResults && (
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
      )}

      {/* Default view: horizontal rows + category grid */}
      {!searchResults && !activeTag && !activeCategory && (
        <>
          <HorizontalItemRow
            title={i18n.language === 'he' ? 'צריך לקנות' : 'Need to Buy'}
            icon="🔴"
            items={needToBuy}
            accentClass="border-t-danger"
            onItemClick={(item) => setAddToListItem(item)}
            itemsInList={itemsInList}
          />

          <HorizontalItemRow
            title={i18n.language === 'he' ? 'קונים הרבה' : 'Frequently Bought'}
            icon="⭐"
            items={frequentItems}
            accentClass="border-t-secondary"
            onItemClick={(item) => setAddToListItem(item)}
            itemsInList={itemsInList}
          />

          {categories.length === 0 ? (
            <div className="text-center py-12">
              <div className="flex justify-center mb-4"><IllustrationNoItems className="w-28 h-28" /></div>
              <h2 className="text-xl font-medium mb-2">{t('empty.welcome')}</h2>
              <p className="text-text-secondary">{t('empty.welcomeDesc')}</p>
            </div>
          ) : (
            <>
            <h2 className="text-lg font-semibold mb-3">{i18n.language === 'he' ? 'פריטים' : 'Items'}</h2>
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
            </>
          )}
        </>
      )}

      {/* Floating bulk add button */}
      {selectMode && selectedItems.size > 0 && (
        <div className="fixed bottom-20 inset-x-0 px-4 z-20" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          <button
            onClick={() => handleBulkAdd(null)}
            className="w-full max-w-lg mx-auto block py-3.5 rounded-xl bg-primary text-white font-medium text-lg shadow-lg active:scale-[0.98] transition-transform"
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
              <h2 className="text-lg font-semibold text-text">
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
