import { useState, useRef, useEffect } from 'react'
import { Send, Mic, MicOff } from 'lucide-react'

const LANG_OPTIONS = [
  { code: 'en-IN', label: 'English', flag: '🇬🇧' },
  { code: 'hi-IN', label: 'Hindi', flag: '🇮🇳' },
  { code: 'kn-IN', label: 'Kannada', flag: '🏳️' },
]

export default function QueryPage({ selectedTenant }) {
  const [query, setQuery] = useState('')
  const [lang, setLang] = useState('en-IN')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState([])
  const bottomRef = useRef()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (!selectedTenant) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 320, gap: 10 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 22, color: 'var(--muted-light)' }}>
          No tenant selected
        </div>
        <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0 }}>Go to Tenants and click a row to select one.</p>
      </div>
    )
  }

  const handleSubmit = async (e) => {
    e?.preventDefault()
    if (!query.trim() || loading) return

    const userMsg = { role: 'user', text: query, ts: Date.now() }
    setMessages(m => [...m, userMsg])
    setQuery('')
    setLoading(true)

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userMsg.text, tenantId: selectedTenant.id, language: lang }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setMessages(m => [...m, {
        role: 'assistant',
        text: data.answer,
        sources: data.sources,
        language: data.language,
        ts: Date.now(),
      }])
    } catch (err) {
      setMessages(m => [...m, { role: 'error', text: err.message, ts: Date.now() }])
    }
    setLoading(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 180px)', gap: 0 }}>

      {/* Tenant + lang row */}
      <div className="fade-up" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexShrink: 0 }}>
        <p style={{ color: 'var(--muted)', fontSize: 14, margin: 0 }}>
          Querying <strong style={{ color: 'var(--ink)' }}>{selectedTenant.company_name}</strong>'s knowledge base
        </p>
        <div style={{ display: 'flex', gap: 6 }}>
          {LANG_OPTIONS.map(l => (
            <button
              key={l.code}
              onClick={() => setLang(l.code)}
              style={{
                padding: '6px 14px', borderRadius: 100, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: '1.5px solid',
                borderColor: lang === l.code ? 'var(--forest)' : 'var(--border-dark)',
                background: lang === l.code ? 'var(--forest)' : 'transparent',
                color: lang === l.code ? 'var(--cream)' : 'var(--muted)',
                transition: 'all 0.15s',
              }}
            >
              {l.flag} {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages area */}
      <div className="card fade-up delay-1" style={{
        flex: 1, overflowY: 'auto', padding: '24px', display: 'flex',
        flexDirection: 'column', gap: 20, minHeight: 0,
      }}>
        {messages.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14, background: 'var(--forest)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <WaveIcon />
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 18, color: 'var(--muted)', textAlign: 'center' }}>
              Ask anything about the uploaded documents
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted-light)', textAlign: 'center' }}>
              Supports Hindi, Kannada, and English
            </div>
          </div>
        ) : (
          messages.map((m) => <Message key={m.ts} msg={m} />)
        )}

        {loading && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Avatar role="assistant" />
            <div style={{ padding: '12px 16px', background: 'var(--cream-dark)', borderRadius: '4px 14px 14px 14px', display: 'flex', gap: 4, alignItems: 'center' }}>
              {[0, 1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="waveform-bar" style={{
                  width: 3, height: 16, borderRadius: 99, background: 'var(--muted-light)',
                }} />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="fade-up delay-2" style={{
        display: 'flex', gap: 10, marginTop: 14, flexShrink: 0, alignItems: 'flex-end',
      }}>
        <textarea
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question… (Enter to send)"
          rows={2}
          className="field"
          style={{ resize: 'none', flex: 1, borderRadius: 14, padding: '12px 16px', lineHeight: 1.5 }}
        />
        <button
          type="submit"
          disabled={!query.trim() || loading}
          style={{
            width: 44, height: 44, borderRadius: 12, border: 'none', cursor: 'pointer',
            background: query.trim() ? 'var(--forest)' : 'var(--cream-dark)',
            color: query.trim() ? 'var(--cream)' : 'var(--muted-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.18s', flexShrink: 0,
          }}
        >
          <Send size={17} strokeWidth={2} />
        </button>
      </form>
    </div>
  )
}

function Message({ msg }) {
  const isUser = msg.role === 'user'
  const isError = msg.role === 'error'

  if (isUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <div style={{
          background: 'var(--forest)', color: 'var(--cream)',
          padding: '12px 16px', borderRadius: '14px 4px 14px 14px',
          maxWidth: '72%', fontSize: 14, lineHeight: 1.55,
        }}>
          {msg.text}
        </div>
        <Avatar role="user" />
      </div>
    )
  }

  if (isError) {
    return (
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <Avatar role="error" />
        <div style={{
          padding: '12px 16px', borderRadius: '4px 14px 14px 14px',
          background: '#FEF5F5', border: '1px solid rgba(192,57,43,0.2)',
          color: '#B03030', fontSize: 14,
        }}>
          Error: {msg.text}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <Avatar role="assistant" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{
          background: 'var(--cream-dark)', padding: '14px 16px',
          borderRadius: '4px 14px 14px 14px',
          fontSize: 14, lineHeight: 1.65, color: 'var(--ink)',
          whiteSpace: 'pre-wrap',
        }}>
          {msg.text}
        </div>
        {msg.sources?.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {msg.sources.map((s, i) => (
              <span key={i} className="tag tag-info" style={{ fontSize: 10 }}>
                {s.filename} · {Math.round(s.score * 100)}% match
              </span>
            ))}
          </div>
        )}
        {msg.language && (
          <span style={{ fontSize: 11, color: 'var(--muted-light)' }}>
            Detected: {LANG_OPTIONS.find(l => l.code === msg.language)?.label || msg.language}
          </span>
        )}
      </div>
    </div>
  )
}

function Avatar({ role }) {
  const isUser = role === 'user'
  return (
    <div style={{
      width: 30, height: 30, borderRadius: 8, flexShrink: 0,
      background: isUser ? 'var(--lavender)' : 'var(--forest)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 13, fontWeight: 700,
      color: isUser ? 'var(--forest)' : 'var(--cream)',
      fontFamily: 'var(--font-display)', fontStyle: 'italic',
    }}>
      {isUser ? 'U' : 'R'}
    </div>
  )
}

function WaveIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <rect x="2" y="8" width="2.5" height="6" rx="1.25" fill="rgba(237,232,220,0.7)" />
      <rect x="6" y="5" width="2.5" height="12" rx="1.25" fill="rgba(237,232,220,0.9)" />
      <rect x="10" y="3" width="2.5" height="16" rx="1.25" fill="rgba(237,232,220,1)" />
      <rect x="14" y="5" width="2.5" height="12" rx="1.25" fill="rgba(237,232,220,0.9)" />
      <rect x="18" y="8" width="2.5" height="6" rx="1.25" fill="rgba(237,232,220,0.7)" />
    </svg>
  )
}
