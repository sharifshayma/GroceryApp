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
  const [selectMode, setSelectMode] = useState(false)
  const [selectedItems, setSelectedItems] = useState(new Map())
  const [showListPicker, setShowListPicker] = useState(false)
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
  const openLists = lists.filter((l) => l.status === 'draft' || l.status === 'active')
  const itemIdsInLists = new Set(
    openLists.flatMap((l) => (l.list_items || []).map((li) => li.item_id))
  )

  const toggleSelect = (item) => {
    setSelectedItems((prev) => {
      const next = new Map(prev)
      if (next.has(item.id)) next.delete(item.id)
      else next.set(item.id, item)
      return next
    })
  }

  const handleBulkAdd = async (listId) => {
    const allSelected = [...selectedItems.values()].map((item) => ({
      item_id: item.id,
      quantity: 1,
      unit: item.default_unit || 'pcs',
    }))

    const targetList = listId ? lists.find((l) => l.id === listId) : null
    const existingItemIds = new Set((targetList?.list_items || []).map((li) => li.item_id))
    const toAdd = allSelected.filter((i) => !existingItemIds.has(i.item_id))

    if (toAdd.length === 0) {
      setSelectedItems(new Map())
      setSelectMode(false)
      return
    }

    if (listId) {
      for (const item of toAdd) {
        await addItemToList(listId, item)
      }
    } else if (openLists.length === 0) {
      const today = new Date().toLocaleDateString(i18n.language === 'he' ? 'he-IL' : 'en-US', { month: 'short', day: 'numeric' })
      await createList(`${t('nav.lists')} — ${today}`, toAdd)
    } else if (openLists.length === 1) {
      const existingIds = new Set((openLists[0].list_items || []).map((li) => li.item_id))
      const filtered = toAdd.filter((i) => !existingIds.has(i.item_id))
      for (const item of filtered) {
        await addItemToList(openLists[0].id, item)
      }
    } else {
      setShowListPicker(true)
      return
    }

    setSelectedItems(new Map())
    setSelectMode(false)
  }

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

      {/* Select controls — only when items exist and not in manage mode */}
      {!manageMode && items.length > 0 && !itemsLoading && (
        <div className="flex gap-2 px-4 pt-3 max-w-lg mx-auto justify-end">
          <button
            onClick={() => {
              if (selectMode) {
                setSelectMode(false)
                setSelectedItems(new Map())
              } else {
                setSelectMode(true)
              }
            }}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              selectMode ? 'bg-primary text-white' : 'bg-surface border border-neutral text-text-secondary'
            }`}
          >
            {selectMode
              ? (i18n.language === 'he' ? 'נקה' : 'Clear')
              : (i18n.language === 'he' ? 'בחירה' : 'Select')}
          </button>
          {selectMode && (
            <button
              onClick={() => {
                if (selectedItems.size === items.length) {
                  setSelectedItems(new Map())
                } else {
                  const all = new Map()
                  items.forEach((i) => all.set(i.id, i))
                  setSelectedItems(all)
                }
              }}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium text-primary"
            >
              {selectedItems.size === items.length
                ? (i18n.language === 'he' ? 'בטל הכל' : 'Deselect all')
                : (i18n.language === 'he' ? 'בחר הכל' : 'Select all')}
            </button>
          )}
        </div>
      )}

      {/* Items list */}
      <div className="px-4 py-3 max-w-lg mx-auto">
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
                isInList={itemIdsInLists.has(item.id)}
                selectMode={selectMode && !manageMode}
                isSelected={selectedItems.has(item.id)}
                onSelect={toggleSelect}
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
            let result
            if (editingItem) {
              result = await updateItem(editingItem.id, data)
            } else {
              result = await addItem(data)
            }
            setShowAddModal(false)
            setEditingItem(null)
            return result
          }}
          onClose={() => {
            setShowAddModal(false)
            setEditingItem(null)
          }}
        />
      )}

      {/* Floating bulk add button */}
      {selectMode && selectedItems.size > 0 && (
        <div className="fixed bottom-20 inset-x-0 px-4 z-20" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          <button
            onClick={() => handleBulkAdd(null)}
            className="w-full max-w-lg mx-auto block py-3.5 rounded-xl bg-primary text-white font-medium text-lg shadow-lg active:scale-[0.98] transition-transform"
          >
            {i18n.language === 'he'
              ? `הוסף ${selectedItems.size} פריטים לרשימה`
              : `Add ${selectedItems.size} item${selectedItems.size > 1 ? 's' : ''} to list`}
          </button>
        </div>
      )}

      {/* List picker for bulk add (when multiple lists exist) */}
      {showListPicker && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50 animate-backdrop" onClick={() => setShowListPicker(false)} />
          <div
            className="relative bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[85vh] overflow-y-auto animate-slide-up sm:animate-fade-in"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
          >
            <div className="px-5 pt-5 pb-3 border-b border-neutral/50 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text">
                {i18n.language === 'he' ? 'בחר רשימה' : 'Choose List'}
              </h2>
              <button onClick={() => setShowListPicker(false)} className="w-11 h-11 rounded-full bg-neutral/30 flex items-center justify-center text-text hover:bg-neutral/50 transition-colors text-xl font-medium">×</button>
            </div>
            <div className="p-4 pb-20 space-y-2">
              {openLists.map((list) => (
                <button
                  key={list.id}
                  onClick={async () => {
                    setShowListPicker(false)
                    await handleBulkAdd(list.id)
                  }}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border border-neutral/20 bg-white hover:bg-bg transition-colors min-h-[56px]"
                >
                  <span className="text-lg">🛒</span>
                  <div className="flex-1 text-start">
                    <p className="font-semibold text-sm">{list.name}</p>
                    <p className="text-xs text-text-secondary">
                      {(list.list_items || []).length} {i18n.language === 'he' ? 'פריטים' : 'items'}
                    </p>
                  </div>
                </button>
              ))}
              <button
                onClick={async () => {
                  setShowListPicker(false)
                  const toAdd = [...selectedItems.values()].map((item) => ({
                    item_id: item.id,
                    quantity: 1,
                    unit: item.default_unit || 'pcs',
                  }))
                  const today = new Date().toLocaleDateString(i18n.language === 'he' ? 'he-IL' : 'en-US', { month: 'short', day: 'numeric' })
                  await createList(`${t('nav.lists')} — ${today}`, toAdd)
                  setSelectedItems(new Map())
                  setSelectMode(false)
                }}
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors min-h-[56px]"
              >
                <span className="text-lg">+</span>
                <p className="font-semibold text-sm text-primary">
                  {i18n.language === 'he' ? 'רשימה חדשה' : 'New List'}
                </p>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  async function handleDelete(item) {
    if (window.confirm(t('items.deleteConfirm', { name: item.name }))) {
      await deleteItem(item.id)
    }
  }
}
