import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function AddToListModal({ item, lists, onAddToList, onCreateAndAdd, onClose }) {
  const { i18n } = useTranslation()
  const [quantity, setQuantity] = useState(1)
  const [step, setStep] = useState('quantity') // 'quantity' | 'pickList'
  const [saving, setSaving] = useState(false)

  // Only draft/active lists
  const openLists = lists.filter((l) => l.status === 'draft' || l.status === 'active')

  const handleAdd = async (listId) => {
    setSaving(true)
    if (listId) {
      await onAddToList(listId, { item_id: item.id, quantity, unit: item.default_unit || 'pcs' })
    } else {
      await onCreateAndAdd({ item_id: item.id, quantity, unit: item.default_unit || 'pcs' })
    }
    onClose()
  }

  const handleNext = () => {
    if (openLists.length === 0) {
      handleAdd(null) // create new
    } else if (openLists.length === 1) {
      handleAdd(openLists[0].id) // add to only list
    } else {
      setStep('pickList') // let user choose
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 animate-backdrop" onClick={onClose} />
      <div
        className="relative bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md animate-slide-up sm:animate-fade-in"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
      >
        <div className="px-5 pt-5 pb-3 border-b border-neutral/50 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-text">
            {step === 'quantity'
              ? (i18n.language === 'he' ? 'הוסף לרשימה' : 'Add to List')
              : (i18n.language === 'he' ? 'בחר רשימה' : 'Choose List')}
          </h2>
          <button onClick={onClose} className="w-11 h-11 rounded-full bg-neutral/30 flex items-center justify-center text-text hover:bg-neutral/50 transition-colors text-xl font-medium">×</button>
        </div>

        <div className="p-4 pb-6">
          {step === 'quantity' ? (
            <div className="space-y-4">
              {/* Item display */}
              <div className="flex items-center gap-3 p-3.5 bg-bg rounded-xl border border-primary/30">
                <span className="text-3xl">{item.emoji || '🛒'}</span>
                <div>
                  <p className="font-bold">{item.name}</p>
                  <p className="text-xs text-text-secondary">{item.default_unit || 'pcs'}</p>
                </div>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-sm font-semibold mb-1">
                  {i18n.language === 'he' ? 'כמות' : 'Quantity'}
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-12 h-12 rounded-xl bg-neutral/30 flex items-center justify-center font-bold text-lg active:scale-90 transition-transform"
                  >−</button>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                    className="w-20 px-3 py-2 rounded-xl border border-neutral bg-surface text-text text-center text-lg font-bold"
                  />
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center font-bold text-lg active:scale-90 transition-transform"
                  >+</button>
                </div>
              </div>

              <button
                onClick={handleNext}
                disabled={saving}
                className="w-full py-3.5 rounded-xl bg-primary text-white font-bold text-lg disabled:opacity-50 min-h-[48px]"
              >
                {saving
                  ? (i18n.language === 'he' ? 'מוסיף...' : 'Adding...')
                  : openLists.length === 0
                    ? (i18n.language === 'he' ? 'צור רשימה והוסף' : 'Create List & Add')
                    : (i18n.language === 'he' ? 'הוסף לרשימה' : 'Add to List')}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {openLists.map((list) => (
                <button
                  key={list.id}
                  onClick={() => handleAdd(list.id)}
                  disabled={saving}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border border-neutral/20 bg-white hover:bg-bg transition-colors min-h-[56px] disabled:opacity-50"
                >
                  <span className="text-lg">🛒</span>
                  <div className="flex-1 text-start">
                    <p className="font-semibold text-sm">{list.name}</p>
                    <p className="text-xs text-text-secondary">
                      {(list.list_items || []).length} {i18n.language === 'he' ? 'פריטים' : 'items'}
                      {list.status === 'active' && ` • ${i18n.language === 'he' ? 'פעיל' : 'Active'}`}
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
                  {i18n.language === 'he' ? 'רשימה חדשה' : 'New List'}
                </p>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
