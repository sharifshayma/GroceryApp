/* global Buffer */
// Stateless OAuth auth-code encoding. Server-only — imported from
// api/oauth/code.js and api/oauth/token.js, never bundled into the browser.
//
// The "code" we hand back to the OAuth client is a base64url-encoded JSON blob
// containing the Supabase session tokens that the user just signed in with.
// Codes are short-lived (5 min) and consumed immediately by the token endpoint,
// so we don't need a database row for them — the serverless functions stay
// stateless. Pattern borrowed from the FitFlow MCP.

const CODE_TTL_MS = 5 * 60 * 1000

export function createAuthCode(accessToken, refreshToken) {
  const payload = {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: Date.now() + CODE_TTL_MS,
  }
  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

export function redeemAuthCode(code) {
  try {
    const json = Buffer.from(code, 'base64url').toString('utf-8')
    const payload = JSON.parse(json)
    if (Date.now() > payload.expires_at) return null
    return { access_token: payload.access_token, refresh_token: payload.refresh_token }
  } catch {
    return null
  }
}
