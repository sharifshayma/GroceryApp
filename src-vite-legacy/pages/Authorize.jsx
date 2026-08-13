// OAuth /authorize page. The MCP client (Claude mobile, claude.ai web)
// redirects the user here as part of the OAuth flow; we sign them in to
// Supabase, exchange their session for a short-lived auth code via
// /api/oauth/code, then redirect back to the client's redirect_uri with
// `?code=…&state=…`.

import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import LanguageToggle from '../components/LanguageToggle'

export default function Authorize() {
  const [searchParams] = useSearchParams()
  const redirectUri = searchParams.get('redirect_uri')
  const state = searchParams.get('state')

  const { user, loading: authLoading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // If the user is already signed in, the consent button calls this directly.
  async function authorizeAndRedirect(accessToken, refreshToken) {
    const res = await fetch('/api/oauth/code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: accessToken, refresh_token: refreshToken }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error_description || body.error || 'Could not issue auth code')
    }
    const { code } = await res.json()
    const url = new URL(redirectUri)
    url.searchParams.set('code', code)
    if (state) url.searchParams.set('state', state)
    window.location.href = url.toString()
  }

  async function handleSignInAndAuthorize(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (authError || !data?.session) {
        throw new Error(authError?.message || 'Sign in failed')
      }
      await authorizeAndRedirect(data.session.access_token, data.session.refresh_token)
    } catch (err) {
      setError(err.message || 'Something went wrong')
      setBusy(false)
    }
  }

  async function handleConsent() {
    setError('')
    setBusy(true)
    try {
      const { data, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !data?.session) {
        throw new Error('No active session — please sign in again.')
      }
      await authorizeAndRedirect(data.session.access_token, data.session.refresh_token)
    } catch (err) {
      setError(err.message || 'Something went wrong')
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!redirectUri) return
    try {
      new URL(redirectUri)
    } catch {
      setError('Invalid redirect_uri parameter.')
    }
  }, [redirectUri])

  if (!redirectUri) {
    return (
      <div className="min-h-dvh bg-bg flex items-center justify-center px-6">
        <p className="text-text-secondary">Missing redirect_uri parameter.</p>
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
          Connect to Claude
        </h1>
        <p className="text-text-secondary text-center mb-8">
          Allow Claude to read and update your grocery lists, stock, and tags.
        </p>

        {authLoading ? (
          <p className="text-text-secondary text-center">Loading…</p>
        ) : user ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-surface border border-neutral p-4 text-sm text-text">
              Signed in as <strong>{user.email}</strong>.
            </div>
            {error && <p className="text-danger text-sm font-medium">{error}</p>}
            <button
              type="button"
              onClick={handleConsent}
              disabled={busy}
              className="w-full py-3 rounded-xl bg-primary text-white font-medium text-lg hover:bg-primary-light active:bg-primary-dark transition-colors disabled:opacity-50"
            >
              {busy ? 'Connecting…' : 'Allow access'}
            </button>
            <button
              type="button"
              onClick={() => supabase.auth.signOut()}
              className="w-full text-center text-sm text-primary font-semibold"
            >
              Sign in as a different user
            </button>
          </div>
        ) : (
          <form onSubmit={handleSignInAndAuthorize} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-text mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-neutral bg-surface text-text placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-text mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-neutral bg-surface text-text placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            {error && <p className="text-danger text-sm font-medium">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full py-3 rounded-xl bg-primary text-white font-medium text-lg hover:bg-primary-light active:bg-primary-dark transition-colors disabled:opacity-50"
            >
              {busy ? 'Signing in…' : 'Sign in & allow access'}
            </button>
          </form>
        )}

        <p className="text-xs text-center text-text-secondary mt-6">
          Claude will receive a token scoped to your household. You can revoke
          access at any time from your account.
        </p>
      </div>
    </div>
  )
}
