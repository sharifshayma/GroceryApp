import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useTags } from '../hooks/useTags'
import { useItems } from '../hooks/useItems'
import { supabase } from '../lib/supabase'
import { IconBack, IconEdit, IconTrash, IconChevronDown } from '../components/Icons'

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

  // Form state
  const [editing, setEditing] = useState(null) // null | 'new' | tag object
  const [name, setName] = useState('')
  const [type, setType] = useState('recipe')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Expand & item assignment state
  const [expandedTagId, setExpandedTagId] = useState(null)
  const [tagItemIds, setTagItemIds] = useState(new Set()) // item IDs assigned to expanded tag
  const [showItemPicker, setShowItemPicker] = useState(null) // null | tagId
  const [pickerSearch, setPickerSearch] = useState('')

  // Fetch assigned items when a tag is expanded
  useEffect(() => {
    if (!expandedTagId) { setTagItemIds(new Set()); return }
    supabase
      .from('item_tags')
      .select('item_id')
      .eq('tag_id', expandedTagId)
      .then(({ data }) => {
        if (data) setTagItemIds(new Set(data.map((d) => d.item_id)))
        else setTagItemIds(new Set())
      })
  }, [expandedTagId])

  const resetForm = () => {
    setEditing(null)
    setName('')
    setType('recipe')
    setError('')
  }

  const startEdit = (tag) => {
    setEditing(tag)
    setName(tag.name)
    setType(tag.type)
  }

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    setError('')

    try {
      const color = editing && editing !== 'new' ? (editing.color || DEFAULT_COLORS[type]) : DEFAULT_COLORS[type]
      if (editing && editing !== 'new') {
        await updateTag(editing.id, { name: name.trim(), type, color })
      } else {
        await createTag({ name: name.trim(), type, color })
      }
      resetForm()
    } catch (err) {
      setError(err.message)
    }
    setSaving(false)
  }

  const handleDelete = async (tag) => {
    const count = await getTagUsageCount(tag.id)
    let msg
    if (count > 0) {
      msg = i18n.language === 'he'
        ? `התגית "${tag.name}" משויכת ל-${count} פריטים. למחוק?`
        : `"${tag.name}" is assigned to ${count} item${count > 1 ? 's' : ''}. Delete?`
    } else {
      msg = i18n.language === 'he' ? `למחוק "${tag.name}"?` : `Delete "${tag.name}"?`
    }
    if (!window.confirm(msg)) return
    await deleteTag(tag.id)
    if (expandedTagId === tag.id) setExpandedTagId(null)
  }

  const toggleItemAssignment = async (tagId, itemId) => {
    if (tagItemIds.has(itemId)) {
      await supabase.from('item_tags').delete().eq('item_id', itemId).eq('tag_id', tagId)
      setTagItemIds((prev) => { const next = new Set(prev); next.delete(itemId); return next })
    } else {
      await supabase.from('item_tags').insert({ item_id: itemId, tag_id: tagId })
      setTagItemIds((prev) => new Set(prev).add(itemId))
    }
  }

  const grouped = [
    { key: 'recipe', label: TYPE_LABELS[i18n.language]?.recipe || 'Recipe', icon: '🍽️', items: recipeTags },
    { key: 'store', label: TYPE_LABELS[i18n.language]?.store || 'Store', icon: '🏪', items: storeTags },
    { key: 'custom', label: TYPE_LABELS[i18n.language]?.custom || 'Custom', icon: '🏷️', items: customTags },
  ]

  // Items for the picker modal (filtered by search)
  const pickerItems = pickerSearch.trim()
    ? allItems.filter((i) => i.name?.toLowerCase().includes(pickerSearch.toLowerCase()) || i.name_he?.toLowerCase().includes(pickerSearch.toLowerCase()))
    : allItems

  // Assigned items for expanded tag
  const assignedItems = allItems.filter((i) => tagItemIds.has(i.id))

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
        {/* Add/Edit form */}
        {editing && (
          <div className="bg-surface rounded-2xl border border-neutral p-4 mb-4 animate-fade-in space-y-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={i18n.language === 'he' ? 'שם התגית' : 'Tag name'}
              autoFocus
              className="w-full px-3 py-2.5 rounded-xl border border-neutral bg-bg text-text placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />

            {/* Type selector */}
            <div className="flex gap-2">
              {TAG_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors min-h-[44px] ${
                    type === t ? 'bg-primary text-white' : 'bg-bg border border-neutral/40 text-text-secondary'
                  }`}
                >
                  {TYPE_ICONS[t]} {TYPE_LABELS[i18n.language]?.[t] || t}
                </button>
              ))}
            </div>

            {error && <p className="text-danger text-sm">{error}</p>}

            <div className="flex gap-2">
              <button onClick={handleSave} disabled={saving || !name.trim()} className="flex-1 py-2.5 rounded-xl bg-primary text-white font-medium text-sm disabled:opacity-50 min-h-[44px]">
                {saving ? t('items.saving') : t('common.save')}
              </button>
              <button onClick={resetForm} className="px-4 py-2.5 rounded-xl text-text-secondary font-medium text-sm min-h-[44px]">
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}

        {/* Add button */}
        {!editing && (
          <button
            onClick={() => setEditing('new')}
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
                  const isExpanded = expandedTagId === tag.id
                  return (
                    <div key={tag.id} className="bg-white rounded-xl border border-neutral/20 shadow-sm overflow-hidden">
                      {/* Tag row */}
                      <div className="p-3.5 flex items-center gap-3">
                        <button
                          onClick={() => setExpandedTagId(isExpanded ? null : tag.id)}
                          className="flex-1 flex items-center gap-3 min-w-0"
                        >
                          <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color || '#3B82F6' }} />
                          <p className="font-medium text-text truncate text-start">{tag.name}</p>
                          <span className="text-xs text-text-secondary flex-shrink-0">
                            {isExpanded ? '' : `${tagItemIds.size > 0 && isExpanded ? tagItemIds.size : ''}`}
                          </span>
                          <IconChevronDown className={`w-4 h-4 text-text-secondary transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                        <button onClick={() => startEdit(tag)} className="w-9 h-9 rounded-lg text-text-secondary hover:text-primary hover:bg-primary/10 flex items-center justify-center transition-colors flex-shrink-0">
                          <IconEdit className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(tag)} className="w-9 h-9 rounded-lg text-text-secondary hover:text-danger hover:bg-danger/10 flex items-center justify-center transition-colors flex-shrink-0">
                          <IconTrash className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Expanded: assigned items */}
                      {isExpanded && (
                        <div className="border-t border-neutral/20 px-3.5 py-3 bg-bg/50 animate-fade-in">
                          {assignedItems.length === 0 ? (
                            <p className="text-xs text-text-secondary text-center py-2">
                              {i18n.language === 'he' ? 'אין פריטים משויכים' : 'No items assigned'}
                            </p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5 mb-3">
                              {assignedItems.map((item) => (
                                <span
                                  key={item.id}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-neutral/30 text-xs font-medium"
                                >
                                  {item.emoji} {item.name}
                                  <button
                                    onClick={() => toggleItemAssignment(tag.id, item.id)}
                                    className="text-text-secondary hover:text-danger ms-0.5"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                          <button
                            onClick={() => { setShowItemPicker(tag.id); setPickerSearch('') }}
                            className="w-full py-2 rounded-lg border border-dashed border-primary/30 text-primary text-xs font-medium hover:bg-primary/5 transition-colors"
                          >
                            + {i18n.language === 'he' ? 'הוסף פריטים' : 'Add Items'}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Item picker modal */}
      {showItemPicker && (
        <div
          className="fixed inset-x-0 top-0 z-50 flex items-end sm:items-center justify-center"
          style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="absolute inset-0 bg-black/50 animate-backdrop" onClick={() => setShowItemPicker(null)} />
          <div className="relative bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-full min-h-[50vh] flex flex-col animate-slide-up sm:animate-fade-in">
            <div className="flex-shrink-0 bg-white rounded-t-3xl px-5 pt-5 pb-3 border-b border-neutral/50 flex items-center justify-between z-10">
              <h2 className="text-lg font-semibold text-text">
                {i18n.language === 'he' ? 'הוסף פריטים לתגית' : 'Add Items to Tag'}
              </h2>
              <button onClick={() => setShowItemPicker(null)} className="w-11 h-11 rounded-full bg-neutral/30 flex items-center justify-center text-text hover:bg-neutral/50 transition-colors text-xl font-medium">×</button>
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
              {pickerItems.length === 0 ? (
                <p className="text-center text-text-secondary py-6 text-sm">
                  {i18n.language === 'he' ? 'לא נמצאו פריטים' : 'No items found'}
                </p>
              ) : (
                pickerItems.map((item) => {
                  const isAssigned = tagItemIds.has(item.id)
                  return (
                    <button
                      key={item.id}
                      onClick={() => toggleItemAssignment(showItemPicker, item.id)}
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
                      <span className="text-sm font-medium">{item.name}</span>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
