import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

export default function AddToListModal({
  item,
  lists,
  stockRow,
  onAddToList,
  onCreateAndAdd,
  onRemoveFromList,
  onAddToStock,
  onUpdateStockQuantity,
  onUpdateStockThreshold,
  onRemoveFromStock,
  onClose,
}) {
  const { i18n } = useTranslation()
  const isHe = i18n.language === 'he'
  const [quantity, setQuantity] = useState(1)
  const [step, setStep] = useState('quantity') // 'quantity' | 'pickList'
  const [saving, setSaving] = useState(false)

  // Local stock state, kept in sync with the prop
  const [stockQty, setStockQty] = useState(stockRow?.quantity ?? 0)
  const [stockThreshold, setStockThreshold] = useState(stockRow?.low_threshold ?? 1)
  useEffect(() => {
    setStockQty(stockRow?.quantity ?? 0)
    setStockThreshold(stockRow?.low_threshold ?? 1)
  }, [stockRow?.id, stockRow?.quantity, stockRow?.low_threshold])

  const stockEnabled = typeof onAddToStock === 'function'
  const listRemovalEnabled = typeof onRemoveFromList === 'function'

  // Only draft/active lists
  const openLists = lists.filter((l) => l.status === 'draft' || l.status === 'active')
  const listHasItem = (list) =>
    (list.list_items || []).some((li) => li.item_id === item.id)
  const listsContaining = openLists.filter(listHasItem)
  const listsAvailable = openLists.filter((l) => !listHasItem(l))
  const alreadyInAllOpen = openLists.length > 0 && listsAvailable.length === 0

  const isLowStock = stockRow ? stockRow.quantity <= stockRow.low_threshold : false

  const handleAdd = async (listId) => {
    setSaving(true)
    try {
      if (listId) {
        await onAddToList(listId, { item_id: item.id, quantity, unit: item.default_unit || 'pcs' })
      } else {
        await onCreateAndAdd({ item_id: item.id, quantity, unit: item.default_unit || 'pcs' })
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveFromList = async (list) => {
    const li = (list.list_items || []).find((x) => x.item_id === item.id)
    if (!li) return
    setSaving(true)
    try {
      await onRemoveFromList(list.id, li.id)
    } finally {
      setSaving(false)
    }
  }

  const handleNext = () => {
    if (openLists.length === 0) {
      handleAdd(null) // create new list
    } else if (listsAvailable.length === 1) {
      handleAdd(listsAvailable[0].id)
    } else {
      setStep('pickList')
    }
  }

  const commitStockQty = async (newQty) => {
    const safe = Math.max(0, newQty)
    setStockQty(safe)
    if (stockRow) {
      await onUpdateStockQuantity(stockRow.id, safe)
    } else if (safe > 0) {
      await onAddToStock(item.id, safe, item.default_unit || 'pcs', stockThreshold)
    }
  }

  const commitThreshold = async (newT) => {
    const safe = Math.max(0, newT)
    setStockThreshold(safe)
    if (stockRow) await onUpdateStockThreshold(stockRow.id, safe)
  }

  const trackStock = async () => {
    await onAddToStock(item.id, 1, item.default_unit || 'pcs', 1)
  }

  const untrackStock = async () => {
    if (stockRow) await onRemoveFromStock(stockRow.id)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 animate-backdrop" onClick={onClose} />
      <div
        className="relative bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[85vh] overflow-y-auto animate-slide-up sm:animate-fade-in"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
      >
        <div className="px-5 pt-5 pb-3 border-b border-neutral/50 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text">
            {step === 'quantity'
              ? (isHe ? 'הוסף לרשימה' : 'Add to List')
              : (isHe ? 'בחר רשימה' : 'Choose List')}
          </h2>
          <button onClick={onClose} className="w-11 h-11 rounded-full bg-neutral/30 flex items-center justify-center text-text hover:bg-neutral/50 transition-colors text-xl font-medium">×</button>
        </div>

        <div className="p-4 pb-20">
          {step === 'quantity' ? (
            <div className="space-y-4">
              {/* Item display */}
              <div className="flex items-center gap-3 p-3.5 bg-bg rounded-xl border border-primary/30">
                <span className="text-3xl">{item.emoji || '🛒'}</span>
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-xs text-text-secondary">{item.default_unit || 'pcs'}</p>
                </div>
              </div>

              {/* Status: lists this item is on + stock state */}
              {(listsContaining.length > 0 || stockEnabled) && (
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    {isHe ? 'סטטוס' : 'Status'}
                  </label>
                  <div className="space-y-2">
                    {listsContaining.map((list) => (
                      <div
                        key={list.id}
                        className="flex items-center gap-2 p-3 rounded-xl bg-primary/5 border border-primary/20"
                      >
                        <span className="text-base">📋</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-text-secondary">{isHe ? 'ברשימה' : 'On list'}</p>
                          <p className="text-sm font-medium text-text truncate">{list.name}</p>
                        </div>
                        {listRemovalEnabled && (
                          <button
                            onClick={() => handleRemoveFromList(list)}
                            disabled={saving}
                            className="px-3 py-1.5 rounded-lg bg-white border border-primary/30 text-primary text-xs font-medium hover:bg-primary/10 disabled:opacity-50"
                          >
                            {isHe ? 'הסר' : 'Remove'}
                          </button>
                        )}
                      </div>
                    ))}

                    {stockEnabled && (
                      stockRow ? (
                        <div className={`p-3 rounded-xl border ${isLowStock ? 'bg-primary/5 border-primary/30' : 'bg-bg border-neutral/30'}`}>
                          <div className="flex items-center gap-2">
                            <span className="text-base">📦</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-text-secondary">
                                {isLowStock
                                  ? (isHe ? 'מלאי נמוך' : 'Low stock')
                                  : (isHe ? 'במלאי' : 'In stock')}
                              </p>
                              <p className="text-sm font-medium text-text">
                                {stockRow.quantity} {stockRow.unit}
                                {isLowStock ? ` · ${isHe ? 'נמוך מ-' : 'low at '}${stockRow.low_threshold}` : ''}
                              </p>
                            </div>
                            <button
                              onClick={untrackStock}
                              disabled={saving}
                              className="px-2 py-1 rounded-lg text-text-secondary text-xs hover:bg-neutral/30 disabled:opacity-50"
                            >
                              {isHe ? 'בטל מעקב' : 'Untrack'}
                            </button>
                          </div>
                          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                            <button
                              onClick={() => commitStockQty(stockQty - 1)}
                              disabled={saving || stockQty <= 0}
                              className="w-9 h-9 rounded-lg bg-neutral/30 flex items-center justify-center font-medium disabled:opacity-50 active:scale-90 transition-transform"
                            >−</button>
                            <input
                              type="number"
                              value={stockQty}
                              onChange={(e) => setStockQty(Math.max(0, Number(e.target.value)))}
                              onBlur={() => commitStockQty(stockQty)}
                              className="w-14 px-2 py-1.5 rounded-lg border border-neutral bg-surface text-text text-center text-sm font-medium"
                            />
                            <button
                              onClick={() => commitStockQty(stockQty + 1)}
                              disabled={saving}
                              className="w-9 h-9 rounded-lg bg-primary text-white flex items-center justify-center font-medium active:scale-90 transition-transform"
                            >+</button>
                            <span className="text-xs text-text-secondary ms-2">
                              {isHe ? 'נמוך ב-' : 'Low at'}
                            </span>
                            <input
                              type="number"
                              value={stockThreshold}
                              onChange={(e) => setStockThreshold(Math.max(0, Number(e.target.value)))}
                              onBlur={() => commitThreshold(stockThreshold)}
                              className="w-12 px-2 py-1.5 rounded-lg border border-neutral bg-surface text-text text-center text-sm"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-bg border border-neutral/30">
                          <span className="text-base">📦</span>
                          <p className="flex-1 text-sm text-text-secondary">
                            {isHe ? 'לא במעקב מלאי' : 'Not tracked in stock'}
                          </p>
                          <button
                            onClick={trackStock}
                            disabled={saving}
                            className="px-3 py-1.5 rounded-lg bg-white border border-primary/30 text-primary text-xs font-medium hover:bg-primary/10 disabled:opacity-50"
                          >
                            {isHe ? 'התחל מעקב' : 'Track'}
                          </button>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Quantity + CTA — only when there's a list to add to */}
              {!alreadyInAllOpen && (
                <>
                  <div>
                    <label className="block text-sm font-semibold mb-1">
                      {isHe ? 'כמות' : 'Quantity'}
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        className="w-12 h-12 rounded-xl bg-neutral/30 flex items-center justify-center font-medium text-lg active:scale-90 transition-transform"
                      >−</button>
                      <input
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                        className="w-20 px-3 py-2 rounded-xl border border-neutral bg-surface text-text text-center text-lg font-medium"
                      />
                      <button
                        onClick={() => setQuantity(quantity + 1)}
                        className="w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center font-medium text-lg active:scale-90 transition-transform"
                      >+</button>
                    </div>
                  </div>

                  <button
                    onClick={handleNext}
                    disabled={saving}
                    className="w-full py-3.5 rounded-xl bg-primary text-white font-medium text-lg disabled:opacity-50 min-h-[48px]"
                  >
                    {saving
                      ? (isHe ? 'מוסיף...' : 'Adding...')
                      : openLists.length === 0
                        ? (isHe ? 'צור רשימה והוסף' : 'Create List & Add')
                        : listsContaining.length > 0
                          ? (isHe ? 'הוסף לרשימה נוספת' : 'Add to another list')
                          : (isHe ? 'הוסף לרשימה' : 'Add to List')}
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {listsAvailable.map((list) => (
                <button
                  key={list.id}
                  onClick={() => handleAdd(list.id)}
                  disabled={saving}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border border-neutral/20 bg-white hover:bg-bg disabled:opacity-50 min-h-[56px] transition-colors"
                >
                  <span className="text-lg">🛒</span>
                  <div className="flex-1 text-start">
                    <p className="font-semibold text-sm">{list.name}</p>
                    <p className="text-xs text-text-secondary">
                      {(list.list_items || []).length} {isHe ? 'פריטים' : 'items'}{list.status === 'active' ? ` • ${isHe ? 'פעיל' : 'Active'}` : ''}
                    </p>
                  </div>
                </button>
              ))}
              <button
                onClick={() => handleAdd(null)}
                disabled={saving}
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors min-h-[56px] disabled:opacity-50"
              >
                <span className="text-lg">+</span>
                <p className="font-semibold text-sm text-primary">
                  {isHe ? 'רשימה חדשה' : 'New List'}
                </p>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
