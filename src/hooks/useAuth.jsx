import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import i18n from '../i18n'

const AuthContext = createContext(null)

async function fetchProfileWithRetry(userId, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (data) return data
    if (error && error.code !== 'PGRST116') return null
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, 500))
    }
  }
  return null
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const initialized = useRef(false)

  const loadProfile = useCallback(async (userId) => {
    const data = await fetchProfileWithRetry(userId)
    if (data) {
      // Sync localStorage language preference to profile
      const savedLang = localStorage.getItem('groceryapp-lang')
      if (savedLang && savedLang !== data.language) {
        supabase
          .from('profiles')
          .update({ language: savedLang })
          .eq('id', userId)
          .then(() => {}) // fire and forget
        data.language = savedLang
      }
      setProfile(data)
      if (data.language) {
        i18n.changeLanguage(data.language)
      }
    }
    return data
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!user) return null
    const data = await fetchProfileWithRetry(user.id)
    if (data) {
      setProfile(data)
      if (data.language && data.language !== i18n.language) {
        i18n.changeLanguage(data.language)
      }
    }
    return data
  }, [user])

  useEffect(() => {
    // Use onAuthStateChange as the single source of truth
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, s) => {
      setSession(s)
      setUser(s?.user ?? null)

      if (s?.user && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        // Only load profile on first init or sign in
        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
          await loadProfile(s.user.id)
        }
      }

      if (event === 'SIGNED_OUT') {
        setProfile(null)
      }

      // Always mark loading as done after first event
      if (!initialized.current) {
        initialized.current = true
        setLoading(false)
      }
    })

    // Safety timeout — if onAuthStateChange never fires (rare), unblock UI
    const timeout = setTimeout(() => {
      if (!initialized.current) {
        initialized.current = true
        setLoading(false)
      }
    }, 3000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [loadProfile])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    setProfile(null)
  }, [])

  const value = {
    user,
    session,
    profile,
    loading,
    signOut,
    refreshProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
