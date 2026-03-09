import { useEffect, useState } from 'react'
import { BarChart2, Zap, Globe2, MessageSquare, Clock } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const LANG_LABELS = { en: 'English', 'hi-IN': 'Hindi', 'kn-IN': 'Kannada', hi: 'Hindi', kn: 'Kannada' }
const LANG_COLORS = { en: '#C9BAEE', 'hi-IN': '#F0C674', 'kn-IN': '#7ECBA1', hi: '#F0C674', kn: '#7ECBA1' }

export default function Analytics({ selectedTenant }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [days, setDays] = useState(30)

  useEffect(() => {
    if (!selectedTenant) return
    setLoading(true)
    fetch(`${API}/api/analytics/${selectedTenant.id}?days=${days}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [selectedTenant, days])

  if (!selectedTenant) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 320, gap: 12 }}>
      <BarChart2 size={40} color="var(--muted-light)" strokeWidth={1.5} />
      <div style={{ color: 'var(--muted)', fontSize: 15 }}>Select a tenant from the Tenants tab to see analytics.</div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
          Analytics for <strong style={{ color: 'var(--ink)' }}>{selectedTenant.company_name}</strong>
        </div>
        <select
          value={days}
          onChange={e => setDays(Number(e.target.value))}
          style={{ fontSize: 13, padding: '6px 12px', borderRadius: 100, border: '1.5px solid var(--border-dark)', background: 'white', cursor: 'pointer', fontFamily: 'var(--font-body)', color: 'var(--ink)', outline: 'none' }}
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {loading && (
        <div style={{ color: 'var(--muted)', fontSize: 14, textAlign: 'center', padding: 40 }}>Loading analytics…</div>
      )}

      {data && !loading && (
        <>
          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <StatCard icon={<MessageSquare size={20} strokeWidth={1.8} />} label="Total Queries" value={data.total} color="var(--lavender)" />
            <StatCard icon={<Clock size={20} strokeWidth={1.8} />} label="Avg Latency" value={`${data.avgLatency}ms`} color="#F0C674" />
            <StatCard icon={<Globe2 size={20} strokeWidth={1.8} />} label="Languages" value={Object.keys(data.byLanguage).length} color="#7ECBA1" />
            <StatCard icon={<Zap size={20} strokeWidth={1.8} />} label="Via WhatsApp" value={data.bySource?.whatsapp || 0} color="#FFB37C" />
          </div>

          {/* Charts row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Daily activity */}
            <DailyChart daily={data.daily} days={days} />

            {/* Language breakdown */}
            <LangChart byLanguage={data.byLanguage} total={data.total} />
          </div>

          {/* Top queries */}
          {data.topQueries?.length > 0 && (
            <div className="card fade-up">
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Top Questions
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {data.topQueries.map((q, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--cream)', borderRadius: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', minWidth: 20 }}>#{i + 1}</span>
                    <span style={{ flex: 1, fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.4 }}>{q.text}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--forest)', background: 'var(--lavender-soft)', padding: '2px 10px', borderRadius: 100 }}>
                      {q.count}×
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent queries */}
          {data.recent?.length > 0 && (
            <div className="card fade-up delay-1">
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Recent Activity
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.recent.slice(0, 10).map(q => (
                  <div key={q.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 13, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.query_text}</span>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>{LANG_LABELS[q.language] || q.language}</span>
                    <span style={{ fontSize: 11, color: 'var(--muted-light)', whiteSpace: 'nowrap' }}>{new Date(q.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.total === 0 && (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)', fontSize: 14 }}>
              No queries in the last {days} days. Try querying from the Query tab!
            </div>
          )}
        </>
      )}
    </div>
  )
}

function StatCard({ icon, label, value, color }) {
  return (
    <div className="card fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
        <div style={{ color: 'var(--muted)', opacity: 0.6 }}>{icon}</div>
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, fontStyle: 'italic', letterSpacing: '-0.04em', color: 'var(--ink)', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ height: 3, background: color, borderRadius: 99, width: 40 }} />
    </div>
  )
}

function DailyChart({ daily, days }) {
  const entries = Object.entries(daily).sort(([a], [b]) => a.localeCompare(b)).slice(-days)
  const max = Math.max(...entries.map(([, v]) => v), 1)

  return (
    <div className="card fade-up delay-2">
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 20, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Daily Activity
      </div>
      {entries.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', paddingTop: 40 }}>No data yet</div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 100 }}>
          {entries.map(([day, count]) => (
            <div key={day} title={`${day}: ${count} queries`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
              <div style={{
                width: '100%', background: 'var(--lavender)',
                borderRadius: '4px 4px 0 0',
                height: `${Math.max((count / max) * 100, 4)}%`,
                transition: 'height 0.5s cubic-bezier(0.16,1,0.3,1)',
              }} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function LangChart({ byLanguage, total }) {
  return (
    <div className="card fade-up delay-3">
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 20, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Language Breakdown
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {Object.entries(byLanguage).sort((a, b) => b[1] - a[1]).map(([lang, count]) => (
          <div key={lang}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
              <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{LANG_LABELS[lang] || lang}</span>
              <span style={{ color: 'var(--muted)' }}>{count} ({total ? Math.round(count / total * 100) : 0}%)</span>
            </div>
            <div style={{ height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 99,
                background: LANG_COLORS[lang] || 'var(--lavender)',
                width: `${total ? (count / total) * 100 : 0}%`,
                transition: 'width 0.6s cubic-bezier(0.16,1,0.3,1)',
              }} />
            </div>
          </div>
        ))}
        {Object.keys(byLanguage).length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', paddingTop: 30 }}>No data yet</div>
        )}
      </div>
    </div>
  )
}
