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

export default function Home() {
  const { t, i18n } = useTranslation()
  const { profile } = useAuth()
  const { categories, loading } = useCategories()
  const { items: allItems } = useItems()
  const { tags } = useTags()
  const { lists, createList, addItemToList } = useLists()
  const [search, setSearch] = useState('')
  const [activeTag, setActiveTag] = useState(null)
  const [taggedItemIds, setTaggedItemIds] = useState(null)
  const [frequentItems, setFrequentItems] = useState([])
  const [needToBuy, setNeedToBuy] = useState([])
  const [addToListItem, setAddToListItem] = useState(null) // item for AddToListModal

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
        .select('item_id, items(id, name, name_he, emoji, default_unit)')
        .eq('is_bought', true)
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

      // 1. Items not bought from completed lists
      const { data: unbought } = await supabase
        .from('list_items')
        .select('item_id, items(id, name, name_he, emoji, default_unit), grocery_lists!inner(status)')
        .eq('is_bought', false)
        .eq('grocery_lists.status', 'completed')
        .not('items', 'is', null)

      if (unbought) {
        unbought.forEach((li) => {
          if (li.items) unique[li.items.id] = li.items
        })
      }

      // 2. Low stock items
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

  // Fetch items for active tag filter
  useEffect(() => {
    if (!activeTag) { setTaggedItemIds(null); return }
    supabase
      .from('item_tags')
      .select('item_id')
      .eq('tag_id', activeTag)
      .then(({ data }) => {
        if (data) setTaggedItemIds(new Set(data.map((d) => d.item_id)))
        else setTaggedItemIds(new Set())
      })
  }, [activeTag])

  if (loading) return <LoadingSpinner fullScreen={false} />

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

  return (
    <div className="px-4 pt-6 pb-8 max-w-lg mx-auto animate-fade-in">
      {/* Search bar */}
      <div className="relative mb-6">
        <svg
          className="absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
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
      {activeTag && taggedItemIds && !search && (
        <div className="mb-6">
          {(() => {
            const tag = tags.find((t) => t.id === activeTag)
            const filtered = allItems.filter((i) => taggedItemIds.has(i.id))
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
                    {filtered.map((item) => (
                      <Link
                        key={item.id}
                        to={`/category/${item.category_id}`}
                        className="flex items-center gap-3 p-3 bg-surface rounded-xl border border-neutral/50 hover:border-primary/30 transition-colors"
                      >
                        <span className="text-2xl">{item.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate">{item.name}</p>
                          {item.categories && (
                            <p className="text-xs text-text-secondary">
                              {item.categories.emoji} {getCategoryName(item.categories)}
                            </p>
                          )}
                        </div>
                      </Link>
                    ))}
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
              <span className="text-4xl mb-3 block">🔍</span>
              <p className="text-text-secondary">{t('empty.noItems')}</p>
            </div>
          ) : (
            searchResults.map((item) => (
              <Link
                key={item.id}
                to={`/category/${item.category_id}`}
                className="flex items-center gap-3 p-3 bg-surface rounded-xl border border-neutral/50 hover:border-primary/30 transition-colors"
              >
                <span className="text-2xl">{item.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{item.name}</p>
                  {item.categories && (
                    <p className="text-xs text-text-secondary">
                      {item.categories.emoji} {getCategoryName(item.categories)}
                    </p>
                  )}
                </div>
              </Link>
            ))
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
              <span className="text-6xl mb-4 block">📦</span>
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

      {/* Add to List Modal */}
      {addToListItem && (
        <AddToListModal
          item={addToListItem}
          lists={lists}
          onAddToList={handleAddToList}
          onCreateAndAdd={handleCreateAndAdd}
          onClose={() => setAddToListItem(null)}
        />
      )}
    </div>
  )
}
