import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { IconCheck } from './Icons'

export default function UpdateStockModal({ listItems, onUpdateStock, onClose }) {
  const { i18n } = useTranslation()

  // Only bought items that haven't been stock-updated yet
  const eligibleItems = listItems.filter((li) => li.is_bought && !li.stock_updated)

  const [items, setItems] = useState(
    eligibleItems.map((li) => ({
      listItemId: li.id,
      itemId: li.item_id,
      name: li.items?.name || '?',
      emoji: li.items?.emoji || '🛒',
      quantity: li.quantity,
      unit: li.unit,
      included: true,
    }))
  )
  const [saving, setSaving] = useState(false)

  const toggleInclude = (idx) => {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, included: !item.included } : item))
  }

  const updateQty = (idx, qty) => {
    if (qty < 0) return
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, quantity: qty } : item))
  }

  const handleUpdate = async () => {
    setSaving(true)
    const toUpdate = items.filter((item) => item.included && item.quantity > 0)

    await onUpdateStock(toUpdate)

    // Mark all eligible items as stock_updated (even excluded ones get skipped, only included ones are marked)
    const listItemIds = toUpdate.map((item) => item.listItemId)
    if (listItemIds.length > 0) {
      await supabase
        .from('list_items')
        .update({ stock_updated: true })
        .in('id', listItemIds)
    }

    onClose()
  }

  if (eligibleItems.length === 0) {
    return (
      <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
        <div className="absolute inset-0 bg-black/50 animate-backdrop" onClick={onClose} />
        <div className="relative bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md animate-slide-up sm:animate-fade-in"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
        >
          <div className="p-5 text-center">
            <span className="text-4xl block mb-3">✅</span>
            <p className="font-bold mb-1">
              {i18n.language === 'he' ? 'המלאי עודכן' : 'Stock Already Updated'}
            </p>
            <p className="text-sm text-text-secondary mb-4">
              {i18n.language === 'he' ? 'כל הפריטים שנקנו כבר עודכנו במלאי.' : 'All bought items have already been synced to stock.'}
            </p>
            <button onClick={onClose} className="px-6 py-2.5 rounded-xl bg-primary text-white font-semibold">
              {i18n.language === 'he' ? 'סגור' : 'Close'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 animate-backdrop" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[85vh] overflow-y-auto animate-slide-up sm:animate-fade-in"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
      >
        <div className="sticky top-0 bg-white rounded-t-3xl px-5 pt-5 pb-3 border-b border-neutral/50 flex items-center justify-between z-10">
          <h2 className="text-lg font-extrabold text-text">
            {i18n.language === 'he' ? 'עדכון מלאי' : 'Update Stock'}
          </h2>
          <button onClick={onClose} className="w-11 h-11 rounded-full bg-neutral/30 flex items-center justify-center text-text hover:bg-neutral/50 transition-colors text-xl font-medium">×</button>
        </div>

        <div className="p-4 pb-20">
          <p className="text-sm text-text-secondary mb-3">
            {i18n.language === 'he'
              ? 'בחר פריטים לעדכון במלאי והתאם כמויות:'
              : 'Select items to update in stock and adjust quantities:'}
          </p>

          <div className="space-y-2 mb-4">
            {items.map((item, idx) => (
              <div
                key={item.listItemId}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                  item.included ? 'border-green/30 bg-green/5' : 'border-neutral/20 opacity-50'
                }`}
              >
                <button
                  onClick={() => toggleInclude(idx)}
                  className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    item.included ? 'bg-green border-green text-white' : 'border-neutral'
                  }`}
                >
                  {item.included && <IconCheck />}
                </button>
                <span className="text-lg">{item.emoji}</span>
                <span className="flex-1 text-sm font-medium truncate">{item.name}</span>
                {item.included && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => updateQty(idx, item.quantity - 1)}
                      className="w-8 h-8 rounded-lg bg-neutral/30 flex items-center justify-center text-sm font-bold"
                    >−</button>
                    <span className="w-8 text-center font-bold text-sm">{item.quantity}</span>
                    <button
                      onClick={() => updateQty(idx, item.quantity + 1)}
                      className="w-8 h-8 rounded-lg bg-green text-white flex items-center justify-center text-sm font-bold"
                    >+</button>
                  </div>
                )}
                <span className="text-xs text-text-secondary">{item.unit}</span>
              </div>
            ))}
          </div>

          <button
            onClick={handleUpdate}
            disabled={saving || items.every((i) => !i.included)}
            className="w-full py-3.5 rounded-xl bg-green-dark text-white font-bold text-lg disabled:opacity-50 min-h-[48px]"
          >
            {saving
              ? (i18n.language === 'he' ? 'מעדכן...' : 'Updating...')
              : `${i18n.language === 'he' ? 'עדכן מלאי' : 'Update Stock'} (${items.filter((i) => i.included).length})`}
          </button>
        </div>
      </div>
    </div>
  )
}
