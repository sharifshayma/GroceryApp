import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getCategoryName } from '../lib/categoryName'

export default function ShareSheet({ list, onClose }) {
  const { i18n } = useTranslation()
  const [copied, setCopied] = useState(null) // 'text' | 'link'

  const items = list.list_items || []

  // Group by category
  const grouped = {}
  items.forEach((li) => {
    const catName = li.items?.categories ? getCategoryName(li.items.categories) : 'Other'
    const catEmoji = li.items?.categories?.emoji || '📦'
    const key = `${catEmoji} ${catName}`
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(li)
  })

  const buildText = () => {
    let text = `🛒 ${list.name}\n\n`
    Object.entries(grouped).forEach(([cat, catItems]) => {
      text += `${cat}\n`
      catItems.forEach((li) => {
        const check = li.is_bought ? '✅' : '⬜'
        let line = `${check} ${li.items?.name || '?'} × ${li.quantity} ${li.unit}`
        if (li.notes) line += ` (${li.notes})`
        text += `${line}\n`
      })
      text += '\n'
    })
    return text.trim()
  }

  const listLink = `${window.location.origin}/lists/${list.id}`

  const handleShareText = async () => {
    const text = buildText()
    if (navigator.share) {
      try {
        await navigator.share({ text })
        onClose()
        return
      } catch {}
    }
    await navigator.clipboard.writeText(text)
    setCopied('text')
    setTimeout(() => setCopied(null), 2000)
  }

  const handleCopyText = async () => {
    const text = buildText()
    await navigator.clipboard.writeText(text)
    setCopied('text')
    setTimeout(() => setCopied(null), 2000)
  }

  const handleShareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ url: listLink, title: list.name })
        onClose()
        return
      } catch {}
    }
    await navigator.clipboard.writeText(listLink)
    setCopied('link')
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 animate-backdrop" onClick={onClose} />
      <div
        className="relative bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md animate-slide-up sm:animate-fade-in"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
      >
        <div className="px-5 pt-5 pb-3 border-b border-neutral/50 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-text">
            {i18n.language === 'he' ? 'שתף רשימה' : 'Share List'}
          </h2>
          <button onClick={onClose} className="w-11 h-11 rounded-full bg-neutral/30 flex items-center justify-center text-text hover:bg-neutral/50 transition-colors text-xl font-medium">
            ×
          </button>
        </div>

        <div className="p-4 space-y-2">
          {/* Share via platform */}
          <button
            onClick={handleShareText}
            className="w-full flex items-center gap-4 p-4 rounded-xl border border-neutral/20 bg-white hover:bg-bg transition-colors min-h-[56px]"
          >
            <span className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-lg">
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
              </svg>
            </span>
            <div className="flex-1 text-start">
              <p className="font-semibold text-sm">{i18n.language === 'he' ? 'שתף כטקסט' : 'Share as Text'}</p>
              <p className="text-xs text-text-secondary">{i18n.language === 'he' ? 'שלח דרך כל אפליקציה' : 'Send via any app'}</p>
            </div>
          </button>

          {/* Copy list text */}
          <button
            onClick={handleCopyText}
            className="w-full flex items-center gap-4 p-4 rounded-xl border border-neutral/20 bg-white hover:bg-bg transition-colors min-h-[56px]"
          >
            <span className="w-10 h-10 rounded-full bg-green/10 flex items-center justify-center text-lg">
              <svg className="w-5 h-5 text-green-dark" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
              </svg>
            </span>
            <div className="flex-1 text-start">
              <p className="font-semibold text-sm">
                {copied === 'text'
                  ? (i18n.language === 'he' ? 'הועתק!' : 'Copied!')
                  : (i18n.language === 'he' ? 'העתק רשימה' : 'Copy List')}
              </p>
              <p className="text-xs text-text-secondary">{i18n.language === 'he' ? 'העתק טקסט ללוח' : 'Copy text to clipboard'}</p>
            </div>
          </button>

          {/* Share / copy link */}
          <button
            onClick={handleShareLink}
            className="w-full flex items-center gap-4 p-4 rounded-xl border border-neutral/20 bg-white hover:bg-bg transition-colors min-h-[56px]"
          >
            <span className="w-10 h-10 rounded-full bg-secondary/30 flex items-center justify-center text-lg">
              <svg className="w-5 h-5 text-text" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.386-3.04a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364l1.757 1.757" />
              </svg>
            </span>
            <div className="flex-1 text-start">
              <p className="font-semibold text-sm">
                {copied === 'link'
                  ? (i18n.language === 'he' ? 'הועתק!' : 'Copied!')
                  : (i18n.language === 'he' ? 'שתף קישור' : 'Share Link')}
              </p>
              <p className="text-xs text-text-secondary">{i18n.language === 'he' ? 'לחברי משק בית' : 'For household members'}</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
