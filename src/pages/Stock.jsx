import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStock } from '../hooks/useStock'
import { useItems } from '../hooks/useItems'
import { useCategories } from '../hooks/useCategories'
import { getCategoryName } from '../lib/categoryName'
import { useKeyboardVisible } from '../hooks/useKeyboardVisible'
import LoadingSpinner from '../components/LoadingSpinner'

export default function Stock() {
  const { t, i18n } = useTranslation()
  const { stockItems, loading, addToStock, updateQuantity, updateThreshold, updateStock, removeFromStock, lowStockCount } = useStock()
  const { items: allItems } = useItems()
  const { categories } = useCategories()
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingStock, setEditingStock] = useState(null) // stock item to edit
  const [filterLow, setFilterLow] = useState(false)
  const [editingThreshold, setEditingThreshold] = useState(null)

  if (loading) return <LoadingSpinner fullScreen={false} />

  // Group stock by category
  const displayItems = filterLow
    ? stockItems.filter((s) => s.quantity <= s.low_threshold)
    : stockItems

  const grouped = {}
  displayItems.forEach((s) => {
    const cat = s.items?.categories
    const key = cat ? cat.id : 'other'
    if (!grouped[key]) {
      grouped[key] = {
        name: cat ? getCategoryName(cat) : 'Other',
        emoji: cat?.emoji || '📦',
        sortOrder: cat?.sort_order || 999,
        items: [],
      }
    }
    grouped[key].items.push(s)
  })

  const sortedGroups = Object.entries(grouped).sort((a, b) => a[1].sortOrder - b[1].sortOrder)

  // Items not yet in stock (for add modal)
  const stockItemIds = new Set(stockItems.map((s) => s.item_id))
  const unstockedItems = allItems.filter((i) => !stockItemIds.has(i.id))

  return (
    <div className="px-4 pt-6 pb-8 max-w-lg mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-extrabold">{t('nav.stock')}</h1>
        {lowStockCount > 0 && (
          <button
            onClick={() => setFilterLow(!filterLow)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
              filterLow ? 'bg-danger text-white' : 'bg-danger/10 text-danger'
            }`}
          >
            {filterLow
              ? (i18n.language === 'he' ? 'הצג הכל' : 'Show All')
              : `${lowStockCount} ${i18n.language === 'he' ? 'מלאי נמוך' : 'Low Stock'}`}
          </button>
        )}
      </div>

      {stockItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
          <span className="text-6xl mb-4">📦</span>
          <h2 className="text-xl font-bold mb-2">{t('empty.noStock')}</h2>
          <p className="text-text-secondary text-center mb-6">{t('empty.noStockDesc')}</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-6 py-3 rounded-xl bg-primary text-white font-bold text-lg"
          >
            + {t('common.add')}
          </button>
        </div>
      ) : (
        <>
          {sortedGroups.map(([catId, group]) => (
            <div key={catId} className="mb-5">
              <h3 className="text-sm font-bold text-text-secondary mb-2 flex items-center gap-1.5">
                <span>{group.emoji}</span>
                <span>{group.name}</span>
                <span className="text-xs font-normal">({group.items.length})</span>
              </h3>
              <div className="space-y-2">
                {group.items.map((s) => {
                  const isLow = s.quantity <= s.low_threshold
                  return (
                    <div
                      key={s.id}
                      className={`bg-white rounded-xl p-3.5 border shadow-sm transition-colors ${
                        isLow ? 'border-danger/30 bg-danger/5' : 'border-neutral/20'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl flex-shrink-0">{s.items?.emoji || '🛒'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate">{s.items?.name}</p>
                          {isLow && (
                            <span className="text-xs font-bold text-danger">
                              {i18n.language === 'he' ? 'מלאי נמוך' : 'Low Stock'}
                            </span>
                          )}
                        </div>

                        {/* Quantity controls */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => updateQuantity(s.id, s.quantity - 1)}
                            className="w-10 h-10 rounded-lg bg-neutral/30 flex items-center justify-center text-text font-bold text-lg active:scale-90 transition-transform"
                          >
                            −
                          </button>
                          <span className={`w-10 text-center font-bold text-lg ${isLow ? 'text-danger' : 'text-green-dark'}`}>
                            {s.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(s.id, s.quantity + 1)}
                            className="w-10 h-10 rounded-lg bg-primary text-white flex items-center justify-center font-bold text-lg active:scale-90 transition-transform"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Expanded actions */}
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-neutral/20">
                        <span className="text-xs text-text-secondary">{s.unit}</span>

                        {editingThreshold === s.id ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-text-secondary">
                              {i18n.language === 'he' ? 'סף:' : 'Threshold:'}
                            </span>
                            <input
                              type="number"
                              defaultValue={s.low_threshold}
                              min={0}
                              className="w-14 px-2 py-1 rounded-lg border border-neutral bg-bg text-text text-center text-sm"
                              onBlur={(e) => {
                                updateThreshold(s.id, Number(e.target.value) || 1)
                                setEditingThreshold(null)
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') e.target.blur()
                              }}
                              autoFocus
                            />
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingThreshold(s.id)}
                            className="text-xs text-text-secondary hover:text-text"
                          >
                            {i18n.language === 'he' ? 'סף:' : 'Min:'} {s.low_threshold}
                          </button>
                        )}

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setEditingStock(s)}
                            className="text-xs text-primary hover:underline py-1.5 px-2 min-h-[36px] flex items-center"
                          >
                            {t('common.edit', 'Edit')}
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(i18n.language === 'he' ? 'להסיר מהמלאי?' : 'Remove from stock?')) {
                                removeFromStock(s.id)
                              }
                            }}
                            className="text-xs text-danger hover:underline py-1.5 px-2 min-h-[36px] flex items-center"
                          >
                            {t('common.delete')}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </>
      )}

      {/* FAB */}
      <button
        onClick={() => setShowAddModal(true)}
        className="fixed bottom-20 end-4 w-14 h-14 rounded-full bg-primary text-white shadow-lg flex items-center justify-center text-2xl font-bold hover:bg-primary-light active:bg-primary-dark transition-all active:scale-90 z-20"
        style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        +
      </button>

      {/* Add to stock modal */}
      {showAddModal && (
        <AddToStockModal
          items={unstockedItems}
          categories={categories}
          onAdd={async (itemId, qty, unit, threshold) => {
            await addToStock(itemId, qty, unit, threshold)
            setShowAddModal(false)
          }}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {/* Edit stock modal */}
      {editingStock && (
        <EditStockModal
          stockItem={editingStock}
          onSave={async (updates) => {
            await updateStock(editingStock.id, updates)
            setEditingStock(null)
          }}
          onClose={() => setEditingStock(null)}
        />
      )}
    </div>
  )
}

function AddToStockModal({ items, categories, onAdd, onClose }) {
  const { t, i18n } = useTranslation()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [threshold, setThreshold] = useState(0)
  const [saving, setSaving] = useState(false)
  const isKeyboardVisible = useKeyboardVisible()

  const filtered = search.trim()
    ? items.filter((i) => i.name?.toLowerCase().includes(search.toLowerCase()) || i.name_he?.toLowerCase().includes(search.toLowerCase()))
    : items

  const grouped = {}
  filtered.forEach((item) => {
    const cat = categories.find((c) => c.id === item.category_id)
    const key = cat?.id || 'other'
    if (!grouped[key]) grouped[key] = { name: cat ? getCategoryName(cat) : 'Other', emoji: cat?.emoji || '📦', items: [] }
    grouped[key].items.push(item)
  })

  const handleSubmit = async () => {
    if (!selected) return
    setSaving(true)
    await onAdd(selected.id, quantity, selected.default_unit || 'pcs', threshold)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 animate-backdrop" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[90vh] min-h-[50vh] overflow-y-auto animate-slide-up sm:animate-fade-in"
        style={{ paddingBottom: isKeyboardVisible ? '40vh' : 'env(safe-area-inset-bottom, 16px)' }}
      >
        <div className="sticky top-0 bg-white rounded-t-3xl px-5 pt-5 pb-3 border-b border-neutral/50 flex items-center justify-between z-10">
          <h2 className="text-lg font-extrabold text-text">
            {i18n.language === 'he' ? 'הוסף למלאי' : 'Add to Stock'}
          </h2>
          <button onClick={onClose} className="w-11 h-11 rounded-full bg-neutral/30 flex items-center justify-center text-text hover:bg-neutral/50 transition-colors text-xl font-medium">×</button>
        </div>

        <div className="p-4 pb-20">
          {!selected ? (
            <>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('items.search')}
                autoFocus
                className="w-full px-3 py-2.5 rounded-xl border border-neutral bg-surface text-text text-sm placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent mb-3"
              />
              {items.length === 0 ? (
                <p className="text-center text-text-secondary py-6">
                  {i18n.language === 'he' ? 'כל הפריטים כבר במלאי' : 'All items are already in stock'}
                </p>
              ) : (
                Object.entries(grouped).map(([catId, group]) => (
                  <div key={catId} className="mb-3">
                    <h3 className="text-xs font-bold text-text-secondary mb-1">{group.emoji} {group.name}</h3>
                    {group.items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setSelected(item)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-bg transition-colors min-h-[48px]"
                      >
                        <span className="text-xl">{item.emoji}</span>
                        <span className="text-sm font-medium">{item.name}</span>
                      </button>
                    ))}
                  </div>
                ))
              )}
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3.5 bg-bg rounded-xl border border-primary/30">
                <span className="text-3xl">{selected.emoji}</span>
                <div>
                  <p className="font-bold">{selected.name}</p>
                  <p className="text-xs text-text-secondary">{selected.default_unit || 'pcs'}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">
                  {i18n.language === 'he' ? 'כמות נוכחית' : 'Current Quantity'}
                </label>
                <div className="flex items-center gap-3">
                  <button onClick={() => setQuantity(Math.max(0, quantity - 1))} className="w-12 h-12 rounded-xl bg-neutral/30 flex items-center justify-center font-bold text-lg active:scale-90 transition-transform">−</button>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(0, Number(e.target.value)))}
                    className="w-20 px-3 py-2 rounded-xl border border-neutral bg-surface text-text text-center text-lg font-bold"
                  />
                  <button onClick={() => setQuantity(quantity + 1)} className="w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center font-bold text-lg active:scale-90 transition-transform">+</button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">
                  {i18n.language === 'he' ? 'סף מלאי נמוך' : 'Low Stock Threshold'}
                </label>
                <input
                  type="number"
                  value={threshold}
                  onChange={(e) => setThreshold(Math.max(0, Number(e.target.value)))}
                  className="w-20 px-3 py-2 rounded-xl border border-neutral bg-surface text-text text-center"
                />
              </div>

              <button
                onClick={handleSubmit}
                disabled={saving}
                className="w-full py-3.5 rounded-xl bg-primary text-white font-bold text-lg disabled:opacity-50 min-h-[48px]"
              >
                {saving ? t('items.saving') : t('common.add')}
              </button>
              <button onClick={() => setSelected(null)} className="w-full py-3 text-text-secondary font-semibold text-sm min-h-[44px]">
                {t('common.back')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function EditStockModal({ stockItem, onSave, onClose }) {
  const { t, i18n } = useTranslation()
  const [quantity, setQuantity] = useState(stockItem.quantity)
  const [threshold, setThreshold] = useState(stockItem.low_threshold)
  const [saving, setSaving] = useState(false)
  const isKeyboardVisible = useKeyboardVisible()

  const handleSubmit = async () => {
    setSaving(true)
    await onSave({ quantity, low_threshold: threshold })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 animate-backdrop" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md overflow-y-auto animate-slide-up sm:animate-fade-in"
        style={{ paddingBottom: isKeyboardVisible ? '40vh' : 'env(safe-area-inset-bottom, 16px)' }}
      >
        <div className="sticky top-0 bg-white rounded-t-3xl px-5 pt-5 pb-3 border-b border-neutral/50 flex items-center justify-between z-10">
          <h2 className="text-lg font-extrabold text-text">
            {i18n.language === 'he' ? 'עריכת מלאי' : 'Edit Stock'}
          </h2>
          <button onClick={onClose} className="w-11 h-11 rounded-full bg-neutral/30 flex items-center justify-center text-text hover:bg-neutral/50 transition-colors text-xl font-medium">×</button>
        </div>

        <div className="p-4 pb-20 space-y-4">
          <div className="flex items-center gap-3 p-3.5 bg-bg rounded-xl border border-primary/30">
            <span className="text-3xl">{stockItem.items?.emoji || '🛒'}</span>
            <div>
              <p className="font-bold">{stockItem.items?.name}</p>
              <p className="text-xs text-text-secondary">{stockItem.unit}</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">
              {i18n.language === 'he' ? 'כמות נוכחית' : 'Current Quantity'}
            </label>
            <div className="flex items-center gap-3">
              <button onClick={() => setQuantity(Math.max(0, quantity - 1))} className="w-12 h-12 rounded-xl bg-neutral/30 flex items-center justify-center font-bold text-lg active:scale-90 transition-transform">−</button>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(0, Number(e.target.value)))}
                className="w-20 px-3 py-2 rounded-xl border border-neutral bg-surface text-text text-center text-lg font-bold"
              />
              <button onClick={() => setQuantity(quantity + 1)} className="w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center font-bold text-lg active:scale-90 transition-transform">+</button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">
              {i18n.language === 'he' ? 'סף מלאי נמוך' : 'Low Stock Threshold'}
            </label>
            <input
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(Math.max(0, Number(e.target.value)))}
              className="w-20 px-3 py-2 rounded-xl border border-neutral bg-surface text-text text-center"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full py-3.5 rounded-xl bg-primary text-white font-bold text-lg disabled:opacity-50 min-h-[48px]"
          >
            {saving ? t('items.saving') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
