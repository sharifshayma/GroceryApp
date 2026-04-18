import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { getCategoryName } from '../lib/categoryName'
import { useKeyboardVisible } from '../hooks/useKeyboardVisible'
import { useTags } from '../hooks/useTags'
import { supabase } from '../lib/supabase'
import { IconClose } from './Icons'
import Toggle from './Toggle'

const UNITS = ['pcs', 'kg', 'g', 'L', 'mL', 'pack', 'box', 'bottle', 'bag', 'bunch']

const EMOJI_SUGGESTIONS = [
  '🛒', '🥛', '🍞', '🧀', '🥩', '🍗', '🐟', '🥚',
  '🥬', '🍅', '🥕', '🍌', '🍎', '🫒', '🧈', '🍝',
  '🍚', '🫘', '🥜', '🍫', '🍪', '🍦', '☕', '🧃',
  '🥤', '🍷', '🧴', '🧹', '🧼', '💊', '🍕', '🌽',
  '🥑', '🍓', '🫐', '🍋', '🧅', '🥔', '🌶️', '🍯',
]

export default function AddItemModal({ categoryId, categories, item, onSave, onClose }) {
  const { t, i18n } = useTranslation()
  const isEdit = !!item
  const { tags } = useTags()
  const { isKeyboardVisible, viewportHeight } = useKeyboardVisible()

  const [name, setName] = useState(item?.name || '')
  const [selectedCategory, setSelectedCategory] = useState(item?.category_id || categoryId)
  const [emoji, setEmoji] = useState(item?.emoji || '🛒')
  const [unit, setUnit] = useState(item?.default_unit || 'pcs')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [autoTrackStock, setAutoTrackStock] = useState(item?.auto_track_stock ?? true)
  const [saving, setSaving] = useState(false)
  const hiddenEmojiRef = useRef(null)
  const [error, setError] = useState('')

  // Tags assignment
  const [assignedTagIds, setAssignedTagIds] = useState(new Set())

  useEffect(() => {
    if (!item?.id) return
    supabase
      .from('item_tags')
      .select('tag_id')
      .eq('item_id', item.id)
      .then(({ data }) => {
        if (data) setAssignedTagIds(new Set(data.map((d) => d.tag_id)))
      })
  }, [item?.id])

  const toggleTag = async (tagId) => {
    if (isEdit && item?.id) {
      // For existing items, toggle immediately in DB
      if (assignedTagIds.has(tagId)) {
        await supabase.from('item_tags').delete().eq('item_id', item.id).eq('tag_id', tagId)
        setAssignedTagIds((prev) => { const next = new Set(prev); next.delete(tagId); return next })
      } else {
        await supabase.from('item_tags').insert({ item_id: item.id, tag_id: tagId })
        setAssignedTagIds((prev) => new Set(prev).add(tagId))
      }
    } else {
      // For new items, just track in state (will be assigned after creation)
      setAssignedTagIds((prev) => {
        const next = new Set(prev)
        if (next.has(tagId)) next.delete(tagId)
        else next.add(tagId)
        return next
      })
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError('')

    try {
      const result = await onSave({
        name: name.trim(),
        category_id: selectedCategory,
        emoji,
        default_unit: unit,
        auto_track_stock: autoTrackStock,
      })
      // For new items, assign selected tags after creation
      if (!isEdit && result?.id && assignedTagIds.size > 0) {
        const inserts = [...assignedTagIds].map((tagId) => ({ item_id: result.id, tag_id: tagId }))
        await supabase.from('item_tags').insert(inserts)
      }
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[60] flex items-end sm:items-center justify-center"
      style={{ height: isKeyboardVisible ? `${viewportHeight}px` : `calc(100% - 4rem - env(safe-area-inset-bottom, 0px))` }}
    >
      <div className="absolute inset-0 bg-black/50 animate-backdrop" onClick={onClose} />

      <div className="relative bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-full flex flex-col animate-slide-up sm:animate-fade-in">
        {/* Header */}
        <div className="flex-shrink-0 bg-white rounded-t-3xl px-5 pt-5 pb-3 border-b border-neutral/50 flex items-center justify-between z-10">
          <h2 className="text-lg font-semibold text-text">
            {isEdit ? t('items.editItem') : t('items.addItem')}
          </h2>
          <button onClick={onClose} className="w-11 h-11 rounded-full bg-neutral/30 flex items-center justify-center text-text hover:bg-neutral/50 transition-colors">
            <IconClose />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Emoji + Name */}
          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="w-14 h-14 rounded-2xl bg-bg border border-neutral text-3xl flex items-center justify-center hover:border-primary/50 transition-colors"
              >
                {emoji}
              </button>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-text-secondary mb-1">
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

          {/* Emoji picker — tap to pick, or use keyboard for custom */}
          {showEmojiPicker && (
            <div className="p-3 bg-bg rounded-xl border border-neutral/30">
              <div className="grid grid-cols-8 gap-1.5">
                {EMOJI_SUGGESTIONS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => { setEmoji(e); setShowEmojiPicker(false) }}
                    className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center hover:bg-white transition-colors ${
                      emoji === e ? 'bg-white ring-2 ring-primary' : ''
                    }`}
                  >
                    {e}
                  </button>
                ))}
                {/* "Other" button — opens native keyboard for any emoji */}
                <button
                  type="button"
                  onClick={() => hiddenEmojiRef.current?.focus()}
                  className="w-10 h-10 rounded-lg text-xs font-medium text-primary flex items-center justify-center hover:bg-white transition-colors border border-dashed border-primary/30"
                >
                  ⌨️
                </button>
              </div>
              {/* Hidden input — only focused when user taps keyboard button */}
              <input
                ref={hiddenEmojiRef}
                type="text"
                value=""
                onChange={(e) => {
                  const val = e.target.value
                  const emojis = [...val].filter(ch => /\p{Emoji_Presentation}|\p{Extended_Pictographic}/u.test(ch))
                  if (emojis.length > 0) {
                    setEmoji(emojis[emojis.length - 1])
                    setShowEmojiPicker(false)
                  }
                }}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                className="w-0 h-0 opacity-0 absolute"
                aria-hidden="true"
              />
            </div>
          )}

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
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

          {/* Tags section */}
          {tags.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">
                {i18n.language === 'he' ? 'תגיות' : 'Tags'}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => {
                  const isAssigned = assignedTagIds.has(tag.id)
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        isAssigned ? 'text-white' : 'bg-bg border border-neutral/30 text-text-secondary'
                      }`}
                      style={isAssigned ? { backgroundColor: tag.color || '#F28B30' } : {}}
                    >
                      {tag.type === 'recipe' ? '🍽️' : tag.type === 'store' ? '🏪' : '🏷️'}
                      {' '}{tag.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Auto-track stock */}
          <div className="flex items-center justify-between py-1">
            <div>
              <label className="block text-xs font-medium text-text-secondary">
                {i18n.language === 'he' ? 'עדכון מלאי אוטומטי' : 'Auto-update stock'}
              </label>
              <p className="text-xs text-text-secondary/70 mt-0.5">
                {i18n.language === 'he' ? 'עדכן כמות במלאי בעת קנייה' : 'Update stock quantity when bought'}
              </p>
            </div>
            <Toggle
              checked={autoTrackStock}
              onChange={() => setAutoTrackStock(!autoTrackStock)}
              ariaLabel="auto-track stock"
            />
          </div>

          {/* Unit */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              {t('items.unit')}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {UNITS.map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUnit(u)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    unit === u
                      ? 'bg-primary text-white'
                      : 'bg-bg border border-neutral/30 text-text-secondary hover:text-text'
                  }`}
                >
                  {t(`units.${u}`, u)}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-danger text-sm font-medium">{error}</p>}

          {/* Submit */}
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="w-full py-3.5 rounded-xl bg-primary text-white font-medium text-lg hover:bg-primary-light active:bg-primary-dark transition-colors disabled:opacity-50 min-h-[48px]"
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
