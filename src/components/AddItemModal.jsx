import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getCategoryName } from '../lib/categoryName'
import { useKeyboardVisible } from '../hooks/useKeyboardVisible'

const UNITS = ['pcs', 'kg', 'g', 'L', 'mL', 'pack', 'box', 'bottle', 'bag', 'bunch']

const EMOJI_OPTIONS = ['🛒', '🥛', '🍞', '🧀', '🥩', '🍗', '🐟', '🥚', '🥬', '🍅', '🥕', '🍌', '🍎', '🫒', '🧈', '🍝', '🍚', '🫘', '🥜', '🍫', '🍪', '🍦', '☕', '🧃', '🥤', '🍷', '🧴', '🧹', '🧼', '💊']

export default function AddItemModal({ categoryId, categories, item, onSave, onClose }) {
  const { t } = useTranslation()
  const isEdit = !!item

  const [name, setName] = useState(item?.name || '')
  const [selectedCategory, setSelectedCategory] = useState(item?.category_id || categoryId)
  const [emoji, setEmoji] = useState(item?.emoji || '🛒')
  const [unit, setUnit] = useState(item?.default_unit || 'pcs')
  const [notes, setNotes] = useState(item?.notes || '')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const isKeyboardVisible = useKeyboardVisible()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError('')

    try {
      await onSave({
        name: name.trim(),
        category_id: selectedCategory,
        emoji,
        default_unit: unit,
        notes: notes.trim() || null,
      })
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 animate-backdrop" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[90vh] min-h-[50vh] overflow-y-auto animate-slide-up sm:animate-fade-in"
        style={{ paddingBottom: isKeyboardVisible ? '40vh' : 'env(safe-area-inset-bottom, 16px)' }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white rounded-t-3xl px-5 pt-5 pb-3 border-b border-neutral/50 flex items-center justify-between z-10">
          <h2 className="text-lg font-extrabold text-text">
            {isEdit ? t('items.editItem') : t('items.addItem')}
          </h2>
          <button
            onClick={onClose}
            className="w-11 h-11 rounded-full bg-neutral/30 flex items-center justify-center text-text hover:bg-neutral/50 transition-colors text-xl font-medium"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 pb-20 space-y-4">
          {/* Emoji picker */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="w-14 h-14 rounded-2xl bg-surface border border-neutral text-3xl flex items-center justify-center hover:border-primary/50 transition-colors"
            >
              {emoji}
            </button>
            <div className="flex-1">
              <label className="block text-sm font-semibold text-text mb-1">
                {t('items.name')}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('items.namePlaceholder')}
                required
                autoFocus
                className="w-full px-3 py-2.5 rounded-xl border border-neutral/40 bg-bg text-text placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>

          {/* Emoji grid */}
          {showEmojiPicker && (
            <div className="grid grid-cols-8 gap-1.5 p-3 bg-white rounded-xl border border-neutral/40">
              {EMOJI_OPTIONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => { setEmoji(e); setShowEmojiPicker(false) }}
                  className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center hover:bg-bg transition-colors ${
                    emoji === e ? 'bg-primary/10 ring-2 ring-primary' : ''
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          )}

          {/* Category */}
          <div>
            <label className="block text-sm font-semibold text-text mb-1">
              {t('items.category')}
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-neutral/40 bg-bg text-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.emoji} {getCategoryName(cat)}
                </option>
              ))}
            </select>
          </div>

          {/* Unit */}
          <div>
            <label className="block text-sm font-semibold text-text mb-1">
              {t('items.unit')}
            </label>
            <div className="flex flex-wrap gap-2">
              {UNITS.map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUnit(u)}
                  className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    unit === u
                      ? 'bg-primary text-white'
                      : 'bg-white border border-neutral/40 text-text-secondary hover:text-text'
                  }`}
                >
                  {t(`units.${u}`, u)}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-text mb-1">
              {t('items.notes')}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('items.notesPlaceholder')}
              rows={2}
              onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)}
              className="w-full px-3 py-2.5 rounded-xl border border-neutral/40 bg-bg text-text placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
            />
          </div>

          {error && <p className="text-danger text-sm font-medium">{error}</p>}

          {/* Submit */}
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="w-full py-3.5 rounded-xl bg-primary text-white font-bold text-lg hover:bg-primary-light active:bg-primary-dark transition-colors disabled:opacity-50 min-h-[48px]"
          >
            {saving
              ? t('items.saving')
              : isEdit
                ? t('common.save')
                : t('items.addItem')}
          </button>
        </form>
      </div>
    </div>
  )
}
