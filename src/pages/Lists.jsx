import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLists } from '../hooks/useLists'
import { getCategoryName } from '../lib/categoryName'
import LoadingSpinner from '../components/LoadingSpinner'

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
  const { lists, loading, updateListStatus, deleteList, duplicateList, toggleBought, refetch } = useLists()
  const [shoppingListId, setShoppingListId] = useState(null)

  if (loading) return <LoadingSpinner fullScreen={false} />

  const activeList = lists.find((l) => l.status === 'active')
  const shoppingList = shoppingListId ? lists.find((l) => l.id === shoppingListId) : activeList
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

    const handleShare = async () => {
      let text = `🛒 ${shoppingList.name}\n\n`
      Object.entries(grouped).forEach(([cat, catItems]) => {
        text += `${cat}\n`
        catItems.forEach((li) => {
          const check = li.is_bought ? '✅' : '⬜'
          text += `${check} ${li.items?.name || '?'} × ${li.quantity} ${li.unit}\n`
        })
        text += '\n'
      })

      if (navigator.share) {
        try { await navigator.share({ text }); return } catch {}
      }
      await navigator.clipboard.writeText(text)
      alert(i18n.language === 'he' ? 'הועתק!' : 'Copied!')
    }

    const handleDone = async () => {
      await updateListStatus(shoppingList.id, 'completed')
      setShoppingListId(null)
    }

    return (
      <div className="px-4 pt-4 pb-8 max-w-lg mx-auto animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setShoppingListId(null)}
            className="w-10 h-10 rounded-xl bg-surface border border-neutral flex items-center justify-center text-text-secondary"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <h1 className="text-lg font-extrabold flex-1 text-center truncate px-2">{shoppingList.name}</h1>
          <button onClick={handleShare} className="w-10 h-10 rounded-xl bg-surface border border-neutral flex items-center justify-center text-text-secondary">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
            </svg>
          </button>
        </div>

        {/* Progress */}
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="font-semibold text-text-secondary">{boughtCount}/{total}</span>
            <span className="font-bold text-green-dark">{Math.round(progress)}%</span>
          </div>
          <div className="h-2.5 bg-neutral/30 rounded-full overflow-hidden">
            <div className="h-full bg-green rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Items by category */}
        {Object.entries(grouped).map(([cat, catItems]) => (
          <div key={cat} className="mb-4">
            <h3 className="text-sm font-bold text-text-secondary mb-2">{cat}</h3>
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
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    )}
                  </div>
                  <span className="text-lg">{li.items?.emoji || '🛒'}</span>
                  <span className={`flex-1 text-sm font-medium text-start ${li.is_bought ? 'line-through text-text-secondary' : ''}`}>
                    {li.items?.name || '?'}
                  </span>
                  <span className="text-xs text-text-secondary flex-shrink-0">
                    {li.quantity} {li.unit}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Done button */}
        <button
          onClick={handleDone}
          className={`w-full py-3.5 rounded-xl font-bold text-lg text-white transition-colors mt-4 ${
            boughtCount === total ? 'bg-green-dark hover:bg-green' : 'bg-primary hover:bg-primary-light'
          }`}
        >
          {t('common.done')} ✓
        </button>
      </div>
    )
  }

  // List overview
  return (
    <div className="px-4 pt-6 pb-8 max-w-lg mx-auto animate-fade-in">
      <h1 className="text-2xl font-extrabold mb-4">{t('nav.lists')}</h1>

      {lists.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
          <span className="text-6xl mb-4">📋</span>
          <h2 className="text-xl font-bold mb-2">{t('empty.noLists')}</h2>
          <p className="text-text-secondary text-center mb-6">{t('empty.noListsDesc')}</p>
          <Link
            to="/create-list"
            className="px-6 py-3 rounded-xl bg-primary text-white font-bold text-lg"
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
                <span className="text-xs font-bold text-primary uppercase">
                  {i18n.language === 'he' ? 'פעיל' : 'Active'}
                </span>
                <span className="text-xs text-text-secondary">
                  {formatDate(activeList.created_at, i18n.language)}
                </span>
              </div>
              <h3 className="font-bold text-lg mb-1">{activeList.name}</h3>
              <p className="text-sm text-text-secondary mb-3">
                {(activeList.list_items || []).filter((li) => li.is_bought).length}/
                {(activeList.list_items || []).length} {i18n.language === 'he' ? 'פריטים' : 'items'}
              </p>
              <button
                onClick={() => setShoppingListId(activeList.id)}
                className="w-full py-2.5 rounded-xl bg-primary text-white font-semibold"
              >
                {i18n.language === 'he' ? 'המשך קניות' : 'Continue Shopping'} →
              </button>
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
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusColors[list.status] || ''}`}>
                    {statusLabels[list.status] || list.status}
                  </span>
                  <span className="text-xs text-text-secondary">
                    {formatDate(list.created_at, i18n.language)}
                  </span>
                </div>
                <h3 className="font-bold mb-1">{list.name}</h3>
                <p className="text-sm text-text-secondary mb-3">
                  {itemCount} {i18n.language === 'he' ? 'פריטים' : 'items'}
                </p>
                <div className="flex gap-2">
                  {list.status === 'draft' && (
                    <button
                      onClick={async () => {
                        await updateListStatus(list.id, 'active')
                        setShoppingListId(list.id)
                      }}
                      className="flex-1 py-2.5 rounded-xl bg-primary text-white font-semibold text-sm min-h-[44px]"
                    >
                      {i18n.language === 'he' ? 'התחל קניות' : 'Start Shopping'}
                    </button>
                  )}
                  {list.status === 'completed' && (
                    <button
                      onClick={() => setShoppingListId(list.id)}
                      className="flex-1 py-2.5 rounded-xl bg-white border border-neutral/30 text-text font-semibold text-sm min-h-[44px]"
                    >
                      {i18n.language === 'he' ? 'צפייה' : 'View'}
                    </button>
                  )}
                  <button
                    onClick={() => duplicateList(list)}
                    className="w-11 h-11 rounded-xl bg-white border border-neutral/30 text-text-secondary flex items-center justify-center text-base"
                    title="Duplicate"
                  >
                    📋
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(i18n.language === 'he' ? 'למחוק רשימה?' : 'Delete list?')) {
                        deleteList(list.id)
                      }
                    }}
                    className="w-11 h-11 rounded-xl bg-white border border-neutral/30 text-danger flex items-center justify-center text-base"
                    title="Delete"
                  >
                    🗑
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
        className="fixed bottom-20 end-4 w-14 h-14 rounded-full bg-primary text-white shadow-lg flex items-center justify-center text-2xl font-bold hover:bg-primary-light active:bg-primary-dark transition-all active:scale-90 z-20"
        style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        +
      </Link>
    </div>
  )
}
