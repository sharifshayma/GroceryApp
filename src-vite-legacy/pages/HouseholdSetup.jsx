import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { seedDefaultCategories } from '../lib/seedCategories'

export default function HouseholdSetup() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, profile, refreshProfile } = useAuth()
  const [mode, setMode] = useState(null) // null | 'create' | 'join'
  const [name, setName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)

  if (profile?.household_id) {
    return <Navigate to="/" replace />
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Create household
      const { data: household, error: hErr } = await supabase
        .from('households')
        .insert({ name, created_by: user.id })
        .select()
        .single()

      if (hErr) throw hErr

      // Update user profile with household
      const { error: pErr } = await supabase
        .from('profiles')
        .update({ household_id: household.id, role: 'owner' })
        .eq('id', user.id)

      if (pErr) throw pErr

      // Seed default categories
      await seedDefaultCategories(household.id)

      // Show invite code
      setInviteCode(household.invite_code)
      await refreshProfile()
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  const handleJoin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Look up household by invite code
      const { data: household, error: hErr } = await supabase
        .from('households')
        .select('id, name')
        .eq('invite_code', joinCode.trim())
        .single()

      if (hErr || !household) {
        setError(t('household.invalidCode'))
        setLoading(false)
        return
      }

      // Update profile
      const { error: pErr } = await supabase
        .from('profiles')
        .update({ household_id: household.id, role: 'member' })
        .eq('id', user.id)

      if (pErr) throw pErr

      await refreshProfile()
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  const copyCode = async () => {
    await navigator.clipboard.writeText(inviteCode)
    setCodeCopied(true)
    setTimeout(() => setCodeCopied(false), 2000)
  }

  const shareCode = async () => {
    const url = `${window.location.origin}/join/${inviteCode}`
    const text = `${t('household.inviteMessage')} ${inviteCode}\n${url}`

    if (navigator.share) {
      try {
        await navigator.share({ text })
      } catch {
        await copyCode()
      }
    } else {
      await copyCode()
    }
  }

  // Show invite code after creation
  if (inviteCode) {
    return (
      <div className="min-h-dvh bg-bg flex items-center justify-center px-6">
        <div className="w-full max-w-sm text-center animate-fade-in space-y-6">
          <div className="w-20 h-20 mx-auto rounded-full bg-green/10 flex items-center justify-center">
            <span className="text-4xl">🏠</span>
          </div>
          <h2 className="text-2xl font-semibold text-text">
            {name}
          </h2>
          <div className="bg-surface rounded-2xl p-6 border border-neutral">
            <p className="text-text-secondary text-sm mb-2">
              {t('household.inviteCode')}
            </p>
            <p className="text-3xl font-semibold text-primary tracking-widest mb-4">
              {inviteCode}
            </p>
            <div className="flex gap-3">
              <button
                onClick={copyCode}
                className="flex-1 py-2.5 rounded-xl border border-neutral bg-surface text-text font-semibold text-sm hover:bg-bg transition-colors"
              >
                {codeCopied ? t('household.codeCopied') : t('household.copyCode')}
              </button>
              <button
                onClick={shareCode}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary-light active:bg-primary-dark transition-colors"
              >
                {t('household.shareCode')}
              </button>
            </div>
          </div>
          <button
            onClick={() => navigate('/', { replace: true })}
            className="w-full py-3 rounded-xl bg-primary text-white font-medium text-lg hover:bg-primary-light active:bg-primary-dark transition-colors"
          >
            {t('nav.home')} →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-bg flex items-center justify-center px-6">
      <div className="w-full max-w-sm animate-fade-in">
        <h1 className="text-2xl font-semibold text-text text-center mb-2">
          {t('household.setup')}
        </h1>
        <p className="text-text-secondary text-center mb-8">🏠</p>

        {!mode && (
          <div className="space-y-4">
            <button
              onClick={() => setMode('create')}
              className="w-full py-4 rounded-2xl bg-surface border border-neutral text-text font-medium text-lg hover:bg-bg transition-colors"
            >
              {t('household.createTitle')}
            </button>
            <div className="text-center text-text-secondary font-medium">
              {t('household.or')}
            </div>
            <button
              onClick={() => setMode('join')}
              className="w-full py-4 rounded-2xl bg-surface border border-neutral text-text font-medium text-lg hover:bg-bg transition-colors"
            >
              {t('household.joinTitle')}
            </button>
          </div>
        )}

        {mode === 'create' && (
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-text mb-1">
                {t('household.name')}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('household.namePlaceholder')}
                required
                className="w-full px-4 py-3 rounded-xl border border-neutral bg-surface text-text placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            {error && <p className="text-danger text-sm font-medium">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-primary text-white font-medium text-lg hover:bg-primary-light active:bg-primary-dark transition-colors disabled:opacity-50"
            >
              {loading ? t('household.creating') : t('household.create')}
            </button>
            <button
              type="button"
              onClick={() => { setMode(null); setError('') }}
              className="w-full py-2 text-text-secondary font-semibold text-sm"
            >
              {t('common.back')}
            </button>
          </form>
        )}

        {mode === 'join' && (
          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-text mb-1">
                {t('household.inviteCode')}
              </label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder={t('household.inviteCodePlaceholder')}
                required
                className="w-full px-4 py-3 rounded-xl border border-neutral bg-surface text-text text-center text-xl tracking-widest placeholder:text-text-secondary placeholder:text-base placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            {error && <p className="text-danger text-sm font-medium">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-primary text-white font-medium text-lg hover:bg-primary-light active:bg-primary-dark transition-colors disabled:opacity-50"
            >
              {loading ? t('household.joining') : t('household.join')}
            </button>
            <button
              type="button"
              onClick={() => { setMode(null); setError('') }}
              className="w-full py-2 text-text-secondary font-semibold text-sm"
            >
              {t('common.back')}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
