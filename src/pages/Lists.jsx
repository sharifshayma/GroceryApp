import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLists } from '../hooks/useLists'
import { useStock } from '../hooks/useStock'
import { getCategoryName } from '../lib/categoryName'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorBanner from '../components/ErrorBanner'
import ShareSheet from '../components/ShareSheet'
import UpdateStockModal from '../components/UpdateStockModal'
import CarryOverModal from '../components/CarryOverModal'
import { IconBack, IconEdit, IconShare, IconCheck, IconChevronDown, IconCopy, IconTrash, IllustrationNoLists } from '../components/Icons'

function formatDate(dateStr, lang) {
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now - d
  const dayMs = 86400000

  if (diff < dayMs && d.getDate() === now.getDate()) return lang === 'he' ? 'היום' : 'Today'
  if (diff < dayMs * 2) return lang === 'he' ? 'אתמול' : 'Yesterday'
  return d.toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', { month: 'short', day: 'numeric' })
}

export default function Lists() {
  const { t, i18n } = useTranslation()
  const { listId: paramListId } = useParams()
  const navigate = useNavigate()
  const { lists, loading, error, updateListStatus, deleteList, duplicateList, completeAndCarryOver, toggleBought, refetch } = useLists()
  const [shoppingListId, setShoppingListId] = useState(null)
  const [dismissedActiveList, setDismissedActiveList] = useState(false)
  const [shareList, setShareList] = useState(null)
  const [expandedListId, setExpandedListId] = useState(null)
  const [showUpdateStock, setShowUpdateStock] = useState(false)
  const [showCarryOver, setShowCarryOver] = useState(false)
  const [carryOverSaving, setCarryOverSaving] = useState(false)
  const { addToStock } = useStock()

  // Handle deep link: open list from URL param
  useEffect(() => {
    if (paramListId && lists.length > 0 && !shoppingListId) {
      const found = lists.find((l) => l.id === paramListId)
      if (found) {
        setShoppingListId(found.id)
        // Replace URL to clean /lists/:id -> /lists
        navigate('/lists', { replace: true })
      }
    }
  }, [paramListId, lists, shoppingListId, navigate])

  if (loading) return <LoadingSpinner fullScreen={false} />
  if (error) return <ErrorBanner error={error} onRetry={refetch} />

  const activeList = lists.find((l) => l.status === 'active')
  const shoppingList = shoppingListId ? lists.find((l) => l.id === shoppingListId) : (dismissedActiveList ? null : activeList)
  const otherLists = lists.filter((l) => l.id !== activeList?.id)

  // Shopping mode
  if (shoppingList && (shoppingList.status === 'active' || shoppingListId)) {
    const items = shoppingList.list_items || []
    const boughtCount = items.filter((li) => li.is_bought).length
    const total = items.length
    const progress = total > 0 ? (boughtCount / total) * 100 : 0

    // Group by category
    const grouped = {}
    items.forEach((li) => {
      const catName = li.items?.categories ? getCategoryName(li.items.categories) : 'Other'
      const catEmoji = li.items?.categories?.emoji || '📦'
      const key = `${catEmoji} ${catName}`
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(li)
    })

    // Sort: unbought first in each group
    Object.values(grouped).forEach((arr) => {
      arr.sort((a, b) => (a.is_bought === b.is_bought ? 0 : a.is_bought ? 1 : -1))
    })

    const unboughtItems = items.filter((li) => !li.is_bought)

    const handleDone = async () => {
      // If all bought or none bought, complete directly (no modal)
      if (boughtCount === total || boughtCount === 0) {
        await updateListStatus(shoppingList.id, 'completed')
        setShoppingListId(null)
        return
      }
      // Some items unbought — show carry-over modal
      setShowCarryOver(true)
    }

    const handleCarryOver = async () => {
      setCarryOverSaving(true)
      try {
        const carryOverName = `${shoppingList.name} ${t('lists.carriedOver')}`
        await completeAndCarryOver(shoppingList, carryOverName)
        setShowCarryOver(false)
        setShoppingListId(null)
      } catch (err) {
        console.error('[Lists] Carry over failed:', err)
      } finally {
        setCarryOverSaving(false)
      }
    }

    const handleCompleteAnyway = async () => {
      setCarryOverSaving(true)
      try {
        await updateListStatus(shoppingList.id, 'completed')
        setShowCarryOver(false)
        setShoppingListId(null)
      } finally {
        setCarryOverSaving(false)
      }
    }

    return (
      <div className="px-4 pt-4 pb-8 max-w-lg mx-auto animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => { setShoppingListId(null); setDismissedActiveList(true) }}
            className="w-10 h-10 rounded-xl bg-surface border border-neutral flex items-center justify-center text-text-secondary"
          >
            <IconBack />
          </button>
          <h1 className="text-lg font-semibold flex-1 text-center truncate px-2">{shoppingList.name}</h1>
          {shoppingList.status !== 'completed' && (
            <button
              onClick={() => navigate(`/edit-list/${shoppingList.id}`)}
              className="w-10 h-10 rounded-xl bg-surface border border-neutral flex items-center justify-center text-text-secondary"
              title="Edit"
            >
              <IconEdit />
            </button>
          )}
          <button
            onClick={() => setShareList(shoppingList)}
            className="w-10 h-10 rounded-xl bg-surface border border-neutral flex items-center justify-center text-text-secondary"
          >
            <IconShare />
          </button>
        </div>

        {/* Progress */}
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="font-semibold text-text-secondary">{boughtCount}/{total}</span>
            <span className="font-medium text-green-dark">{Math.round(progress)}%</span>
          </div>
          <div className="h-2.5 bg-neutral/30 rounded-full overflow-hidden">
            <div className="h-full bg-green rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Items by category */}
        {Object.entries(grouped).map(([cat, catItems]) => (
          <div key={cat} className="mb-4">
            <h3 className="text-sm font-medium text-text-secondary mb-2">{cat}</h3>
            <div className="space-y-1.5">
              {catItems.map((li) => (
                <button
                  key={li.id}
                  onClick={() => toggleBought(li.id, !li.is_bought)}
                  className={`w-full bg-white rounded-xl p-3.5 flex items-center gap-3 border shadow-sm transition-all min-h-[52px] ${
                    li.is_bought ? 'border-green/30 opacity-60' : 'border-neutral/20'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    li.is_bought ? 'bg-green border-green text-white' : 'border-neutral'
                  }`}>
                    {li.is_bought && (
                      <IconCheck />
                    )}
                  </div>
                  <span className="text-lg">{li.items?.emoji || '🛒'}</span>
                  <div className="flex-1 text-start min-w-0">
                    <span className={`text-sm font-medium block ${li.is_bought ? 'line-through text-text-secondary' : ''}`}>
                      {li.items?.name || '?'}
                    </span>
                    {li.notes && (
                      <span className="text-xs text-text-secondary block truncate">
                        📝 {li.notes}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-text-secondary flex-shrink-0">
                    {li.quantity} {li.unit}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Update Stock button — shown when items have been bought */}
        {boughtCount > 0 && (
          <button
            onClick={() => setShowUpdateStock(true)}
            className="w-full py-3 rounded-xl font-semibold text-sm border-2 border-green text-green-dark hover:bg-green/10 transition-colors mt-4 min-h-[48px]"
          >
            📦 {i18n.language === 'he' ? 'עדכן מלאי' : 'Update Stock'}
          </button>
        )}

        {/* Done button */}
        <button
          onClick={handleDone}
          className={`w-full py-3.5 rounded-xl font-medium text-lg text-white transition-colors mt-2 ${
            boughtCount === total ? 'bg-green-dark hover:bg-green' : 'bg-primary hover:bg-primary-light'
          }`}
        >
          {t('common.done')} ✓
        </button>

        {shareList && <ShareSheet list={shareList} onClose={() => setShareList(null)} />}

        {showCarryOver && (
          <CarryOverModal
            unboughtItems={unboughtItems}
            onCarryOver={handleCarryOver}
            onCompleteAnyway={handleCompleteAnyway}
            onKeepShopping={() => setShowCarryOver(false)}
            saving={carryOverSaving}
          />
        )}

        {showUpdateStock && (
          <UpdateStockModal
            listItems={items}
            onUpdateStock={async (stockUpdates) => {
              for (const item of stockUpdates) {
                await addToStock(item.itemId, item.quantity, item.unit, 0)
              }
              await refetch()
            }}
            onClose={() => setShowUpdateStock(false)}
          />
        )}
      </div>
    )
  }

  // List overview
  return (
    <div className="px-4 pt-6 pb-8 max-w-lg mx-auto animate-fade-in">
      <h1 className="text-2xl font-semibold mb-4">{t('nav.lists')}</h1>

      {lists.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
          <IllustrationNoLists className="w-28 h-28 mb-4" />
          <h2 className="text-xl font-medium mb-2">{t('empty.noLists')}</h2>
          <p className="text-text-secondary text-center mb-6">{t('empty.noListsDesc')}</p>
          <Link
            to="/create-list"
            className="px-6 py-3 rounded-xl bg-primary text-white font-medium text-lg"
          >
            + {t('items.addItem')}
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Active list first */}
          {activeList && (
            <div className="bg-primary/5 border-2 border-primary rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-primary uppercase">
                  {i18n.language === 'he' ? 'פעיל' : 'Active'}
                </span>
                <span className="text-xs text-text-secondary">
                  {formatDate(activeList.created_at, i18n.language)}
                </span>
              </div>
              <h3 className="font-medium text-lg mb-1">{activeList.name}</h3>
              <p className="text-sm text-text-secondary mb-3">
                {(activeList.list_items || []).filter((li) => li.is_bought).length}/
                {(activeList.list_items || []).length} {i18n.language === 'he' ? 'פריטים' : 'items'}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => { setShoppingListId(activeList.id); setDismissedActiveList(false) }}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-white font-semibold"
                >
                  {i18n.language === 'he' ? 'המשך קניות' : 'Continue Shopping'} →
                </button>
                <button
                  onClick={() => setShareList(activeList)}
                  className="w-11 h-11 rounded-xl bg-white border border-primary/30 text-primary flex items-center justify-center"
                  title="Share"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Other lists */}
          {otherLists.map((list) => {
            const itemCount = (list.list_items || []).length
            const statusColors = {
              draft: 'bg-secondary-light text-text',
              completed: 'bg-green-light text-green-dark',
            }
            const statusLabels = {
              draft: i18n.language === 'he' ? 'טיוטה' : 'Draft',
              completed: i18n.language === 'he' ? 'הושלם' : 'Completed',
            }

            return (
              <div key={list.id} className="bg-white rounded-2xl border border-neutral/20 shadow-sm p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[list.status] || ''}`}>
                    {statusLabels[list.status] || list.status}
                  </span>
                  <span className="text-xs text-text-secondary">
                    {formatDate(list.created_at, i18n.language)}
                  </span>
                </div>
                <h3 className="font-medium mb-1">{list.name}</h3>
                <button
                  onClick={() => setExpandedListId(expandedListId === list.id ? null : list.id)}
                  className="flex items-center gap-1 text-sm text-text-secondary mb-1"
                >
                  <span>{itemCount} {i18n.language === 'he' ? 'פריטים' : 'items'}</span>
                  <IconChevronDown className={`w-4 h-4 transition-transform ${expandedListId === list.id ? 'rotate-180' : ''}`} />
                </button>
                {expandedListId === list.id && (list.list_items || []).length > 0 && (
                  <div className="mb-2 space-y-1">
                    {(list.list_items || []).map((li) => (
                      <div key={li.id} className={`flex items-center gap-2 text-sm ps-1 ${li.is_bought ? 'text-text-secondary' : 'text-danger'}`}>
                        {list.status === 'completed' && (
                          <span className="text-xs flex-shrink-0">{li.is_bought ? '✅' : '❌'}</span>
                        )}
                        <span className="text-base">{li.items?.emoji || '🛒'}</span>
                        <span className={`truncate ${li.is_bought && list.status === 'completed' ? 'line-through' : ''}`}>
                          {li.items?.name || '?'} <span className="text-xs">× {li.quantity} {li.unit}</span>
                        </span>
                        {li.notes && <span className="text-xs text-primary italic truncate">({li.notes})</span>}
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  {list.status === 'draft' && (
                    <>
                      <button
                        onClick={async () => {
                          await updateListStatus(list.id, 'active')
                          setShoppingListId(list.id)
                          setDismissedActiveList(false)
                        }}
                        className="flex-1 py-2.5 rounded-xl bg-primary text-white font-semibold text-sm min-h-[44px]"
                      >
                        {i18n.language === 'he' ? 'התחל קניות' : 'Start Shopping'}
                      </button>
                      <Link
                        to={`/edit-list/${list.id}`}
                        className="w-11 h-11 rounded-xl bg-white border border-neutral/30 text-text-secondary flex items-center justify-center"
                        title="Edit"
                      >
                        <IconEdit className="w-4 h-4" />
                      </Link>
                    </>
                  )}
                  {list.status === 'completed' && (
                    <button
                      onClick={() => { setShoppingListId(list.id); setDismissedActiveList(false) }}
                      className="flex-1 py-2.5 rounded-xl bg-white border border-neutral/30 text-text font-semibold text-sm min-h-[44px]"
                    >
                      {i18n.language === 'he' ? 'צפייה' : 'View'}
                    </button>
                  )}
                  <button
                    onClick={() => setShareList(list)}
                    className="w-11 h-11 rounded-xl bg-white border border-neutral/30 text-text-secondary flex items-center justify-center"
                    title="Share"
                  >
                    <IconShare className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => duplicateList(list)}
                    className="w-11 h-11 rounded-xl bg-white border border-neutral/30 text-text-secondary flex items-center justify-center"
                    title="Duplicate"
                  >
                    <IconCopy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(i18n.language === 'he' ? 'למחוק רשימה?' : 'Delete list?')) {
                        deleteList(list.id)
                      }
                    }}
                    className="w-11 h-11 rounded-xl bg-white border border-neutral/30 text-danger flex items-center justify-center"
                    title="Delete"
                  >
                    <IconTrash className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* FAB */}
      <Link
        to="/create-list"
        className="fixed bottom-20 end-4 w-14 h-14 rounded-full bg-primary text-white shadow-lg flex items-center justify-center text-2xl font-medium hover:bg-primary-light active:bg-primary-dark transition-all active:scale-90 z-20"
        style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        +
      </Link>

      {shareList && <ShareSheet list={shareList} onClose={() => setShareList(null)} />}
    </div>
  )
}
