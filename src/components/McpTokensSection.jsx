import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

// Generates a random 32-byte token, hex-encoded (64 chars).
function generateToken() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function sha256Hex(input) {
  const enc = new TextEncoder().encode(input)
  const buf = await crypto.subtle.digest('SHA-256', enc)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export default function McpTokensSection() {
  const { i18n } = useTranslation()
  const { user, profile } = useAuth()
  const isHe = i18n.language === 'he'
  const [tokens, setTokens] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [newToken, setNewToken] = useState(null) // shown once after creation
  const [copied, setCopied] = useState(false)
  const [showSection, setShowSection] = useState(false)

  const fetchTokens = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase
      .from('mcp_tokens')
      .select('id, name, last_four, created_at, last_used_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (!error) setTokens(data || [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchTokens()
  }, [fetchTokens])

  const handleGenerate = async () => {
    if (!user || !profile?.household_id) return
    const name = window.prompt(
      isHe ? 'שם לאסימון (לדוגמה: "Claude Desktop")' : 'Token name (e.g. "Claude Desktop")',
      'Claude'
    )
    if (name === null) return
    setGenerating(true)
    try {
      const token = generateToken()
      const tokenHash = await sha256Hex(token)
      const { error } = await supabase.from('mcp_tokens').insert({
        token_hash: tokenHash,
        household_id: profile.household_id,
        user_id: user.id,
        name: name.trim() || 'Untitled',
        last_four: token.slice(-4),
      })
      if (error) throw error
      setNewToken(token)
      setCopied(false)
      await fetchTokens()
    } catch (e) {
      alert(`Failed to generate token: ${e.message}`)
    }
    setGenerating(false)
  }

  const handleCopy = async () => {
    if (!newToken) return
    await navigator.clipboard.writeText(newToken)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRevoke = async (tokenId, tokenName) => {
    const ok = window.confirm(
      isHe
        ? `לבטל את האסימון "${tokenName}"? לא ניתן לשחזר.`
        : `Revoke token "${tokenName}"? This cannot be undone.`
    )
    if (!ok) return
    const { error } = await supabase.from('mcp_tokens').delete().eq('id', tokenId)
    if (error) {
      alert(`Failed to revoke: ${error.message}`)
      return
    }
    await fetchTokens()
  }

  return (
    <div className="bg-surface rounded-2xl border border-neutral overflow-hidden">
      <button
        type="button"
        onClick={() => setShowSection((v) => !v)}
        className="w-full flex items-center justify-between p-5 hover:bg-bg transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">🔌</span>
          <div className="text-start">
            <p className="font-semibold">
              {isHe ? 'חיבור ל-Claude' : 'Connect to Claude'}
            </p>
            <p className="text-xs text-text-secondary">
              {isHe
                ? 'נהל אסימונים לשרת ה-MCP'
                : 'Manage MCP server tokens'}
            </p>
          </div>
        </div>
        <span className={`text-text-secondary transition-transform ${showSection ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {showSection && (
        <div className="border-t border-neutral p-5 space-y-4">
          {newToken && (
            <div className="rounded-xl border border-primary/40 bg-primary/5 p-4 space-y-3">
              <div>
                <p className="text-sm font-semibold text-text">
                  {isHe ? 'האסימון שלך — שמור אותו עכשיו' : 'Your token — save it now'}
                </p>
                <p className="text-xs text-text-secondary mt-0.5">
                  {isHe
                    ? 'לא נציג אותו שוב. הצמד אותו להגדרות Claude Desktop.'
                    : "We won't show this again. Paste it into your Claude Desktop config."}
                </p>
              </div>
              <code className="block p-3 rounded-lg bg-white border border-neutral text-xs break-all font-mono">
                {newToken}
              </code>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex-1 py-2 rounded-lg bg-primary text-white text-sm font-medium"
                >
                  {copied
                    ? (isHe ? 'הועתק ✓' : 'Copied ✓')
                    : (isHe ? 'העתק אסימון' : 'Copy token')}
                </button>
                <button
                  type="button"
                  onClick={() => setNewToken(null)}
                  className="px-4 py-2 rounded-lg bg-white border border-neutral text-text-secondary text-sm font-medium"
                >
                  {isHe ? 'סגור' : 'Done'}
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="w-full py-2.5 rounded-xl bg-primary text-white font-medium text-sm disabled:opacity-50"
          >
            {generating
              ? (isHe ? 'יוצר...' : 'Generating...')
              : (isHe ? '+ צור אסימון חדש' : '+ Generate new token')}
          </button>

          <div>
            <p className="text-xs font-semibold text-text-secondary uppercase mb-2">
              {isHe ? 'אסימונים פעילים' : 'Active tokens'}
            </p>
            {loading ? (
              <p className="text-sm text-text-secondary">{isHe ? 'טוען...' : 'Loading...'}</p>
            ) : tokens.length === 0 ? (
              <p className="text-sm text-text-secondary">
                {isHe ? 'עדיין אין אסימונים.' : 'No tokens yet.'}
              </p>
            ) : (
              <ul className="space-y-2">
                {tokens.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-bg border border-neutral/50"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{t.name || 'Untitled'}</p>
                      <p className="text-xs text-text-secondary">
                        ••••{t.last_four || '????'} · {new Date(t.created_at).toLocaleDateString()}
                        {t.last_used_at
                          ? ` · ${isHe ? 'שימוש אחרון' : 'last used'} ${new Date(t.last_used_at).toLocaleDateString()}`
                          : ` · ${isHe ? 'לא נעשה בו שימוש' : 'never used'}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRevoke(t.id, t.name || 'Untitled')}
                      className="px-3 py-1.5 rounded-lg text-danger text-xs font-medium hover:bg-danger/10"
                    >
                      {isHe ? 'בטל' : 'Revoke'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
