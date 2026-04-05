import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import LanguageToggle from '../components/LanguageToggle'

export default function ForgotPassword() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: err } = await supabase.auth.resetPasswordForEmail(email)

    if (err) {
      setError(err.message)
    } else {
      setSuccess(true)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-dvh bg-bg flex items-center justify-center px-6">
      <div className="absolute top-4 start-4">
        <LanguageToggle compact />
      </div>
      <div className="w-full max-w-sm animate-fade-in">
        <h1 className="text-3xl font-extrabold text-text text-center mb-2">
          GroceryApp
        </h1>
        <p className="text-text-secondary text-center mb-8">
          {t('auth.resetPassword')}
        </p>

        {success ? (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-green/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-green" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <p className="text-text font-medium">{t('auth.resetSent')}</p>
            <Link to="/signin" className="text-primary font-semibold text-sm">
              {t('auth.signIn')}
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-text mb-1">
                {t('auth.email')}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('auth.emailPlaceholder')}
                required
                className="w-full px-4 py-3 rounded-xl border border-neutral bg-surface text-text placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            {error && (
              <p className="text-danger text-sm font-medium">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-primary text-white font-bold text-lg hover:bg-primary-light active:bg-primary-dark transition-colors disabled:opacity-50"
            >
              {loading ? t('auth.sending') : t('auth.resetPassword')}
            </button>

            <p className="text-center text-text-secondary text-sm">
              <Link to="/signin" className="text-primary font-semibold">
                {t('common.back')}
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
