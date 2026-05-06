import { createClient } from '@supabase/supabase-js'

export { withTimeout } from './withTimeout.js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Bypass navigator.locks to prevent orphaned lock hangs.
    // The default lock implementation can leave orphaned locks that block
    // ALL Supabase operations until the 5s forced-acquire timeout.
    lock: async (name, acquireTimeout, fn) => await fn(),
  },
})

/**
 * Run on app startup to test raw connectivity to Supabase.
 */
export async function checkSupabaseConnectivity() {
  const start = Date.now()
  try {
    const resp = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'HEAD',
      headers: { apikey: supabaseAnonKey },
      signal: AbortSignal.timeout(5000),
    })
    console.log(`[Supabase] Connectivity check: ${resp.status} in ${Date.now() - start}ms`)
    return true
  } catch (e) {
    console.error(`[Supabase] Connectivity check FAILED after ${Date.now() - start}ms:`, e.message)
    return false
  }
}
