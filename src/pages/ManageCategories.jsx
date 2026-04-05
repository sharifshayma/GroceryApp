import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useCategories } from '../hooks/useCategories'
import { getCategoryName } from '../lib/categoryName'

const EMOJI_OPTIONS = ['📦', '🥬', '🥜', '🥚', '🧀', '🥩', '🥗', '🍞', '🫙', '🍫', '🍪', '🍦', '🧊', '☕', '🥤', '🍷', '🍼', '🐾', '🧹', '🧴', '💊', '👕', '🛒', '🍽️', '🧂', '🫒', '🥫', '🧃', '🏠', '✨']

export default function ManageCategories() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { categories, refetch } = useCategories()
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [name, setName] = useState('')
  const [nameHe, setNameHe] = useState('')
  const [emoji, setEmoji] = useState('📦')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const resetForm = () => {
    setName('')
    setNameHe('')
    setEmoji('📦')
    setShowEmojiPicker(false)
    setAdding(false)
    setEditingId(null)
    setError('')
  }

  const startEdit = (cat) => {
    setEditingId(cat.id)
    setName(cat.name)
    setNameHe(cat.name_he || '')
    setEmoji(cat.emoji)
    setAdding(false)
  }

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    setError('')

    try {
      if (editingId) {
        const { error: err } = await supabase
          .from('categories')
          .update({ name: name.trim(), name_he: nameHe.trim() || null, emoji })
          .eq('id', editingId)
        if (err) throw err
      } else {
        const maxOrder = categories.reduce((max, c) => Math.max(max, c.sort_order), 0)
        const { error: err } = await supabase
          .from('categories')
          .insert({
            household_id: profile.household_id,
            name: name.trim(),
            name_he: nameHe.trim() || null,
            emoji,
            sort_order: maxOrder + 1,
            is_default: false,
          })
        if (err) throw err
      }
      await refetch()
      resetForm()
    } catch (err) {
      setError(err.message)
    }
    setSaving(false)
  }

  const handleDelete = async (cat) => {
    if (cat.is_default) return
    if (!window.confirm(`Delete "${getCategoryName(cat)}"?`)) return

    await supabase.from('categories').delete().eq('id', cat.id)
    await refetch()
  }

  const moveCategory = async (cat, direction) => {
    const idx = categories.findIndex((c) => c.id === cat.id)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= categories.length) return

    const other = categories[swapIdx]
    await Promise.all([
      supabase.from('categories').update({ sort_order: other.sort_order }).eq('id', cat.id),
      supabase.from('categories').update({ sort_order: cat.sort_order }).eq('id', other.id),
    ])
    await refetch()
  }

  const isFormOpen = adding || editingId

  return (
    <div className="min-h-dvh bg-bg">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-3 max-w-lg mx-auto">
        <button
          onClick={() => navigate('/profile')}
          className="w-10 h-10 rounded-xl bg-surface border border-neutral flex items-center justify-center text-text-secondary hover:text-text transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h1 className="text-xl font-extrabold">{t('profile.manageCategories')}</h1>
      </div>

      <div className="px-4 pb-8 max-w-lg mx-auto">
        {/* Add / Edit form */}
        {isFormOpen && (
          <div className="bg-surface rounded-2xl border border-neutral p-4 mb-4 animate-fade-in space-y-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="w-12 h-12 rounded-xl bg-bg border border-neutral text-2xl flex items-center justify-center"
              >
                {emoji}
              </button>
              <div className="flex-1 space-y-2">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Category name (English)"
                  className="w-full px-3 py-2 rounded-xl border border-neutral bg-bg text-text text-sm placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                <input
                  type="text"
                  value={nameHe}
                  onChange={(e) => setNameHe(e.target.value)}
                  placeholder="שם קטגוריה (עברית)"
                  dir="rtl"
                  className="w-full px-3 py-2 rounded-xl border border-neutral bg-bg text-text text-sm placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>

            {showEmojiPicker && (
              <div className="grid grid-cols-8 gap-1.5 p-3 bg-bg rounded-xl border border-neutral/40">
                {EMOJI_OPTIONS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => { setEmoji(e); setShowEmojiPicker(false) }}
                    className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center hover:bg-surface transition-colors ${
                      emoji === e ? 'bg-primary/10 ring-2 ring-primary' : ''
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}

            {error && <p className="text-danger text-sm">{error}</p>}

            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving || !name.trim()}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white font-semibold text-sm disabled:opacity-50 min-h-[44px]"
              >
                {saving ? t('items.saving') : t('common.save')}
              </button>
              <button
                onClick={resetForm}
                className="px-4 py-2.5 rounded-xl text-text-secondary font-semibold text-sm min-h-[44px]"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}

        {/* Add button */}
        {!isFormOpen && (
          <button
            onClick={() => setAdding(true)}
            className="w-full py-3 rounded-xl border-2 border-dashed border-primary/40 text-primary font-semibold mb-4 hover:bg-primary/5 transition-colors"
          >
            + {t('common.add')}
          </button>
        )}

        {/* Category list */}
        <div className="space-y-2">
          {categories.map((cat, idx) => (
            <div
              key={cat.id}
              className={`bg-white rounded-xl border shadow-sm p-3.5 flex items-center gap-3 transition-colors ${
                editingId === cat.id ? 'border-primary' : 'border-neutral/20'
              }`}
            >
              {/* Reorder arrows */}
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => moveCategory(cat, 'up')}
                  disabled={idx === 0}
                  className="w-9 h-9 rounded-lg text-text-secondary hover:text-text hover:bg-neutral/20 disabled:opacity-20 flex items-center justify-center transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                  </svg>
                </button>
                <button
                  onClick={() => moveCategory(cat, 'down')}
                  disabled={idx === categories.length - 1}
                  className="w-9 h-9 rounded-lg text-text-secondary hover:text-text hover:bg-neutral/20 disabled:opacity-20 flex items-center justify-center transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
              </div>

              <span className="text-2xl">{cat.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{getCategoryName(cat)}</p>
                {cat.is_default && (
                  <span className="text-xs text-text-secondary">Default</span>
                )}
              </div>

              {/* Actions */}
              <button
                onClick={() => startEdit(cat)}
                className="w-10 h-10 rounded-lg text-text-secondary hover:text-primary hover:bg-primary/10 flex items-center justify-center transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
              </button>
              {!cat.is_default && (
                <button
                  onClick={() => handleDelete(cat)}
                  className="w-10 h-10 rounded-lg text-text-secondary hover:text-danger hover:bg-danger/10 flex items-center justify-center transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
