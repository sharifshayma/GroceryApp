import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getCategoryName } from '../lib/categoryName'
import { IconShare, IconCopy, IconLink, IconClose } from './Icons'

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
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 animate-backdrop" onClick={onClose} />
      <div
        className="relative bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[85vh] overflow-y-auto animate-slide-up sm:animate-fade-in"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
      >
        <div className="px-5 pt-5 pb-3 border-b border-neutral/50 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text">
            {i18n.language === 'he' ? 'שתף רשימה' : 'Share List'}
          </h2>
          <button onClick={onClose} className="w-11 h-11 rounded-full bg-neutral/30 flex items-center justify-center text-text hover:bg-neutral/50 transition-colors">
            <IconClose />
          </button>
        </div>

        <div className="p-4 pb-20 space-y-2">
          {/* Share via platform */}
          <button
            onClick={handleShareText}
            className="w-full flex items-center gap-4 p-4 rounded-xl border border-neutral/20 bg-white hover:bg-bg transition-colors min-h-[56px]"
          >
            <span className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-lg">
              <IconShare className="w-5 h-5 text-primary" />
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
              <IconCopy className="w-5 h-5 text-green-dark" />
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
              <IconLink className="w-5 h-5 text-text" />
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
