// OAuth token endpoint — exchanges auth codes (issued by /api/oauth/code) for
// Supabase tokens, and refreshes them via Supabase's own refresh flow.
//
// The "access token" we return is a Supabase session JWT; api/mcp.js validates
// it by handing it to supabase.auth.getUser() and then resolves household_id.

import { createClient } from '@supabase/supabase-js'
import { redeemAuthCode } from '../../src/lib/oauthCodes.js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

export default async function handler(req, res) {
  setCors(res)
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  // Vercel parses both application/json and application/x-www-form-urlencoded
  // into req.body for us, so we can read fields uniformly.
  const body = req.body || {}
  const grantType = body.grant_type
  const code = body.code
  const refreshToken = body.refresh_token

  if (grantType === 'authorization_code') {
    if (!code) {
      return res.status(400).json({ error: 'invalid_request', error_description: 'Missing code' })
    }
    const tokens = redeemAuthCode(code)
    if (!tokens) {
      return res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid or expired code' })
    }
    return res.status(200).json({
      access_token: tokens.access_token,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: tokens.refresh_token,
    })
  }

  if (grantType === 'refresh_token') {
    if (!refreshToken) {
      return res.status(400).json({ error: 'invalid_request', error_description: 'Missing refresh_token' })
    }
    if (!SUPABASE_URL || !ANON_KEY) {
      return res.status(500).json({ error: 'server_error', error_description: 'Supabase env not configured' })
    }
    const supabase = createClient(SUPABASE_URL, ANON_KEY)
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken })
    if (error || !data?.session) {
      return res.status(400).json({ error: 'invalid_grant', error_description: error?.message || 'Refresh failed' })
    }
    return res.status(200).json({
      access_token: data.session.access_token,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: data.session.refresh_token,
    })
  }

  return res.status(400).json({ error: 'unsupported_grant_type' })
}
