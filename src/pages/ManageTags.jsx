import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useTags } from '../hooks/useTags'
import { useItems } from '../hooks/useItems'
import { supabase } from '../lib/supabase'
import { IconBack, IconTrash } from '../components/Icons'

const TAG_TYPES = ['recipe', 'store', 'custom']
const TYPE_ICONS = { recipe: '🍽️', store: '🏪', custom: '🏷️' }
const TYPE_LABELS = {
  en: { recipe: 'Recipe', store: 'Store', custom: 'Custom' },
  he: { recipe: 'מתכון', store: 'חנות', custom: 'מותאם' },
}
const DEFAULT_COLORS = { recipe: '#E8C840', store: '#8BC34A', custom: '#F28B30' }

export default function ManageTags() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { tags, recipeTags, storeTags, customTags, createTag, updateTag, deleteTag, getTagUsageCount } = useTags()
  const { items: allItems } = useItems()

  // Which tag is being edited inline (null | 'new' | tagId)
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState('recipe')
  const [saving, setSaving] = useState(false)

  // Item assignment state for the active/editing tag
  const [tagItemIds, setTagItemIds] = useState(new Set())
  const [tagItemNotes, setTagItemNotes] = useState(new Map()) // Map<item_id, notes>
  const [editingNoteId, setEditingNoteId] = useState(null) // item_id being edited
  const [noteText, setNoteText] = useState('')
  const [showItemPicker, setShowItemPicker] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')

  // Fetch assigned items + notes when editing a tag
  useEffect(() => {
    if (!editingId || editingId === 'new') { setTagItemIds(new Set()); setTagItemNotes(new Map()); return }
    supabase
      .from('item_tags')
      .select('item_id, notes')
      .eq('tag_id', editingId)
      .then(({ data }) => {
        if (data) {
          setTagItemIds(new Set(data.map((d) => d.item_id)))
          const notes = new Map()
          data.forEach((d) => { if (d.notes) notes.set(d.item_id, d.notes) })
          setTagItemNotes(notes)
        } else {
          setTagItemIds(new Set())
          setTagItemNotes(new Map())
        }
      })
  }, [editingId])

  const startEdit = (tag) => {
    setEditingId(tag.id)
    setEditName(tag.name)
    setEditType(tag.type)
    setShowItemPicker(false)
  }

  const startNew = () => {
    setEditingId('new')
    setEditName('')
    setEditType('recipe')
    setShowItemPicker(false)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditName('')
    setShowItemPicker(false)
  }

  const handleSave = async () => {
    if (!editName.trim()) return
    setSaving(true)
    try {
      if (editingId === 'new') {
        const created = await createTag({ name: editName.trim(), type: editType, color: DEFAULT_COLORS[editType] })
        // Switch to editing the newly created tag so user can add items
        if (created) setEditingId(created.id)
      } else {
        await updateTag(editingId, { name: editName.trim(), type: editType, color: DEFAULT_COLORS[editType] })
      }
    } catch (err) {
      console.error(err)
    }
    setSaving(false)
  }

  const handleDelete = async (tag) => {
    const count = await getTagUsageCount(tag.id)
    const msg = count > 0
      ? (i18n.language === 'he'
          ? `התגית "${tag.name}" משויכת ל-${count} פריטים. למחוק?`
          : `"${tag.name}" is assigned to ${count} item${count > 1 ? 's' : ''}. Delete?`)
      : (i18n.language === 'he' ? `למחוק "${tag.name}"?` : `Delete "${tag.name}"?`)
    if (!window.confirm(msg)) return
    await deleteTag(tag.id)
    if (editingId === tag.id) cancelEdit()
  }

  const toggleItemAssignment = async (tagId, itemId) => {
    if (tagItemIds.has(itemId)) {
      await supabase.from('item_tags').delete().eq('item_id', itemId).eq('tag_id', tagId)
      setTagItemIds((prev) => { const next = new Set(prev); next.delete(itemId); return next })
      setTagItemNotes((prev) => { const next = new Map(prev); next.delete(itemId); return next })
    } else {
      await supabase.from('item_tags').insert({ item_id: itemId, tag_id: tagId })
      setTagItemIds((prev) => new Set(prev).add(itemId))
    }
  }

  const saveNote = async (tagId, itemId) => {
    const noteValue = noteText.trim() || null
    await supabase.from('item_tags').update({ notes: noteValue }).eq('item_id', itemId).eq('tag_id', tagId)
    setTagItemNotes((prev) => {
      const next = new Map(prev)
      if (noteValue) next.set(itemId, noteValue)
      else next.delete(itemId)
      return next
    })
    setEditingNoteId(null)
    setNoteText('')
  }

  const grouped = [
    { key: 'recipe', label: TYPE_LABELS[i18n.language]?.recipe || 'Recipe', icon: '🍽️', items: recipeTags },
    { key: 'store', label: TYPE_LABELS[i18n.language]?.store || 'Store', icon: '🏪', items: storeTags },
    { key: 'custom', label: TYPE_LABELS[i18n.language]?.custom || 'Custom', icon: '🏷️', items: customTags },
  ]

  const assignedItems = allItems.filter((i) => tagItemIds.has(i.id))
  const pickerItems = pickerSearch.trim()
    ? allItems.filter((i) => i.name?.toLowerCase().includes(pickerSearch.toLowerCase()) || i.name_he?.toLowerCase().includes(pickerSearch.toLowerCase()))
    : allItems

  // Renders the inline editable tag card (used for both existing tags being edited and new tags)
  const renderEditableCard = (tagId) => (
    <div className="bg-white rounded-xl border border-primary/30 shadow-sm overflow-hidden animate-fade-in">
      {/* Inline name + type */}
      <div className="p-3.5 space-y-3">
        <input
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={() => { if (editName.trim() && editingId !== 'new') handleSave() }}
          placeholder={i18n.language === 'he' ? 'שם התגית' : 'Tag name'}
          autoFocus
          className="w-full px-3 py-2 rounded-xl border border-neutral bg-bg text-text text-sm placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        />
        <div className="flex gap-2">
          {TAG_TYPES.map((tp) => (
            <button
              key={tp}
              onClick={() => setEditType(tp)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors min-h-[36px] ${
                editType === tp ? 'bg-primary text-white' : 'bg-bg border border-neutral/40 text-text-secondary'
              }`}
            >
              {TYPE_ICONS[tp]} {TYPE_LABELS[i18n.language]?.[tp] || tp}
            </button>
          ))}
        </div>

      </div>

      {/* Items section */}
      <div className="border-t border-neutral/20 px-3.5 py-3 bg-bg/50">
          {assignedItems.length === 0 ? (
            <p className="text-xs text-text-secondary text-center py-2">
              {i18n.language === 'he' ? 'אין פריטים משויכים' : 'No items assigned'}
            </p>
          ) : (
            <div className="space-y-1.5 mb-3">
              {assignedItems.map((item) => {
                const note = tagItemNotes.get(item.id)
                return (
                  <div key={item.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white border border-neutral/30">
                    <span className="text-base">{item.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium">{item.name}</span>
                      {note && editingNoteId !== item.id && (
                        <p className="text-[10px] text-primary italic truncate">{note}</p>
                      )}
                    </div>
                    <button
                      onClick={() => { setEditingNoteId(editingNoteId === item.id ? null : item.id); setNoteText(note || '') }}
                      className="text-[10px] text-text-secondary hover:text-primary px-1.5 py-0.5 flex-shrink-0"
                    >
                      {note ? '📝' : (i18n.language === 'he' ? '+ הערה' : '+ note')}
                    </button>
                    <button
                      onClick={() => toggleItemAssignment(tagId, item.id)}
                      className="text-text-secondary hover:text-danger flex-shrink-0 text-sm"
                    >
                      ×
                    </button>
                  </div>
                )
              })}
              {editingNoteId && (
                <div className="flex gap-2 px-1">
                  <input
                    type="text"
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder={i18n.language === 'he' ? 'הערה...' : 'Note...'}
                    autoFocus
                    className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-neutral/40 bg-bg text-text text-xs focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                  <button
                    onClick={() => saveNote(tagId, editingNoteId)}
                    className="flex-shrink-0 px-3 py-2 rounded-lg bg-primary text-white text-xs font-medium"
                  >
                    {t('common.save')}
                  </button>
                </div>
              )}
            </div>
          )}
          <button
            onClick={async () => {
              if (editingId === 'new' && editName.trim()) {
                // Auto-create the tag first, then open picker
                await handleSave()
              }
              setShowItemPicker(true)
              setPickerSearch('')
            }}
            disabled={!editName.trim()}
            className="w-full py-2 rounded-lg border border-dashed border-primary/30 text-primary text-xs font-medium hover:bg-primary/5 transition-colors disabled:opacity-40"
          >
            + {i18n.language === 'he' ? 'הוסף פריטים' : 'Add Items'}
          </button>

          {/* Done button */}
          <button
            onClick={cancelEdit}
            className="w-full mt-2 py-2 rounded-lg text-text-secondary text-xs font-medium hover:bg-neutral/10 transition-colors"
          >
            {i18n.language === 'he' ? 'סיום' : 'Done'}
          </button>
        </div>
    </div>
  )

  return (
    <div className="min-h-dvh bg-bg">
      <div className="px-4 pt-4 pb-3 flex items-center gap-3 max-w-lg mx-auto">
        <button
          onClick={() => navigate('/')}
          className="w-10 h-10 rounded-xl bg-surface border border-neutral flex items-center justify-center text-text-secondary hover:text-text transition-colors"
        >
          <IconBack />
        </button>
        <h1 className="text-xl font-semibold">{t('profile.manageTags')}</h1>
      </div>

      <div className="px-4 pb-8 max-w-lg mx-auto">
        {/* Add new tag — shows as empty editable card or dotted button */}
        {editingId === 'new' ? (
          <div className="mb-4">{renderEditableCard(null)}</div>
        ) : (
          <button
            onClick={startNew}
            className="w-full py-3 rounded-xl border-2 border-dashed border-primary/40 text-primary font-medium mb-4 hover:bg-primary/5 transition-colors"
          >
            + {t('common.add')}
          </button>
        )}

        {/* Tags grouped by type */}
        {grouped.map((group) => (
          <div key={group.key} className="mb-5">
            <h3 className="text-sm font-medium text-text-secondary mb-2 flex items-center gap-1.5">
              <span>{group.icon}</span>
              <span>{group.label}</span>
              <span className="text-xs font-normal">({group.items.length})</span>
            </h3>

            {group.items.length === 0 ? (
              <p className="text-xs text-text-secondary ps-6 mb-2">
                {i18n.language === 'he' ? 'אין תגיות עדיין' : 'No tags yet'}
              </p>
            ) : (
              <div className="space-y-2">
                {group.items.map((tag) => {
                  const isEditing = editingId === tag.id

                  if (isEditing) {
                    return <div key={tag.id}>{renderEditableCard(tag.id)}</div>
                  }

                  return (
                    <div key={tag.id} className="bg-white rounded-xl border border-neutral/20 shadow-sm p-3.5 flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color || '#3B82F6' }} />
                      <button
                        onClick={() => startEdit(tag)}
                        className="flex-1 min-w-0 text-start"
                      >
                        <p className="font-medium text-text truncate">{tag.name}</p>
                      </button>
                      <button onClick={() => startEdit(tag)} className="w-9 h-9 rounded-lg text-text-secondary hover:text-primary hover:bg-primary/10 flex items-center justify-center transition-colors flex-shrink-0">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                          <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21H3v-3.5L16.732 3.732z" />
                        </svg>
                      </button>
                      <button onClick={() => handleDelete(tag)} className="w-9 h-9 rounded-lg text-text-secondary hover:text-danger hover:bg-danger/10 flex items-center justify-center transition-colors flex-shrink-0">
                        <IconTrash className="w-4 h-4" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Item picker modal */}
      {showItemPicker && editingId && editingId !== 'new' && (
        <div
          className="fixed inset-x-0 top-0 z-50 flex items-end sm:items-center justify-center"
          style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="absolute inset-0 bg-black/50 animate-backdrop" onClick={() => setShowItemPicker(false)} />
          <div className="relative bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-full min-h-[50vh] flex flex-col animate-slide-up sm:animate-fade-in">
            <div className="flex-shrink-0 bg-white rounded-t-3xl px-5 pt-5 pb-3 border-b border-neutral/50 flex items-center justify-between z-10">
              <h2 className="text-lg font-semibold text-text">
                {i18n.language === 'he' ? 'הוסף פריטים' : 'Add Items'}
              </h2>
              <button onClick={() => setShowItemPicker(false)} className="w-11 h-11 rounded-full bg-neutral/30 flex items-center justify-center text-text hover:bg-neutral/50 transition-colors text-xl font-medium">×</button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <input
                type="text"
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder={t('items.search')}
                autoFocus
                className="w-full px-3 py-2.5 rounded-xl border border-neutral bg-surface text-text text-sm placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent mb-3"
              />
              {pickerItems.map((item) => {
                const isAssigned = tagItemIds.has(item.id)
                const note = tagItemNotes.get(item.id)
                return (
                  <div key={item.id}>
                    <button
                      onClick={() => toggleItemAssignment(editingId, item.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors min-h-[48px] ${
                        isAssigned ? 'bg-primary/10' : 'hover:bg-bg'
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        isAssigned ? 'bg-primary border-primary text-white' : 'border-neutral'
                      }`}>
                        {isAssigned && <span className="text-xs">✓</span>}
                      </span>
                      <span className="text-xl">{item.emoji}</span>
                      <div className="flex-1 text-start min-w-0">
                        <span className="text-sm font-medium">{item.name}</span>
                        {isAssigned && note && (
                          <p className="text-[10px] text-primary italic truncate">{note}</p>
                        )}
                      </div>
                      {isAssigned && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingNoteId(editingNoteId === item.id ? null : item.id); setNoteText(note || '') }}
                          className="text-[10px] text-text-secondary hover:text-primary px-2 py-1 flex-shrink-0"
                        >
                          {note ? '📝' : (i18n.language === 'he' ? '+ הערה' : '+ note')}
                        </button>
                      )}
                    </button>
                    {editingNoteId === item.id && isAssigned && (
                      <div className="flex gap-2 px-3 pb-2">
                        <input
                          type="text"
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          placeholder={i18n.language === 'he' ? 'הערה...' : 'Note...'}
                          autoFocus
                          className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-neutral/40 bg-bg text-text text-xs focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        />
                        <button
                          onClick={() => saveNote(editingId, item.id)}
                          className="flex-shrink-0 px-3 py-2 rounded-lg bg-primary text-white text-xs font-medium"
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
        </div>
      )}
    </div>
  )
}
