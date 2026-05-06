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
  onClose,
}) {
  const { i18n } = useTranslation()
  const isHe = i18n.language === 'he'
  const [step, setStep] = useState('quantity') // 'quantity' | 'pickList'
  const [saving, setSaving] = useState(false)

  // Local stock state, kept in sync with the prop
  const [stockQty, setStockQty] = useState(stockRow?.quantity ?? 0)
  const [stockThreshold, setStockThreshold] = useState(stockRow?.low_threshold ?? 1)
  const [trackingExpanded, setTrackingExpanded] = useState(false)
  useEffect(() => {
    setStockQty(stockRow?.quantity ?? 0)
    setStockThreshold(stockRow?.low_threshold ?? 1)
    if (stockRow) setTrackingExpanded(false)
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

  const hasStock = !!stockRow && stockRow.quantity > 0
  const isLowStock = !!stockRow && stockRow.quantity > 0 && stockRow.quantity <= stockRow.low_threshold

  const handleAdd = async (listId) => {
    setSaving(true)
    try {
      const payload = { item_id: item.id, quantity: 1, unit: item.default_unit || 'pcs' }
      if (listId) {
        await onAddToList(listId, payload)
      } else {
        await onCreateAndAdd(payload)
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
    if (stockRow) await onUpdateStockQuantity(stockRow.id, safe)
    // When untracked, just update local state — wait for Save in the tracking flow.
  }

  const commitThreshold = async (newT) => {
    const safe = Math.max(0, newT)
    setStockThreshold(safe)
    if (stockRow) await onUpdateStockThreshold(stockRow.id, safe)
  }

  const startTrackingFlow = () => {
    setStockQty(0)
    setStockThreshold(1)
    setTrackingExpanded(true)
  }

  const cancelTrackingFlow = () => {
    setTrackingExpanded(false)
    setStockQty(0)
    setStockThreshold(1)
  }

  const saveNewStock = async () => {
    setSaving(true)
    try {
      await onAddToStock(item.id, stockQty, item.default_unit || 'pcs', stockThreshold || 1)
      // Effect on stockRow change will collapse the form
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 animate-backdrop" onClick={onClose} />
      <div
        className="relative bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[85vh] overflow-y-auto animate-slide-up sm:animate-fade-in"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
      >
        <div className="px-5 pt-5 pb-3 border-b border-neutral/50 flex items-center justify-between gap-3">
          {step === 'quantity' ? (
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-2xl flex-shrink-0">{item.emoji || '🛒'}</span>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-text truncate">{item.name}</h2>
                <p className="text-xs text-text-secondary">{item.default_unit || 'pcs'}</p>
              </div>
            </div>
          ) : (
            <h2 className="text-lg font-semibold text-text">
              {isHe ? 'בחר רשימה' : 'Choose List'}
            </h2>
          )}
          <button onClick={onClose} className="w-11 h-11 rounded-full bg-neutral/30 flex items-center justify-center text-text hover:bg-neutral/50 transition-colors text-xl font-medium flex-shrink-0">×</button>
        </div>

        <div className="p-4 pb-20">
          {step === 'quantity' ? (
            <div className="space-y-5">
              {/* Stock section */}
              {stockEnabled && (
                <section>
                  <div className="flex items-baseline justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">📦</span>
                      <h3 className="text-sm font-semibold">{isHe ? 'מלאי בבית' : 'Stock at home'}</h3>
                    </div>
                    <p className="text-xs text-text-secondary">
                      {isHe ? 'כמה יש לך' : 'How much you have'}
                    </p>
                  </div>
                  <div className={`p-3 rounded-xl border ${isLowStock ? 'bg-primary/5 border-primary/30' : 'bg-bg border-neutral/30'}`}>
                    <p className="text-sm font-medium text-text mb-3">
                      {hasStock
                        ? (isHe
                          ? `יש לך ${stockRow.quantity} ${stockRow.unit}${isLowStock ? ' · המלאי נמוך' : ''}`
                          : `You have ${stockRow.quantity} ${stockRow.unit}${isLowStock ? ' · running low' : ''}`)
                        : stockRow
                          ? (isHe ? 'אזל מהמלאי' : 'Out of stock')
                          : trackingExpanded
                            ? (isHe ? 'הגדר מעקב מלאי' : 'Set up stock tracking')
                            : (isHe ? 'עדיין לא במעקב מלאי' : 'Not tracked in stock yet')}
                    </p>

                    {(stockRow || trackingExpanded) && (
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-text-secondary w-24">
                            {isHe ? 'כמות בבית' : 'Quantity at home'}
                          </span>
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
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-text-secondary w-24">
                            {isHe ? 'התראה כש-' : 'Alert me at'}
                          </span>
                          <input
                            type="number"
                            value={stockThreshold}
                            onChange={(e) => setStockThreshold(Math.max(0, Number(e.target.value)))}
                            onBlur={() => commitThreshold(stockThreshold)}
                            className="w-14 px-2 py-1.5 rounded-lg border border-neutral bg-surface text-text text-center text-sm"
                          />
                          <span className="text-xs text-text-secondary">
                            {isHe ? 'או פחות' : 'or below'}
                          </span>
                        </div>
                      </div>
                    )}

                    {!stockRow && !trackingExpanded && (
                      <button
                        onClick={startTrackingFlow}
                        disabled={saving}
                        className="w-full py-2.5 rounded-xl bg-white border border-primary/30 text-primary text-sm font-medium hover:bg-primary/10 disabled:opacity-50"
                      >
                        {isHe ? 'התחל מעקב מלאי' : 'Track stock'}
                      </button>
                    )}

                    {!stockRow && trackingExpanded && (
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={saveNewStock}
                          disabled={saving}
                          className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-medium disabled:opacity-50"
                        >
                          {saving ? (isHe ? 'שומר...' : 'Saving...') : (isHe ? 'שמור' : 'Save')}
                        </button>
                        <button
                          onClick={cancelTrackingFlow}
                          disabled={saving}
                          className="px-4 py-2.5 rounded-xl bg-white border border-neutral text-text-secondary text-sm font-medium disabled:opacity-50"
                        >
                          {isHe ? 'ביטול' : 'Cancel'}
                        </button>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Lists section */}
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">📋</span>
                  <h3 className="text-sm font-semibold">{isHe ? 'רשימות' : 'Lists'}</h3>
                </div>

                {listsContaining.length > 0 ? (
                  <div className="space-y-2">
                    {listsContaining.map((list) => (
                      <div
                        key={list.id}
                        className="flex items-center gap-2 p-3 rounded-xl bg-primary/5 border border-primary/20"
                      >
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
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-bg border border-neutral/30">
                    <p className="text-sm text-text-secondary">
                      {isHe ? 'כרגע לא ברשימה' : 'Not currently in any list'}
                    </p>
                  </div>
                )}

                {/* CTA for adding (or adding to another list) */}
                {!alreadyInAllOpen && (
                  <button
                    onClick={handleNext}
                    disabled={saving}
                    className="mt-3 w-full py-3.5 rounded-xl bg-primary text-white font-medium text-lg disabled:opacity-50 min-h-[48px]"
                  >
                    {saving
                      ? (isHe ? 'מוסיף...' : 'Adding...')
                      : openLists.length === 0
                        ? (isHe ? 'צור רשימה והוסף' : 'Create List & Add')
                        : listsContaining.length > 0
                          ? (isHe ? 'הוסף לרשימה נוספת' : 'Add to another list')
                          : (isHe ? 'הוסף לרשימה' : 'Add to List')}
                  </button>
                )}
              </section>
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
