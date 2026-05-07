// Dynamic Client Registration (RFC 7591).
//
// We don't actually persist clients — auth is bound to the user's Supabase
// session in the /authorize step, so the client_id/secret here are just
// ceremony for spec-compliant MCP clients. Pattern from FitFlow.

import { randomUUID } from 'crypto'

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

  const body = req.body || {}
  res.status(200).json({
    client_id: body.client_id || randomUUID(),
    client_secret: randomUUID(),
    client_id_issued_at: Math.floor(Date.now() / 1000),
    client_secret_expires_at: 0,
    redirect_uris: body.redirect_uris || [],
    token_endpoint_auth_method: 'client_secret_post',
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    client_name: body.client_name || 'MCP Client',
  })
}
