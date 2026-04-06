import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCategories } from '../hooks/useCategories'
import { useItems } from '../hooks/useItems'
import { useLists } from '../hooks/useLists'
import { getCategoryName } from '../lib/categoryName'

export default function EditList() {
  const { t, i18n } = useTranslation()
  const { listId } = useParams()
  const navigate = useNavigate()
  const { categories } = useCategories()
  const { items: allItems } = useItems()
  const { lists, addItemToList, removeItemFromList, updateListItem, updateListName } = useLists()
  const [selected, setSelected] = useState({}) // { itemId: { quantity, unit, listItemId? } }
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState(null)
  const [saving, setSaving] = useState(false)
  const [listName, setListName] = useState('')

  const list = lists.find((l) => l.id === listId)

  // Pre-populate with existing list items
  useEffect(() => {
    if (!list) return
    setListName(list.name)
    const existing = {}
    ;(list.list_items || []).forEach((li) => {
      existing[li.item_id] = {
        quantity: li.quantity,
        unit: li.unit,
        listItemId: li.id,
        original: true,
      }
    })
    setSelected(existing)
  }, [list?.id])

  if (!list) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-bg">
        <p className="text-text-secondary">{i18n.language === 'he' ? 'רשימה לא נמצאה' : 'List not found'}</p>
      </div>
    )
  }

  const hasBoughtItems = (list.list_items || []).some((li) => li.is_bought)

  const filteredItems = allItems.filter((item) => {
    if (search.trim()) {
      const q = search.toLowerCase()
      return item.name?.toLowerCase().includes(q) || item.name_he?.toLowerCase().includes(q)
    }
    if (activeCategory) return item.category_id === activeCategory
    return true
  })

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

  const handleSave = async () => {
    setSaving(true)

    try {
      // Update list name if changed
      if (listName !== list.name) {
        await updateListName(list.id, listName)
      }

      const existingItems = {}
      ;(list.list_items || []).forEach((li) => {
        existingItems[li.item_id] = li
      })

      // Items to add (in selected but not in existing)
      for (const [itemId, sel] of Object.entries(selected)) {
        if (!existingItems[itemId]) {
          await addItemToList(list.id, {
            item_id: itemId,
            quantity: sel.quantity,
            unit: sel.unit,
          })
        } else if (
          existingItems[itemId].quantity !== sel.quantity ||
          existingItems[itemId].unit !== sel.unit
        ) {
          await updateListItem(existingItems[itemId].id, {
            quantity: sel.quantity,
            unit: sel.unit,
          })
        }
      }

      // Items to remove (in existing but not in selected)
      for (const [itemId, li] of Object.entries(existingItems)) {
        if (!selected[itemId]) {
          await removeItemFromList(li.id)
        }
      }

      navigate('/lists', { replace: true })
    } catch (err) {
      console.error(err)
      setSaving(false)
    }
  }

  return (
    <div className="min-h-dvh bg-bg">
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
          <input
            type="text"
            value={listName}
            onChange={(e) => setListName(e.target.value)}
            className="flex-1 text-xl font-extrabold bg-transparent border-none outline-none"
          />
        </div>

        {hasBoughtItems && (
          <div className="px-4 pb-2 max-w-lg mx-auto">
            <div className="bg-secondary-light/50 rounded-xl px-3 py-2 text-xs text-text-secondary">
              {i18n.language === 'he'
                ? '⚠️ חלק מהפריטים כבר נקנו. שינויים עלולים להתנגש.'
                : '⚠️ Some items are already bought. Changes may conflict.'}
            </div>
          </div>
        )}

        {/* Search */}
        <div className="px-4 pb-2 max-w-lg mx-auto">
          <div className="relative">
            <svg className="absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setActiveCategory(null) }}
              placeholder={t('items.search')}
              className="w-full ps-10 pe-4 py-2.5 rounded-xl border border-neutral bg-surface text-text text-sm placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
        </div>

        {/* Category pills */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar max-w-lg mx-auto">
          <button
            onClick={() => { setActiveCategory(null); setSearch('') }}
            className={`flex-shrink-0 px-4 py-2.5 rounded-full text-xs font-semibold transition-colors min-h-[40px] ${
              !activeCategory && !search ? 'bg-primary text-white' : 'bg-white text-text-secondary border border-neutral/30 shadow-sm'
            }`}
          >
            {t('items.allCategories')}
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => { setActiveCategory(cat.id); setSearch('') }}
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
                <h3 className="text-sm font-bold text-text-secondary mb-2">
                  {cat ? `${cat.emoji} ${getCategoryName(cat)}` : 'Other'}
                </h3>
              )}
              <div className="space-y-1.5">
                {catItems.map((item) => {
                  const isSelected = !!selected[item.id]
                  const sel = selected[item.id]
                  return (
                    <div
                      key={item.id}
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
                            className="w-9 h-9 rounded-lg bg-neutral/30 flex items-center justify-center text-text font-bold text-base active:scale-90 transition-transform"
                          >
                            −
                          </button>
                          <span className="w-8 text-center font-bold text-sm">{sel.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.id, sel.quantity + 1)}
                            className="w-9 h-9 rounded-lg bg-primary text-white flex items-center justify-center font-bold text-base active:scale-90 transition-transform"
                          >
                            +
                          </button>
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
      <div
        className="fixed bottom-16 inset-x-0 z-20 px-4 pb-2"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 4rem)' }}
      >
        <div className="max-w-lg mx-auto">
          <button
            onClick={handleSave}
            disabled={saving || selectedCount === 0}
            className="w-full py-3.5 rounded-xl bg-primary text-white font-bold text-lg shadow-lg hover:bg-primary-light active:bg-primary-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <span>
              {saving
                ? t('items.saving')
                : `${i18n.language === 'he' ? 'שמור רשימה' : 'Save List'} (${selectedCount})`}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
