import { useState } from 'react'
import { Link, useNavigate, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import LanguageToggle from '../components/LanguageToggle'

export default function SignUp() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmationSent, setConfirmationSent] = useState(false)

  if (user) {
    return <Navigate to="/" replace />
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: `${window.location.origin}/`,
      },
    })

    if (err) {
      setError(err.message)
      setLoading(false)
    } else if (data?.user?.identities?.length === 0) {
      setError(t('auth.emailAlreadyUsed', 'An account with this email already exists.'))
      setLoading(false)
    } else {
      setConfirmationSent(true)
      setLoading(false)
    }
  }

  if (confirmationSent) {
    return (
      <div className="min-h-dvh bg-bg flex items-center justify-center px-6">
        <div className="w-full max-w-sm animate-fade-in text-center">
          <span className="text-5xl mb-4 block">📬</span>
          <h1 className="text-2xl font-semibold text-text mb-2">
            {t('auth.checkEmail', 'Check your email')}
          </h1>
          <p className="text-text-secondary mb-6">
            {t('auth.confirmationSent', "We've sent a confirmation link to")}
            <br />
            <span className="font-semibold text-text">{email}</span>
          </p>
          <p className="text-text-secondary text-sm mb-8">
            {t('auth.clickToConfirm', 'Click the link in the email to activate your account, then come back and sign in.')}
          </p>
          <Link
            to="/signin"
            className="inline-block w-full py-3 rounded-xl bg-primary text-white font-medium text-lg hover:bg-primary-light active:bg-primary-dark transition-colors text-center"
          >
            {t('auth.goToSignIn', 'Go to Sign In')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-bg flex items-center justify-center px-6">
      <div className="absolute top-4 start-4">
        <LanguageToggle compact />
      </div>
      <div className="w-full max-w-sm animate-fade-in">
        <h1 className="text-3xl font-semibold text-text text-center mb-2">
          GroceryApp
        </h1>
        <p className="text-text-secondary text-center mb-8">
          {t('auth.signUp')}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-text mb-1">
              {t('auth.displayName')}
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t('auth.namePlaceholder')}
              required
              className="w-full px-4 py-3 rounded-xl border border-neutral bg-surface text-text placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

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

          <div>
            <label className="block text-sm font-semibold text-text mb-1">
              {t('auth.password')}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('auth.passwordPlaceholder')}
              required
              minLength={6}
              className="w-full px-4 py-3 rounded-xl border border-neutral bg-surface text-text placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          {error && (
            <p className="text-danger text-sm font-medium">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-primary text-white font-medium text-lg hover:bg-primary-light active:bg-primary-dark transition-colors disabled:opacity-50"
          >
            {loading ? t('auth.signingUp') : t('auth.signUp')}
          </button>
        </form>

        <p className="mt-6 text-center text-text-secondary text-sm">
          {t('auth.hasAccount')}{' '}
          <Link to="/signin" className="text-primary font-semibold">
            {t('auth.signIn')}
          </Link>
        </p>
      </div>
    </div>
  )
}
