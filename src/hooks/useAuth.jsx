import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { supabase, checkSupabaseConnectivity } from '../lib/supabase'
import { emit } from '../lib/events'
import i18n from '../i18n'

const AuthContext = createContext(null)

async function fetchProfileWithRetry(userId, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    const start = Date.now()
    console.log(`[Auth] Profile fetch attempt ${i + 1}/${attempts}...`)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    console.log(`[Auth] Profile fetch attempt ${i + 1} completed in ${Date.now() - start}ms`, data ? 'OK' : `error: ${error?.code}`)
    if (data) return data
    if (error && error.code !== 'PGRST116') return null
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, 500))
    }
  }

  // Profile doesn't exist — trigger may have failed during sign-up. Create it now.
  console.warn('[Auth] Profile not found after retries — creating profile for user:', userId)
  const { data: session } = await supabase.auth.getSession()
  const email = session?.session?.user?.email || ''
  const displayName = session?.session?.user?.user_metadata?.display_name || email.split('@')[0]

  const { data: newProfile, error: insertErr } = await supabase
    .from('profiles')
    .insert({ id: userId, email, display_name: displayName })
    .select()
    .single()

  if (insertErr) {
    console.error('[Auth] Failed to create missing profile:', insertErr.message)
    return null
  }
  console.log('[Auth] Created missing profile for user:', userId)
  return newProfile
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const initialized = useRef(false)
  const profileRef = useRef(null)

  const loadProfile = useCallback(async (userId) => {
    console.log('[Auth] Loading profile for user:', userId)
    const data = await fetchProfileWithRetry(userId)
    if (data) {
      console.log('[Auth] Profile loaded — household_id:', data.household_id)
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
      profileRef.current = data
      if (data.language) {
        i18n.changeLanguage(data.language)
      }
    } else {
      console.warn('[Auth] Profile fetch returned null for user:', userId)
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

  // On tab return: do a full page reload instead of trying to refetch
  // through the Supabase client. The client's internal fetch queue hangs
  // after browser tab suspension, causing all queries to time out.
  // A reload gives a clean slate — auth re-initializes, hooks fetch fresh.
  const lastHidden = useRef(0)
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        lastHidden.current = Date.now()
      }
      if (document.visibilityState === 'visible' && lastHidden.current > 0) {
        const awayMs = Date.now() - lastHidden.current
        console.log(`[Auth] App resumed after ${Math.round(awayMs / 1000)}s`)
        // Only reload if away for more than 5 seconds (skip quick tab switches)
        if (awayMs > 5000) {
          console.log('[Auth] Reloading for fresh state...')
          window.location.reload()
        }
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  // Run connectivity check on mount
  useEffect(() => {
    checkSupabaseConnectivity()
  }, [])

  useEffect(() => {
    // Use onAuthStateChange as the single source of truth
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, s) => {
      console.log('[Auth] onAuthStateChange:', event, s?.user?.id ?? 'no user')
      setSession(s)
      setUser(s?.user ?? null)

      if (s?.user && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        // Load profile on first init or fresh login (when profile is null).
        // Skip if profile already exists to avoid re-triggering all data hooks
        // (SIGNED_IN re-fires on tab return after getSession()).
        if (event === 'INITIAL_SESSION' || (event === 'SIGNED_IN' && !profileRef.current)) {
          // On fresh login, INITIAL_SESSION fires with no user (sets loading=false),
          // then SIGNED_IN fires. Re-set loading so HouseholdGuard waits for profile.
          if (event === 'SIGNED_IN' && initialized.current) {
            setLoading(true)
          }
          await loadProfile(s.user.id)
          // Mark loading done after profile is loaded (for SIGNED_IN after init)
          if (event === 'SIGNED_IN' && initialized.current) {
            setLoading(false)
          }
        }
      }

      if (event === 'SIGNED_OUT') {
        setProfile(null)
        profileRef.current = null
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
        console.warn('[Auth] Safety timeout triggered — onAuthStateChange did not fire within 3s')
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
