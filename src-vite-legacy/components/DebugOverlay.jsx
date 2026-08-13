import { useState, useEffect, useRef } from 'react'

const MAX_LOGS = 50

export default function DebugOverlay() {
  const [logs, setLogs] = useState([])
  const [open, setOpen] = useState(false)
  const [hasError, setHasError] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => {
    const origLog = console.log
    const origWarn = console.warn
    const origError = console.error

    const addLog = (level, args) => {
      const text = args
        .map((a) => (typeof a === 'object' ? JSON.stringify(a, null, 1) : String(a)))
        .join(' ')
      // Only capture app logs (prefixed with [) to reduce noise
      if (!text.startsWith('[')) return
      const entry = { level, text, time: new Date().toLocaleTimeString() }
      setLogs((prev) => [...prev.slice(-(MAX_LOGS - 1)), entry])
      if (level === 'error') setHasError(true)
    }

    console.log = (...args) => {
      origLog.apply(console, args)
      addLog('log', args)
    }
    console.warn = (...args) => {
      origWarn.apply(console, args)
      addLog('warn', args)
    }
    console.error = (...args) => {
      origError.apply(console, args)
      addLog('error', args)
    }

    return () => {
      console.log = origLog
      console.warn = origWarn
      console.error = origError
    }
  }, [])

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs, open])

  const levelColor = { log: '#888', warn: '#b8860b', error: '#d32f2f' }

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => {
          setOpen(!open)
          setHasError(false)
        }}
        style={{
          position: 'fixed',
          bottom: 80,
          left: 12,
          zIndex: 9999,
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: 'none',
          background: hasError ? '#d32f2f' : '#333',
          color: '#fff',
          fontSize: 14,
          fontWeight: 'bold',
          opacity: open ? 1 : 0.5,
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        }}
      >
        {hasError ? '!' : '>'}
      </button>

      {/* Log panel */}
      {open && (
        <div
          style={{
            position: 'fixed',
            bottom: 120,
            left: 8,
            right: 8,
            zIndex: 9998,
            maxHeight: '40vh',
            background: '#1a1a1a',
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              padding: '8px 12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid #333',
            }}
          >
            <span style={{ color: '#aaa', fontSize: 12, fontWeight: 'bold' }}>
              Debug Console ({logs.length})
            </span>
            <button
              onClick={async () => {
                const regs = await navigator.serviceWorker.getRegistrations()
                for (const r of regs) await r.unregister()
                const keys = await caches.keys()
                for (const k of keys) await caches.delete(k)
                window.location.reload()
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#e57373',
                fontSize: 11,
                cursor: 'pointer',
                marginRight: 8,
              }}
            >
              Purge & Reload
            </button>
            <button
              onClick={() => setLogs([])}
              style={{
                background: 'none',
                border: 'none',
                color: '#888',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              Clear
            </button>
          </div>
          <div
            ref={scrollRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '4px 0',
              maxHeight: 'calc(40vh - 40px)',
            }}
          >
            {logs.length === 0 && (
              <div style={{ color: '#555', fontSize: 11, padding: '12px', textAlign: 'center' }}>
                No app logs yet. Logs prefixed with [Auth], [useLists], etc. will appear here.
              </div>
            )}
            {logs.map((entry, i) => (
              <div
                key={i}
                style={{
                  padding: '3px 12px',
                  fontSize: 11,
                  fontFamily: 'monospace',
                  color: levelColor[entry.level],
                  borderBottom: '1px solid #222',
                  wordBreak: 'break-all',
                }}
              >
                <span style={{ color: '#555', marginRight: 6 }}>{entry.time}</span>
                {entry.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
