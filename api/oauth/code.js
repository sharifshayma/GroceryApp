// Internal endpoint called by /authorize after the user signs in. It packs
// the user's fresh Supabase tokens into a short-lived auth code that we hand
// back to the OAuth client via the redirect.

import { createAuthCode } from '../../src/lib/oauthCodes.js'

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

export default function handler(req, res) {
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

  const { access_token, refresh_token } = req.body || {}
  if (!access_token || !refresh_token) {
    res.status(400).json({ error: 'invalid_request', error_description: 'Missing tokens' })
    return
  }

  res.status(200).json({ code: createAuthCode(access_token, refresh_token) })
}
