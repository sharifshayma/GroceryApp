import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCategories } from '../hooks/useCategories'
import { useItems } from '../hooks/useItems'
import { useLists } from '../hooks/useLists'
import { getCategoryName } from '../lib/categoryName'
import AddItemModal from '../components/AddItemModal'
import AddToListModal from '../components/AddToListModal'
import ItemCard from '../components/ItemCard'
import LoadingSpinner from '../components/LoadingSpinner'
import { IconBack, IconSettings } from '../components/Icons'

export default function Category() {
  const { categoryId } = useParams()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const { categories, loading: catsLoading } = useCategories()
  const { items, loading: itemsLoading, refetch, addItem, updateItem, deleteItem } = useItems(categoryId)
  const { lists, createList, addItemToList } = useLists()
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [addToListItem, setAddToListItem] = useState(null)
  const [manageMode, setManageMode] = useState(false)
  const pillsRef = useRef(null)
  const activePillRef = useRef(null)

  // Auto-scroll to center the active pill in the container
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activePillRef.current && pillsRef.current) {
        const pill = activePillRef.current
        const container = pillsRef.current
        const scrollLeft = pill.offsetLeft - container.offsetWidth / 2 + pill.offsetWidth / 2
        container.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' })
      }
    }, 50)
    return () => clearTimeout(timer)
  }, [categoryId, categories])

  if (catsLoading) return <LoadingSpinner fullScreen={false} />

  const activeCategory = categories.find((c) => c.id === categoryId)

  return (
    <div className="min-h-dvh bg-bg">
      {/* Header — single row: back | scrollable categories | settings */}
      <div className="sticky top-0 z-10 bg-bg">
        <div className="flex items-center gap-2 px-4 pt-4 pb-3 max-w-lg mx-auto">
          <button
            onClick={() => navigate('/')}
            className="w-10 h-10 rounded-xl bg-surface border border-neutral flex items-center justify-center text-text-secondary hover:text-text transition-colors flex-shrink-0"
          >
            <IconBack />
          </button>

          <div
            ref={pillsRef}
            className="flex-1 flex gap-2 overflow-x-auto no-scrollbar ps-1"
          >
            {categories.map((cat) => {
              const isActive = cat.id === categoryId
              return (
                <button
                  key={cat.id}
                  ref={isActive ? activePillRef : null}
                  onClick={() => navigate(`/category/${cat.id}`, { replace: true })}
                  className={`flex-shrink-0 px-3 py-2 rounded-full text-xs font-medium transition-colors min-h-[36px] ${
                    isActive
                      ? 'bg-primary text-white'
                      : 'bg-white text-text-secondary border border-neutral/30 hover:text-text'
                  }`}
                >
                  {cat.emoji} {getCategoryName(cat)}
                </button>
              )
            })}
          </div>

          <button
            onClick={() => setManageMode(!manageMode)}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors flex-shrink-0 ${
              manageMode ? 'bg-primary text-white' : 'bg-surface border border-neutral text-text-secondary hover:text-text'
            }`}
          >
            <IconSettings />
          </button>
        </div>
        <div className="border-b border-neutral/50" />
      </div>

      {/* Items list */}
      <div className="px-4 py-4 max-w-lg mx-auto">
        {itemsLoading ? (
          <LoadingSpinner fullScreen={false} />
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <span className="text-5xl mb-3 block">{activeCategory?.emoji || '📦'}</span>
            <p className="text-text-secondary mb-4">{t('empty.noItems')}</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-6 py-2.5 rounded-xl bg-primary text-white font-semibold hover:bg-primary-light active:bg-primary-dark transition-colors"
            >
              {t('empty.createFirst')}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Dotted add item card — only in manage mode */}
            {manageMode && (
              <button
                onClick={() => setShowAddModal(true)}
                className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-primary/30 text-primary font-medium text-sm hover:bg-primary/5 transition-colors min-h-[56px]"
              >
                + {i18n.language === 'he' ? 'הוסף פריט חדש' : 'Add New Item'}
              </button>
            )}
            {items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                showActions={manageMode}
                onAddToList={manageMode ? undefined : (i) => setAddToListItem(i)}
                onEdit={() => setEditingItem(item)}
                onDelete={() => handleDelete(item)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add to list modal */}
      {addToListItem && (
        <AddToListModal
          item={addToListItem}
          lists={lists}
          onAddToList={async (listId, item) => {
            await addItemToList(listId, item)
          }}
          onCreateAndAdd={async (item) => {
            const today = new Date().toLocaleDateString(i18n.language === 'he' ? 'he-IL' : 'en-US', {
              month: 'short',
              day: 'numeric',
            })
            const name = `${t('nav.lists')} — ${today}`
            return await createList(name, [item])
          }}
          onClose={() => setAddToListItem(null)}
        />
      )}

      {/* Add/Edit modal */}
      {(showAddModal || editingItem) && (
        <AddItemModal
          categoryId={categoryId}
          categories={categories}
          item={editingItem}
          onSave={async (data) => {
            if (editingItem) {
              await updateItem(editingItem.id, data)
            } else {
              await addItem(data)
            }
            setShowAddModal(false)
            setEditingItem(null)
          }}
          onClose={() => {
            setShowAddModal(false)
            setEditingItem(null)
          }}
        />
      )}
    </div>
  )

  async function handleDelete(item) {
    if (window.confirm(t('items.deleteConfirm', { name: item.name }))) {
      await deleteItem(item.id)
    }
  }
}
