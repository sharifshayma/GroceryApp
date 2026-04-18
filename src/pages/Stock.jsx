import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStock } from '../hooks/useStock'
import { useItems } from '../hooks/useItems'
import { useCategories } from '../hooks/useCategories'
import { getCategoryName } from '../lib/categoryName'
import { useKeyboardVisible } from '../hooks/useKeyboardVisible'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorBanner from '../components/ErrorBanner'
import { IllustrationNoItems, IconSettings } from '../components/Icons'
import Toggle from '../components/Toggle'

export default function Stock() {
  const { t, i18n } = useTranslation()
  const { stockItems, loading, error, addToStock, updateQuantity, updateThreshold, updateStock, removeFromStock, lowStockCount, refetch } = useStock()
  const { items: allItems, updateItem } = useItems()
  const { categories } = useCategories()
  const [addModalMode, setAddModalMode] = useState(null) // null | 'in-stock' | 'out-of-stock'
  const [editingStock, setEditingStock] = useState(null) // stock item to edit
  const [filterLow, setFilterLow] = useState(false)
  const [editingThreshold, setEditingThreshold] = useState(null)
  const [showSettings, setShowSettings] = useState(false)

  if (loading) return <LoadingSpinner fullScreen={false} />
  if (error) return <ErrorBanner error={error} onRetry={refetch} />

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

  // Group allItems by category for the settings panel, using the same order
  // as the rest of the app (categories are already sorted by sort_order).
  const itemsByCategory = new Map()
  allItems.forEach((item) => {
    const key = item.category_id || 'other'
    if (!itemsByCategory.has(key)) itemsByCategory.set(key, [])
    itemsByCategory.get(key).push(item)
  })
  const settingsGroups = categories
    .filter((cat) => itemsByCategory.has(cat.id))
    .map((cat) => ({ key: cat.id, name: getCategoryName(cat), emoji: cat.emoji, items: itemsByCategory.get(cat.id) }))
  if (itemsByCategory.has('other')) {
    settingsGroups.push({
      key: 'other',
      name: i18n.language === 'he' ? 'אחר' : 'Other',
      emoji: '📦',
      items: itemsByCategory.get('other'),
    })
  }

  return (
    <div className="px-4 pt-6 pb-8 max-w-lg mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">{t('nav.stock')}</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings((v) => !v)}
            aria-label={i18n.language === 'he' ? 'הגדרות' : 'Settings'}
            className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-colors ${
              showSettings
                ? 'bg-primary text-white border-primary'
                : 'bg-surface border-neutral text-text-secondary hover:text-text'
            }`}
          >
            <IconSettings />
          </button>
          {lowStockCount > 0 && (
            <button
              onClick={() => setFilterLow(!filterLow)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filterLow ? 'bg-danger text-white' : 'bg-danger/10 text-danger'
              }`}
            >
              {filterLow
                ? (i18n.language === 'he' ? 'הצג הכל' : 'Show All')
                : `${lowStockCount} ${i18n.language === 'he' ? 'מלאי נמוך' : 'Low Stock'}`}
            </button>
          )}
        </div>
      </div>

      {/* Auto-track settings panel */}
      {showSettings && (
        <div className="mb-6 bg-surface rounded-2xl border border-neutral/20 p-4">
          <h3 className="text-sm font-semibold mb-1">
            {i18n.language === 'he' ? 'מעקב מלאי אוטומטי' : 'Auto Stock Tracking'}
          </h3>
          <p className="text-xs text-text-secondary mb-3">
            {i18n.language === 'he'
              ? 'פריטים מופעלים יעודכנו אוטומטית במלאי כשנקנים'
              : 'Enabled items will auto-update stock when bought'}
          </p>
          {allItems.length === 0 ? (
            <p className="text-xs text-text-secondary text-center py-2">
              {i18n.language === 'he' ? 'אין פריטים' : 'No items'}
            </p>
          ) : (
            <div className="max-h-64 overflow-y-auto overflow-x-hidden">
              {settingsGroups.map((group) => (
                <div key={group.key} className="mb-3 last:mb-0">
                  <h4 className="text-xs font-medium text-text-secondary mb-1 flex items-center gap-1.5">
                    <span>{group.emoji}</span>
                    <span>{group.name}</span>
                  </h4>
                  {group.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between py-2 border-b border-neutral/10 last:border-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-lg flex-shrink-0">{item.emoji}</span>
                        <span className="text-sm font-medium truncate">{item.name}</span>
                      </div>
                      <Toggle
                        checked={item.auto_track_stock ?? true}
                        onChange={() => updateItem(item.id, { auto_track_stock: !(item.auto_track_stock ?? true) })}
                        ariaLabel={item.name}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {stockItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh]">
          <div className="flex justify-center mb-4"><IllustrationNoItems className="w-28 h-28" /></div>
          <h2 className="text-xl font-medium mb-2">{t('empty.noStock')}</h2>
          <p className="text-text-secondary text-center mb-4">{t('empty.noStockDesc')}</p>
        </div>
      ) : (
        <>
          {sortedGroups.map(([catId, group]) => (
            <div key={catId} className="mb-5">
              <h3 className="text-sm font-medium text-text-secondary mb-2 flex items-center gap-1.5">
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
                            <span className="text-xs font-medium text-danger">
                              {i18n.language === 'he' ? 'מלאי נמוך' : 'Low Stock'}
                            </span>
                          )}
                        </div>

                        {/* Quantity controls */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => updateQuantity(s.id, s.quantity - 1)}
                            className="w-10 h-10 rounded-lg bg-neutral/30 flex items-center justify-center text-text font-medium text-lg active:scale-90 transition-transform"
                          >
                            −
                          </button>
                          <span className={`w-10 text-center font-medium text-lg ${isLow ? 'text-danger' : 'text-green-dark'}`}>
                            {s.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(s.id, s.quantity + 1)}
                            className="w-10 h-10 rounded-lg bg-primary text-white flex items-center justify-center font-medium text-lg active:scale-90 transition-transform"
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

      {/* Add items buttons */}
      {unstockedItems.length > 0 && (
        <div className="mt-6 mb-20 flex gap-3">
          <button
            onClick={() => setAddModalMode('in-stock')}
            className="flex-1 py-3.5 rounded-xl bg-green text-white font-medium text-sm shadow-sm hover:bg-green-dark transition-colors active:scale-[0.98] min-h-[48px]"
          >
            + {i18n.language === 'he' ? 'במלאי' : 'In Stock'}
          </button>
          <button
            onClick={() => setAddModalMode('out-of-stock')}
            className="flex-1 py-3.5 rounded-xl bg-white text-danger font-medium text-sm border border-danger/30 shadow-sm hover:bg-danger/5 transition-colors active:scale-[0.98] min-h-[48px]"
          >
            − {i18n.language === 'he' ? 'חסר במלאי' : 'Out of Stock'}
          </button>
        </div>
      )}

      {/* Add to stock modal */}
      {addModalMode && (
        <AddToStockModal
          mode={addModalMode}
          items={unstockedItems}
          categories={categories}
          onBatchAdd={async (items) => {
            for (const item of items) {
              await addToStock(item.itemId, item.quantity, item.unit, item.lowThreshold)
            }
            setAddModalMode(null)
          }}
          onClose={() => setAddModalMode(null)}
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

function AddToStockModal({ mode, items, categories, onBatchAdd, onClose }) {
  const { t, i18n } = useTranslation()
  const [search, setSearch] = useState('')
  const [selectedItems, setSelectedItems] = useState(new Map())
  const [singleQty, setSingleQty] = useState(1)
  const [saving, setSaving] = useState(false)
  const { isKeyboardVisible } = useKeyboardVisible()

  const isInStock = mode === 'in-stock'

  const toggleSelect = (item) => {
    setSelectedItems((prev) => {
      const next = new Map(prev)
      if (next.has(item.id)) next.delete(item.id)
      else next.set(item.id, item)
      return next
    })
  }

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
    if (selectedItems.size === 0) return
    setSaving(true)

    const defaultQty = isInStock
      ? (selectedItems.size === 1 ? singleQty : 1)
      : 0

    const batch = [...selectedItems.values()].map((item) => ({
      itemId: item.id,
      quantity: defaultQty,
      unit: item.default_unit || 'pcs',
      lowThreshold: 0,
    }))
    await onBatchAdd(batch)
  }

  const accentColor = isInStock ? 'green' : 'neutral'

  return (
    <div
      className="fixed inset-x-0 top-0 z-50 flex items-end sm:items-center justify-center"
      style={{ bottom: isKeyboardVisible ? 0 : 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="absolute inset-0 bg-black/50 animate-backdrop" onClick={saving ? undefined : onClose} />
      <div className="relative bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-full min-h-[50vh] flex flex-col animate-slide-up sm:animate-fade-in">
        <div className="flex-shrink-0 bg-white rounded-t-3xl px-5 pt-5 pb-3 border-b border-neutral/50 flex items-center justify-between z-10">
          <h2 className="text-lg font-semibold text-text">
            {isInStock
              ? (i18n.language === 'he' ? 'הוסף למלאי' : 'Add to Stock')
              : (i18n.language === 'he' ? 'סמן כחסר במלאי' : 'Mark Out of Stock')}
          </h2>
          <button onClick={onClose} className="w-11 h-11 rounded-full bg-neutral/30 flex items-center justify-center text-text hover:bg-neutral/50 transition-colors text-xl font-medium">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
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
                <h3 className="text-xs font-medium text-text-secondary mb-1">{group.emoji} {group.name}</h3>
                {group.items.map((item) => {
                  const isSelected = selectedItems.has(item.id)
                  return (
                    <button
                      key={item.id}
                      onClick={() => toggleSelect(item)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors min-h-[48px] ${
                        isSelected
                          ? isInStock ? 'bg-green/10' : 'bg-danger/10'
                          : 'hover:bg-bg'
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        isSelected
                          ? isInStock ? 'bg-green border-green text-white' : 'bg-danger border-danger text-white'
                          : 'border-neutral'
                      }`}>
                        {isSelected && <span className="text-xs">{isInStock ? '✓' : '✗'}</span>}
                      </span>
                      <span className="text-xl">{item.emoji}</span>
                      <span className="text-sm font-medium">{item.name}</span>
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {selectedItems.size > 0 && (
          <div className="flex-shrink-0 p-4 border-t border-neutral/30 bg-white rounded-b-3xl space-y-3">
            {/* Quantity stepper for single item in "in-stock" mode */}
            {isInStock && selectedItems.size === 1 && (
              <div className="flex items-center justify-center gap-3">
                <span className="text-sm text-text-secondary">
                  {i18n.language === 'he' ? 'כמות:' : 'Qty:'}
                </span>
                <button
                  onClick={() => setSingleQty(Math.max(0, singleQty - 1))}
                  className="w-10 h-10 rounded-lg bg-neutral/30 flex items-center justify-center font-medium text-lg active:scale-90 transition-transform"
                >−</button>
                <span className="w-10 text-center font-medium text-lg">{singleQty}</span>
                <button
                  onClick={() => setSingleQty(singleQty + 1)}
                  className="w-10 h-10 rounded-lg bg-green text-white flex items-center justify-center font-medium text-lg active:scale-90 transition-transform"
                >+</button>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={saving}
              className={`w-full py-3.5 rounded-xl text-white font-medium text-lg shadow-lg disabled:opacity-50 min-h-[48px] active:scale-[0.98] transition-transform ${
                isInStock ? 'bg-green-dark' : 'bg-danger'
              }`}
            >
              {saving
                ? (i18n.language === 'he' ? 'מוסיף...' : 'Adding...')
                : isInStock
                  ? (i18n.language === 'he'
                      ? `הוסף ${selectedItems.size} פריטים למלאי`
                      : `Add ${selectedItems.size} item${selectedItems.size > 1 ? 's' : ''} to stock`)
                  : (i18n.language === 'he'
                      ? `סמן ${selectedItems.size} כחסר`
                      : `Mark ${selectedItems.size} as out of stock`)}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function EditStockModal({ stockItem, onSave, onClose }) {
  const { t, i18n } = useTranslation()
  const [quantity, setQuantity] = useState(stockItem.quantity)
  const [threshold, setThreshold] = useState(stockItem.low_threshold)
  const [saving, setSaving] = useState(false)
  const { isKeyboardVisible } = useKeyboardVisible()

  const handleSubmit = async () => {
    setSaving(true)
    await onSave({ quantity, low_threshold: threshold })
  }

  return (
    <div
      className="fixed inset-x-0 top-0 z-50 flex items-end sm:items-center justify-center"
      style={{ bottom: isKeyboardVisible ? 0 : 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="absolute inset-0 bg-black/50 animate-backdrop" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-full overflow-y-auto animate-slide-up sm:animate-fade-in"
        style={{ paddingBottom: isKeyboardVisible ? '40vh' : '16px' }}
      >
        <div className="sticky top-0 bg-white rounded-t-3xl px-5 pt-5 pb-3 border-b border-neutral/50 flex items-center justify-between z-10">
          <h2 className="text-lg font-semibold text-text">
            {i18n.language === 'he' ? 'עריכת מלאי' : 'Edit Stock'}
          </h2>
          <button onClick={onClose} className="w-11 h-11 rounded-full bg-neutral/30 flex items-center justify-center text-text hover:bg-neutral/50 transition-colors text-xl font-medium">×</button>
        </div>

        <div className="p-4 pb-20 space-y-4">
          <div className="flex items-center gap-3 p-3.5 bg-bg rounded-xl border border-primary/30">
            <span className="text-3xl">{stockItem.items?.emoji || '🛒'}</span>
            <div>
              <p className="font-medium">{stockItem.items?.name}</p>
              <p className="text-xs text-text-secondary">{stockItem.unit}</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">
              {i18n.language === 'he' ? 'כמות נוכחית' : 'Current Quantity'}
            </label>
            <div className="flex items-center gap-3">
              <button onClick={() => setQuantity(Math.max(0, quantity - 1))} className="w-12 h-12 rounded-xl bg-neutral/30 flex items-center justify-center font-medium text-lg active:scale-90 transition-transform">−</button>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(0, Number(e.target.value)))}
                className="w-20 px-3 py-2 rounded-xl border border-neutral bg-surface text-text text-center text-lg font-medium"
              />
              <button onClick={() => setQuantity(quantity + 1)} className="w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center font-medium text-lg active:scale-90 transition-transform">+</button>
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
            className="w-full py-3.5 rounded-xl bg-primary text-white font-medium text-lg disabled:opacity-50 min-h-[48px]"
          >
            {saving ? t('items.saving') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
