import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCategories } from '../hooks/useCategories'
import { useItems } from '../hooks/useItems'
import { useLists } from '../hooks/useLists'
import { useTags } from '../hooks/useTags'
import { supabase } from '../lib/supabase'
import { getCategoryName } from '../lib/categoryName'

export default function CreateList() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { categories } = useCategories()
  const { items: allItems } = useItems()
  const { createList } = useLists()
  const { tags } = useTags()
  const [selected, setSelected] = useState({}) // { itemId: { quantity, unit } }
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState(null)
  const [activeTags, setActiveTags] = useState([]) // array of tag ids
  const [taggedItemData, setTaggedItemData] = useState(null) // { itemId: [{ tagName, tagColor, notes }] }
  const [saving, setSaving] = useState(false)

  // Fetch tagged items when tag filter changes
  useEffect(() => {
    if (activeTags.length === 0) {
      setTaggedItemData(null)
      return
    }
    supabase
      .from('item_tags')
      .select('item_id, notes, tags(name, color)')
      .in('tag_id', activeTags)
      .then(({ data }) => {
        if (data) {
          const map = {}
          data.forEach((row) => {
            if (!map[row.item_id]) map[row.item_id] = []
            map[row.item_id].push({
              tagName: row.tags?.name || '',
              tagColor: row.tags?.color || '#3B82F6',
              notes: row.notes || '',
            })
          })
          setTaggedItemData(map)
        }
      })
  }, [activeTags])

  const toggleTagFilter = (tagId) => {
    setActiveTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    )
    setActiveCategory(null)
    setSearch('')
  }

  const filteredItems = allItems.filter((item) => {
    if (search.trim()) {
      const q = search.toLowerCase()
      return item.name?.toLowerCase().includes(q) || item.name_he?.toLowerCase().includes(q)
    }
    if (activeTags.length > 0 && taggedItemData) {
      return !!taggedItemData[item.id]
    }
    if (activeCategory) return item.category_id === activeCategory
    return true
  })

  // Group items by category
  const grouped = {}
  filteredItems.forEach((item) => {
    const catId = item.category_id || 'uncategorized'
    if (!grouped[catId]) grouped[catId] = []
    grouped[catId].push(item)
  })

  const toggleItem = (item) => {
    setSelected((prev) => {
      const next = { ...prev }
      if (next[item.id]) {
        delete next[item.id]
      } else {
        next[item.id] = { quantity: 1, unit: item.default_unit || 'pcs' }
      }
      return next
    })
  }

  const updateQuantity = (itemId, quantity) => {
    if (quantity < 1) return
    setSelected((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], quantity },
    }))
  }

  const selectedCount = Object.keys(selected).length

  // Build notes string for an item from active tag data
  const getItemNotes = (itemId) => {
    if (!taggedItemData || !taggedItemData[itemId]) return ''
    return taggedItemData[itemId]
      .filter((t) => t.notes)
      .map((t) => `${t.tagName}: ${t.notes}`)
      .join(' | ')
  }

  const handleCreate = async () => {
    if (selectedCount === 0) return
    setSaving(true)

    const today = new Date().toLocaleDateString(i18n.language === 'he' ? 'he-IL' : 'en-US', {
      month: 'short',
      day: 'numeric',
    })
    const name = `${t('nav.lists')} — ${today}`

    const items = Object.entries(selected).map(([item_id, { quantity, unit }]) => ({
      item_id,
      quantity,
      unit,
      notes: getItemNotes(item_id) || null,
    }))

    try {
      await createList(name, items)
      navigate('/lists', { replace: true })
    } catch (err) {
      console.error(err)
      setSaving(false)
    }
  }

  return (
    <div className="min-h-dvh bg-bg">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-bg">
        <div className="px-4 pt-4 pb-2 flex items-center gap-3 max-w-lg mx-auto">
          <button
            onClick={() => navigate('/lists')}
            className="w-10 h-10 rounded-xl bg-surface border border-neutral flex items-center justify-center text-text-secondary hover:text-text transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <h1 className="text-xl font-semibold">{i18n.language === 'he' ? 'רשימה חדשה' : 'New List'}</h1>
        </div>

        {/* Search */}
        <div className="px-4 pb-2 max-w-lg mx-auto">
          <div className="relative">
            <svg className="absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setActiveCategory(null); setActiveTags([]) }}
              placeholder={t('items.search')}
              className="w-full ps-10 pe-4 py-2.5 rounded-xl border border-neutral bg-surface text-text text-sm placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
        </div>

        {/* Tag filter pills */}
        {tags.length > 0 && (
          <div className="flex gap-2 px-4 pb-2 overflow-x-auto no-scrollbar max-w-lg mx-auto">
            {activeTags.length > 0 && (
              <button
                onClick={() => setActiveTags([])}
                className="flex-shrink-0 px-3 py-2 rounded-full text-xs font-semibold bg-neutral/30 text-text-secondary min-h-[36px]"
              >
                {i18n.language === 'he' ? 'נקה' : 'Clear'}
              </button>
            )}
            {tags.map((tag) => {
              const isActive = activeTags.includes(tag.id)
              return (
                <button
                  key={tag.id}
                  onClick={() => toggleTagFilter(tag.id)}
                  className="flex-shrink-0 px-3 py-2 rounded-full text-xs font-semibold transition-colors min-h-[36px] flex items-center gap-1.5"
                  style={isActive
                    ? { backgroundColor: tag.color, color: 'white' }
                    : { backgroundColor: 'white', color: '#6B7280', border: '1px solid rgba(0,0,0,0.1)' }
                  }
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: isActive ? 'white' : tag.color }} />
                  {tag.name}
                </button>
              )
            })}
          </div>
        )}

        {/* Category pills */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar max-w-lg mx-auto">
          <button
            onClick={() => { setActiveCategory(null); setSearch(''); setActiveTags([]) }}
            className={`flex-shrink-0 px-4 py-2.5 rounded-full text-xs font-semibold transition-colors min-h-[40px] ${
              !activeCategory && !search && activeTags.length === 0 ? 'bg-primary text-white' : 'bg-white text-text-secondary border border-neutral/30 shadow-sm'
            }`}
          >
            {t('items.allCategories')}
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => { setActiveCategory(cat.id); setSearch(''); setActiveTags([]) }}
              className={`flex-shrink-0 px-4 py-2.5 rounded-full text-xs font-semibold transition-colors min-h-[40px] ${
                activeCategory === cat.id ? 'bg-primary text-white' : 'bg-white text-text-secondary border border-neutral/30 shadow-sm'
              }`}
            >
              {cat.emoji} {getCategoryName(cat)}
            </button>
          ))}
        </div>

        <div className="border-b border-neutral/50" />
      </div>

      {/* Item list */}
      <div className="px-4 py-3 max-w-lg mx-auto pb-28">
        {Object.entries(grouped).map(([catId, catItems]) => {
          const cat = categories.find((c) => c.id === catId)
          return (
            <div key={catId} className="mb-4">
              {!search && (
                <h3 className="text-sm font-medium text-text-secondary mb-2">
                  {cat ? `${cat.emoji} ${getCategoryName(cat)}` : 'Other'}
                </h3>
              )}
              <div className="space-y-1.5">
                {catItems.map((item) => {
                  const isSelected = !!selected[item.id]
                  const sel = selected[item.id]
                  const itemTagNotes = taggedItemData?.[item.id]
                  return (
                    <div key={item.id}>
                      <div
                        className={`bg-white rounded-xl p-3.5 flex items-center gap-3 border shadow-sm transition-colors min-h-[52px] ${
                          isSelected ? 'border-primary bg-primary/5' : 'border-neutral/20'
                        }`}
                      >
                        <button
                          onClick={() => toggleItem(item)}
                          className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                            isSelected ? 'bg-primary border-primary text-white' : 'border-neutral'
                          }`}
                        >
                          {isSelected && (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          )}
                        </button>
                        <span className="text-xl">{item.emoji}</span>
                        <span className="flex-1 font-medium text-sm truncate">{item.name}</span>

                        {isSelected && (
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => updateQuantity(item.id, sel.quantity - 1)}
                              className="w-9 h-9 rounded-lg bg-neutral/30 flex items-center justify-center text-text font-medium text-base active:scale-90 transition-transform"
                            >
                              −
                            </button>
                            <span className="w-8 text-center font-medium text-sm">{sel.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.id, sel.quantity + 1)}
                              className="w-9 h-9 rounded-lg bg-primary text-white flex items-center justify-center font-medium text-base active:scale-90 transition-transform"
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Tag notes display when filtering by tags */}
                      {activeTags.length > 0 && itemTagNotes && itemTagNotes.some((t) => t.notes) && (
                        <div className="ms-10 mt-1 px-3 py-1.5 bg-secondary-light/30 rounded-lg">
                          <p className="text-xs text-text-secondary">
                            {itemTagNotes
                              .filter((t) => t.notes)
                              .map((t) => `${t.tagName}: ${t.notes}`)
                              .join(' | ')}
                          </p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {filteredItems.length === 0 && (
          <div className="text-center py-12">
            <span className="text-4xl mb-3 block">🔍</span>
            <p className="text-text-secondary">{t('empty.noItems')}</p>
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      {selectedCount > 0 && (
        <div
          className="fixed bottom-16 inset-x-0 z-20 px-4 pb-2"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 4rem)' }}
        >
          <div className="max-w-lg mx-auto">
            <button
              onClick={handleCreate}
              disabled={saving}
              className="w-full py-3.5 rounded-xl bg-primary text-white font-medium text-lg shadow-lg hover:bg-primary-light active:bg-primary-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <span>🛒</span>
              <span>
                {saving ? t('items.saving') : `${i18n.language === 'he' ? 'צור רשימה' : 'Create List'} (${selectedCount})`}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
