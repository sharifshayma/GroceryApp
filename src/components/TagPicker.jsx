import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useTags } from '../hooks/useTags'
import { useKeyboardVisible } from '../hooks/useKeyboardVisible'

const TYPE_ICONS = { recipe: '🍽️', store: '🏪', custom: '🏷️' }

export default function TagPicker({ itemId, onClose }) {
  const { t, i18n } = useTranslation()
  const { tags, recipeTags, storeTags, customTags } = useTags()
  const [assignedTags, setAssignedTags] = useState([]) // { tag_id, notes }
  const [loading, setLoading] = useState(true)
  const [editingNotes, setEditingNotes] = useState(null)
  const [noteText, setNoteText] = useState('')
  const isKeyboardVisible = useKeyboardVisible()
  const scrollRef = useRef(null)

  useEffect(() => {
    if (!itemId) return
    supabase
      .from('item_tags')
      .select('tag_id, notes')
      .eq('item_id', itemId)
      .then(({ data }) => {
        if (data) setAssignedTags(data)
        setLoading(false)
      })
  }, [itemId])

  const isAssigned = (tagId) => assignedTags.some((at) => at.tag_id === tagId)
  const getNote = (tagId) => assignedTags.find((at) => at.tag_id === tagId)?.notes || ''

  const toggleTag = async (tagId) => {
    if (isAssigned(tagId)) {
      await supabase.from('item_tags').delete().eq('item_id', itemId).eq('tag_id', tagId)
      setAssignedTags((prev) => prev.filter((at) => at.tag_id !== tagId))
    } else {
      await supabase.from('item_tags').insert({ item_id: itemId, tag_id: tagId })
      setAssignedTags((prev) => [...prev, { tag_id: tagId, notes: null }])
    }
  }

  const saveNote = async (tagId) => {
    const noteValue = noteText.trim() || null
    const { error } = await supabase
      .from('item_tags')
      .update({ notes: noteValue })
      .eq('item_id', itemId)
      .eq('tag_id', tagId)

    if (error) {
      console.error('Failed to save note:', error.message)
      return
    }

    setAssignedTags((prev) =>
      prev.map((at) => (at.tag_id === tagId ? { ...at, notes: noteValue } : at))
    )
    setEditingNotes(null)
    setNoteText('')
  }

  const groups = [
    { label: i18n.language === 'he' ? 'מתכונים' : 'Recipes', icon: '🍽️', items: recipeTags },
    { label: i18n.language === 'he' ? 'חנויות' : 'Stores', icon: '🏪', items: storeTags },
    { label: i18n.language === 'he' ? 'מותאם' : 'Custom', icon: '🏷️', items: customTags },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 animate-backdrop" onClick={onClose} />
      <div
        ref={scrollRef}
        className="relative bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[85vh] min-h-[50vh] overflow-y-auto animate-slide-up sm:animate-fade-in"
        style={{ paddingBottom: isKeyboardVisible ? '40vh' : 'env(safe-area-inset-bottom, 16px)' }}
      >
        <div className="sticky top-0 bg-white rounded-t-3xl px-5 pt-5 pb-3 border-b border-neutral/50 flex items-center justify-between z-10">
          <h2 className="text-lg font-extrabold text-text">
            {i18n.language === 'he' ? 'תגיות' : 'Tags'}
          </h2>
          <button onClick={onClose} className="w-11 h-11 rounded-full bg-neutral/30 flex items-center justify-center text-text hover:bg-neutral/50 transition-colors text-xl font-medium">×</button>
        </div>

        <div className="p-4 pb-20 space-y-4">
          {tags.length === 0 ? (
            <p className="text-center text-text-secondary py-6">
              {i18n.language === 'he' ? 'אין תגיות. צור תגיות בפרופיל.' : 'No tags yet. Create tags in Profile.'}
            </p>
          ) : (
            groups.map((group) => {
              if (group.items.length === 0) return null
              return (
                <div key={group.label}>
                  <h3 className="text-xs font-bold text-text-secondary mb-2">
                    {group.icon} {group.label}
                  </h3>
                  <div className="space-y-1.5">
                    {group.items.map((tag) => {
                      const assigned = isAssigned(tag.id)
                      return (
                        <div key={tag.id}>
                          <button
                            onClick={() => toggleTag(tag.id)}
                            className={`w-full flex items-center gap-3 p-3.5 rounded-xl border transition-colors min-h-[48px] ${
                              assigned ? 'border-primary bg-primary/5' : 'border-neutral/30 bg-white'
                            }`}
                          >
                            <div
                              className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                assigned ? 'bg-primary border-primary text-white' : 'border-neutral'
                              }`}
                            >
                              {assigned && (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                              )}
                            </div>
                            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                            <span className="flex-1 text-sm font-medium text-start">{tag.name}</span>
                            {assigned && editingNotes !== tag.id && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setEditingNotes(tag.id)
                                  setNoteText(getNote(tag.id))
                                }}
                                className="text-xs text-primary px-3 py-2 min-h-[36px] flex items-center max-w-[40%] truncate"
                              >
                                {getNote(tag.id)
                                  ? `📝 ${getNote(tag.id)}`
                                  : (i18n.language === 'he' ? '+ הערה' : '+ Note')}
                              </button>
                            )}
                          </button>

                          {/* Note below the tag row */}
                          {assigned && getNote(tag.id) && editingNotes !== tag.id && (
                            <div className="ms-10 mt-1 px-3 py-1.5 bg-secondary-light/30 rounded-lg">
                              <p className="text-xs text-text-secondary">📝 {getNote(tag.id)}</p>
                            </div>
                          )}

                          {editingNotes === tag.id && (
                            <div className="flex gap-2 mt-2 px-1">
                              <input
                                type="text"
                                value={noteText}
                                onChange={(e) => setNoteText(e.target.value)}
                                placeholder={i18n.language === 'he' ? 'הערה לתגית...' : 'Note for this tag...'}
                                autoFocus
                              onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)}
                                className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-neutral/40 bg-bg text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                              />
                              <button
                                onClick={() => saveNote(tag.id)}
                                className="flex-shrink-0 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold min-h-[44px]"
                              >
                                {t('common.save')}
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
