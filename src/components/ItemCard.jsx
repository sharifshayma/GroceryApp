import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { IconPlus, IconCheckCircle, IconEdit, IconTrash } from './Icons'
import ItemImage from './ItemImage'

export default function ItemCard({ item, onEdit, onDelete, onAddToList, isInList = false, showActions = true, selectMode = false, isSelected = false, onSelect }) {
  const { t } = useTranslation()
  const [itemTags, setItemTags] = useState([])

  useEffect(() => {
    supabase
      .from('item_tags')
      .select('tag_id, notes, tags(name, color, type)')
      .eq('item_id', item.id)
      .then(({ data }) => {
        if (data) setItemTags(data)
      })
  }, [item.id])

  const handleClick = () => {
    if (selectMode && onSelect) {
      onSelect(item)
    } else if (onAddToList && !isInList) {
      onAddToList(item)
    }
  }

  return (
    <div
      onClick={selectMode ? handleClick : undefined}
      className={`bg-white rounded-xl p-4 border shadow-sm transition-colors ${
        selectMode
          ? isSelected
            ? 'border-primary bg-primary/5 cursor-pointer'
            : 'border-neutral/20 cursor-pointer hover:border-primary/30'
          : 'border-neutral/20 hover:border-primary/30'
      }`}
    >
      <div className="flex items-center gap-3">
        {selectMode && (
          <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
            isSelected ? 'bg-primary border-primary text-white' : 'border-neutral'
          }`}>
            {isSelected && <span className="text-xs">✓</span>}
          </span>
        )}
        <ItemImage item={item} size="md" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-text truncate">{item.name}</p>
          <p className="text-xs text-text-secondary mt-0.5">
            {t(`units.${item.default_unit}`, item.default_unit)}
          </p>
        </div>
        {!selectMode && (
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {onAddToList && (
              isInList ? (
                <span className="w-10 h-10 rounded-lg text-green flex items-center justify-center">
                  <IconCheckCircle />
                </span>
              ) : (
                <button
                  onClick={() => onAddToList(item)}
                  className="w-10 h-10 rounded-lg text-text-secondary hover:text-primary hover:bg-primary/10 flex items-center justify-center transition-colors"
                  title="Add to list"
                >
                  <IconPlus />
                </button>
              )
            )}
            {showActions && (
              <>
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
        )}
      </div>

      {/* Tag pills */}
      {itemTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2 ps-9">
          {itemTags.slice(0, 3).map((it) => (
            <span
              key={it.tag_id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium text-white"
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
  )
}
