import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import LoadingSpinner from '../components/LoadingSpinner'

export default function JoinHousehold() {
  const { inviteCode } = useParams()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, profile, refreshProfile } = useAuth()
  const [household, setHousehold] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)

  // If user already has a household, redirect home
  useEffect(() => {
    if (profile?.household_id) {
      navigate('/', { replace: true })
    }
  }, [profile, navigate])

  // Look up household by invite code
  useEffect(() => {
    async function lookup() {
      const { data, error: err } = await supabase
        .from('households')
        .select('id, name')
        .eq('invite_code', inviteCode)
        .single()

      if (err || !data) {
        setError(t('household.invalidCode'))
      } else {
        setHousehold(data)
      }
      setLoading(false)
    }
    lookup()
  }, [inviteCode, t])

  const handleJoin = async () => {
    setJoining(true)
    setError('')

    try {
      const { error: err } = await supabase
        .from('profiles')
        .update({ household_id: household.id, role: 'member' })
        .eq('id', user.id)

      if (err) throw err

      await refreshProfile()
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message)
      setJoining(false)
    }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="min-h-dvh bg-bg flex items-center justify-center px-6">
      <div className="w-full max-w-sm text-center animate-fade-in space-y-6">
        {error ? (
          <>
            <div className="w-20 h-20 mx-auto rounded-full bg-danger/10 flex items-center justify-center">
              <span className="text-4xl">❌</span>
            </div>
            <p className="text-danger font-medium">{error}</p>
            <button
              onClick={() => navigate('/household-setup', { replace: true })}
              className="w-full py-3 rounded-xl bg-primary text-white font-medium text-lg"
            >
              {t('common.back')}
            </button>
          </>
        ) : (
          <>
            <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-4xl">🏠</span>
            </div>
            <h2 className="text-2xl font-semibold text-text">
              {t('household.joinConfirm', { name: household.name })}
            </h2>
            <button
              onClick={handleJoin}
              disabled={joining}
              className="w-full py-3 rounded-xl bg-primary text-white font-medium text-lg hover:bg-primary-light active:bg-primary-dark transition-colors disabled:opacity-50"
            >
              {joining ? t('household.joining') : t('household.join')}
            </button>
            <button
              onClick={() => navigate('/household-setup', { replace: true })}
              className="w-full py-2 text-text-secondary font-semibold text-sm"
            >
              {t('common.cancel')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
