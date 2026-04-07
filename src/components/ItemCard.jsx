import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import TagPicker from './TagPicker'
import { IconCart, IconTag, IconEdit, IconTrash } from './Icons'

export default function ItemCard({ item, onEdit, onDelete, onAddToList, showActions = true }) {
  const { t } = useTranslation()
  const [showTagPicker, setShowTagPicker] = useState(false)
  const [itemTags, setItemTags] = useState([])

  useEffect(() => {
    supabase
      .from('item_tags')
      .select('tag_id, notes, tags(name, color, type)')
      .eq('item_id', item.id)
      .then(({ data }) => {
        if (data) setItemTags(data)
      })
  }, [item.id, showTagPicker])

  return (
    <>
      <div className="bg-white rounded-xl p-4 border border-neutral/20 shadow-sm hover:border-primary/30 transition-colors">
        <div className="flex items-center gap-3">
          <span className="text-2xl flex-shrink-0">{item.emoji}</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-text truncate">{item.name}</p>
            {item.notes && (
              <p className="text-xs text-text-secondary truncate">{item.notes}</p>
            )}
            <p className="text-xs text-text-secondary mt-0.5">
              {t(`units.${item.default_unit}`, item.default_unit)}
            </p>
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {onAddToList && (
              <button
                onClick={() => onAddToList(item)}
                className="w-10 h-10 rounded-lg text-text-secondary hover:text-primary hover:bg-primary/10 flex items-center justify-center transition-colors"
                title="Add to list"
              >
                <IconCart />
              </button>
            )}
            {showActions && (
              <>
                <button
                  onClick={() => setShowTagPicker(true)}
                  className="w-10 h-10 rounded-lg text-text-secondary hover:text-primary hover:bg-primary/10 flex items-center justify-center transition-colors"
                  title="Tags"
                >
                  <IconTag />
                </button>
                <button
                  onClick={onEdit}
                  className="w-10 h-10 rounded-lg text-text-secondary hover:text-primary hover:bg-primary/10 flex items-center justify-center transition-colors"
                >
                  <IconEdit />
                </button>
                <button
                  onClick={onDelete}
                  className="w-10 h-10 rounded-lg text-text-secondary hover:text-danger hover:bg-danger/10 flex items-center justify-center transition-colors"
                >
                  <IconTrash />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Tag pills */}
        {itemTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2 ps-9">
            {itemTags.slice(0, 3).map((it) => (
              <span
                key={it.tag_id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white"
                style={{ backgroundColor: it.tags?.color || '#3B82F6' }}
              >
                {it.tags?.type === 'recipe' ? '🍽️' : it.tags?.type === 'store' ? '🏪' : '🏷️'}
                {it.tags?.name}
              </span>
            ))}
            {itemTags.length > 3 && (
              <span className="text-[10px] text-text-secondary font-medium px-1">
                +{itemTags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      {showTagPicker && (
        <TagPicker itemId={item.id} onClose={() => setShowTagPicker(false)} />
      )}
    </>
  )
}
