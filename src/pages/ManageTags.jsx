import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useTags } from '../hooks/useTags'

const TAG_TYPES = ['recipe', 'store', 'custom']
const TYPE_ICONS = { recipe: '🍽️', store: '🏪', custom: '🏷️' }
const TYPE_LABELS = {
  en: { recipe: 'Recipe', store: 'Store', custom: 'Custom' },
  he: { recipe: 'מתכון', store: 'חנות', custom: 'מותאם' },
}
const COLOR_OPTIONS = ['#F28B30', '#E8C840', '#8BC34A', '#5A9E3E', '#3B82F6', '#8B5CF6', '#EC4899', '#EF4444', '#6B7280', '#D4C48A']

export default function ManageTags() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { tags, recipeTags, storeTags, customTags, createTag, updateTag, deleteTag, getTagUsageCount } = useTags()
  const [editing, setEditing] = useState(null) // null | 'new' | tag object
  const [name, setName] = useState('')
  const [type, setType] = useState('recipe')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState('#F28B30')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const resetForm = () => {
    setEditing(null)
    setName('')
    setType('recipe')
    setDescription('')
    setColor('#F28B30')
    setError('')
  }

  const startEdit = (tag) => {
    setEditing(tag)
    setName(tag.name)
    setType(tag.type)
    setDescription(tag.description || '')
    setColor(tag.color || '#F28B30')
  }

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    setError('')

    try {
      if (editing && editing !== 'new') {
        await updateTag(editing.id, { name: name.trim(), type, description: description.trim() || null, color })
      } else {
        await createTag({ name: name.trim(), type, description: description.trim() || null, color })
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
        ? `התגית "${tag.name}" משויכת ל-${count} פריטים. למחוק? היא תוסר מכל הפריטים.`
        : `"${tag.name}" is assigned to ${count} item${count > 1 ? 's' : ''}. Delete? It will be removed from all items.`
    } else {
      msg = i18n.language === 'he' ? `למחוק "${tag.name}"?` : `Delete "${tag.name}"?`
    }
    if (!window.confirm(msg)) return
    await deleteTag(tag.id)
  }

  const grouped = [
    { key: 'recipe', label: TYPE_LABELS[i18n.language]?.recipe || 'Recipe', icon: '🍽️', items: recipeTags },
    { key: 'store', label: TYPE_LABELS[i18n.language]?.store || 'Store', icon: '🏪', items: storeTags },
    { key: 'custom', label: TYPE_LABELS[i18n.language]?.custom || 'Custom', icon: '🏷️', items: customTags },
  ]

  return (
    <div className="min-h-dvh bg-bg">
      <div className="px-4 pt-4 pb-3 flex items-center gap-3 max-w-lg mx-auto">
        <button
          onClick={() => navigate('/')}
          className="w-10 h-10 rounded-xl bg-surface border border-neutral flex items-center justify-center text-text-secondary hover:text-text transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
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
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors min-h-[44px] ${
                    type === t ? 'bg-primary text-white' : 'bg-bg border border-neutral/40 text-text-secondary'
                  }`}
                >
                  {TYPE_ICONS[t]} {TYPE_LABELS[i18n.language]?.[t] || t}
                </button>
              ))}
            </div>

            {/* Description (especially for recipes) */}
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={i18n.language === 'he' ? 'תיאור (אופציונלי)...' : 'Description (optional)...'}
              rows={2}
              className="w-full px-3 py-2 rounded-xl border border-neutral bg-bg text-text text-sm placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
            />

            {/* Color picker */}
            <div className="flex gap-2.5 flex-wrap">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-10 h-10 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-primary scale-110' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>

            {error && <p className="text-danger text-sm">{error}</p>}

            <div className="flex gap-2">
              <button onClick={handleSave} disabled={saving || !name.trim()} className="flex-1 py-2.5 rounded-xl bg-primary text-white font-semibold text-sm disabled:opacity-50 min-h-[44px]">
                {saving ? t('items.saving') : t('common.save')}
              </button>
              <button onClick={resetForm} className="px-4 py-2.5 rounded-xl text-text-secondary font-semibold text-sm min-h-[44px]">
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}

        {/* Add button */}
        {!editing && (
          <button
            onClick={() => setEditing('new')}
            className="w-full py-3 rounded-xl border-2 border-dashed border-primary/40 text-primary font-semibold mb-4 hover:bg-primary/5 transition-colors"
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
                {group.items.map((tag) => (
                  <div key={tag.id} className="bg-white rounded-xl border border-neutral/20 shadow-sm p-3.5 flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color || '#3B82F6' }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-text truncate">{tag.name}</p>
                      {tag.description && (
                        <p className="text-xs text-text-secondary truncate">{tag.description}</p>
                      )}
                    </div>
                    <button onClick={() => startEdit(tag)} className="w-10 h-10 rounded-lg text-text-secondary hover:text-primary hover:bg-primary/10 flex items-center justify-center transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                      </svg>
                    </button>
                    <button onClick={() => handleDelete(tag)} className="w-10 h-10 rounded-lg text-text-secondary hover:text-danger hover:bg-danger/10 flex items-center justify-center transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
