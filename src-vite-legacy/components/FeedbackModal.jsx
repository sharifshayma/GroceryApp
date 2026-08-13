import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { IconClose } from './Icons'

export default function FeedbackModal({ onClose }) {
  const { i18n } = useTranslation()
  const { user, profile } = useAuth()
  const [message, setMessage] = useState('')
  const [image, setImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  const isHe = i18n.language === 'he'

  const handleImageChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      setError(isHe ? 'הקובץ גדול מדי (מקסימום 5MB)' : 'File too large (max 5MB)')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setImage(reader.result)
      setImagePreview(reader.result)
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = async () => {
    if (!message.trim()) return
    setSending(true)
    setError('')

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message.trim(),
          userName: profile?.display_name || '',
          userEmail: user?.email || '',
          image,
        }),
      })

      if (!res.ok) throw new Error('Failed')
      setSent(true)
    } catch {
      setError(isHe ? 'שליחה נכשלה, נסה שוב' : 'Failed to send, please try again')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 animate-backdrop" onClick={onClose} />
      <div
        className="relative bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[85vh] overflow-y-auto animate-slide-up sm:animate-fade-in"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-neutral/50 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text">
            {isHe ? 'שלח משוב' : 'Send Feedback'}
          </h2>
          <button onClick={onClose} className="w-11 h-11 rounded-full bg-neutral/30 flex items-center justify-center text-text hover:bg-neutral/50 transition-colors">
            <IconClose />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {sent ? (
            <div className="text-center py-8">
              <span className="text-5xl mb-3 block">✅</span>
              <h3 className="text-lg font-semibold text-text mb-1">
                {isHe ? 'תודה על המשוב!' : 'Thanks for your feedback!'}
              </h3>
              <p className="text-text-secondary text-sm">
                {isHe ? 'נקרא את ההודעה שלך בקרוב' : "We'll read your message soon"}
              </p>
              <button
                onClick={onClose}
                className="mt-6 px-8 py-2.5 rounded-xl bg-primary text-white font-medium"
              >
                {isHe ? 'סגור' : 'Close'}
              </button>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  {isHe ? 'מה תרצה לשתף?' : 'What would you like to share?'}
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={isHe ? 'כתוב את המשוב שלך כאן...' : 'Write your feedback here...'}
                  rows={4}
                  className="w-full px-3 py-2.5 rounded-xl border border-neutral/40 bg-bg text-text placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                />
              </div>

              {/* Image upload */}
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
                {imagePreview ? (
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="Screenshot"
                      className="w-full h-40 object-cover rounded-xl border border-neutral/30"
                    />
                    <button
                      onClick={() => { setImage(null); setImagePreview(null) }}
                      className="absolute top-2 end-2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center text-sm"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-neutral/40 text-text-secondary text-sm hover:bg-bg transition-colors"
                  >
                    📷 {isHe ? 'הוסף צילום מסך' : 'Add a screenshot'}
                  </button>
                )}
              </div>

              {error && <p className="text-danger text-sm font-medium">{error}</p>}

              <button
                onClick={handleSubmit}
                disabled={sending || !message.trim()}
                className="w-full py-3.5 rounded-xl bg-primary text-white font-medium text-lg hover:bg-primary-light active:bg-primary-dark transition-colors disabled:opacity-50 min-h-[48px]"
              >
                {sending
                  ? (isHe ? 'שולח...' : 'Sending...')
                  : (isHe ? 'שלח משוב' : 'Send Feedback')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
