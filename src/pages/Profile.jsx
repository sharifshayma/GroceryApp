import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import LanguageToggle from '../components/LanguageToggle'

export default function Profile() {
  const { t } = useTranslation()
  const { user, profile, signOut, refreshProfile } = useAuth()
  const [displayName, setDisplayName] = useState(profile?.display_name || '')
  const [editingName, setEditingName] = useState(false)
  const [members, setMembers] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (profile?.display_name) setDisplayName(profile.display_name)
  }, [profile])

  useEffect(() => {
    if (!profile?.household_id) return
    supabase
      .from('profiles')
      .select('id, display_name, email')
      .eq('household_id', profile.household_id)
      .then(({ data }) => {
        if (data) setMembers(data)
      })
  }, [profile?.household_id])

  const saveName = async () => {
    setSaving(true)
    await supabase
      .from('profiles')
      .update({ display_name: displayName })
      .eq('id', user.id)
    await refreshProfile()
    setEditingName(false)
    setSaving(false)
  }

  const copyInviteCode = async () => {
    if (!profile?.household_id) return
    const { data } = await supabase
      .from('households')
      .select('invite_code')
      .eq('id', profile.household_id)
      .single()

    if (data?.invite_code) {
      const url = `${window.location.origin}/join/${data.invite_code}`
      const text = `${t('household.inviteMessage')} ${data.invite_code}\n${url}`

      if (navigator.share) {
        try {
          await navigator.share({ text })
          return
        } catch { /* fallback to clipboard */ }
      }
      await navigator.clipboard.writeText(text)
      alert(t('household.codeCopied'))
    }
  }

  return (
    <div className="px-4 pt-6 pb-8 max-w-lg mx-auto space-y-6 animate-fade-in">
      <h1 className="text-2xl font-semibold">{t('profile.title')}</h1>

      {/* User info */}
      <div className="bg-surface rounded-2xl p-5 border border-neutral space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            {editingName ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-neutral bg-bg text-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                />
                <button
                  onClick={saveName}
                  disabled={saving}
                  className="px-3 py-2 rounded-xl bg-primary text-white font-semibold text-sm"
                >
                  {t('common.save')}
                </button>
                <button
                  onClick={() => {
                    setEditingName(false)
                    setDisplayName(profile?.display_name || '')
                  }}
                  className="px-3 py-2 rounded-xl text-text-secondary font-semibold text-sm"
                >
                  {t('common.cancel')}
                </button>
              </div>
            ) : (
              <div>
                <p className="text-lg font-medium">{profile?.display_name}</p>
                <p className="text-text-secondary text-sm">{user?.email}</p>
              </div>
            )}
          </div>
          {!editingName && (
            <button
              onClick={() => setEditingName(true)}
              className="text-primary font-semibold text-sm"
            >
              {t('common.edit')}
            </button>
          )}
        </div>
      </div>

      {/* Language */}
      <div className="bg-surface rounded-2xl p-5 border border-neutral">
        <div className="flex items-center justify-between">
          <span className="font-semibold">{t('profile.language')}</span>
          <LanguageToggle />
        </div>
      </div>

      {/* Household */}
      <div className="bg-surface rounded-2xl p-5 border border-neutral space-y-4">
        <div className="flex items-center justify-between">
          <span className="font-semibold">{t('profile.household')}</span>
          <button
            onClick={copyInviteCode}
            className="text-primary font-semibold text-sm"
          >
            {t('household.inviteMembers')}
          </button>
        </div>

        {members.length > 0 && (
          <div className="space-y-2">
            <p className="text-text-secondary text-xs font-semibold uppercase">
              {t('household.members')}
            </p>
            {members.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 py-1"
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm">
                  {(m.display_name || m.email || '?')[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold">{m.display_name || m.email}</p>
                  {m.id === user.id && (
                    <span className="text-xs text-text-secondary">({t('nav.profile')})</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Management links */}
      <div className="bg-surface rounded-2xl border border-neutral divide-y divide-neutral">
        <Link to="/manage-categories" className="w-full px-5 py-4 text-start font-semibold text-text flex items-center justify-between">
          {t('profile.manageCategories')}
          <svg className="w-5 h-5 text-text-secondary" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </Link>
        <Link to="/manage-tags" className="w-full px-5 py-4 text-start font-semibold text-text flex items-center justify-between">
          {t('profile.manageTags')}
          <svg className="w-5 h-5 text-text-secondary" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </Link>
      </div>

      {/* Sign out */}
      <button
        onClick={signOut}
        className="w-full py-3 rounded-xl bg-danger/10 text-danger font-medium text-lg transition-colors hover:bg-danger/20"
      >
        {t('auth.signOut')}
      </button>
    </div>
  )
}
