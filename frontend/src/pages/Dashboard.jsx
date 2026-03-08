import { useState, useEffect } from 'react'
import { Plus, Trash2, Check } from 'lucide-react'

export default function Dashboard({ selectedTenant, onSelectTenant }) {
  const [tenants, setTenants] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ company_name: '', industry: '', whatsapp_number: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchTenants = async () => {
    try {
      const res = await fetch('/api/tenants')
      const data = await res.json()
      setTenants(Array.isArray(data) ? data : [])
    } catch { setTenants([]) }
  }

  useEffect(() => { fetchTenants() }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      setForm({ company_name: '', industry: '', whatsapp_number: '' })
      setShowForm(false)
      fetchTenants()
    } catch (err) { setError(err.message) }
    setLoading(false)
  }

  const handleDelete = async (id, e) => {
    e.stopPropagation()
    if (!confirm('Delete this tenant and all their documents?')) return
    await fetch(`/api/tenants/${id}`, { method: 'DELETE' })
    if (selectedTenant?.id === id) onSelectTenant(null)
    fetchTenants()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header row */}
      <div className="fade-up" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <p style={{ color: 'var(--muted)', fontSize: 14, margin: 0 }}>
            Select a tenant to work with, or create a new one.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(s => !s)}>
          <Plus size={14} strokeWidth={2.5} />
          New Tenant
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="card fade-up" style={{ border: '1.5px solid var(--lavender)' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 18, fontWeight: 700, margin: '0 0 18px', letterSpacing: '-0.03em' }}>
            Add a new tenant
          </h3>
          {error && (
            <div style={{ background: '#FFF0F0', border: '1px solid #F5C6C6', borderRadius: 10, padding: '10px 14px', color: '#B03030', fontSize: 13, marginBottom: 14 }}>
              {error}
            </div>
          )}
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <input className="field" required placeholder="Company name *" value={form.company_name}
                onChange={e => setForm({ ...form, company_name: e.target.value })} />
              <input className="field" placeholder="Industry" value={form.industry}
                onChange={e => setForm({ ...form, industry: e.target.value })} />
              <input className="field" placeholder="WhatsApp number" value={form.whatsapp_number}
                onChange={e => setForm({ ...form, whatsapp_number: e.target.value })} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" className="btn-lavender" disabled={loading}>
                {loading ? 'Creating…' : <><Check size={14} strokeWidth={2.5} /> Create tenant</>}
              </button>
              <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Stats row */}
      <div className="fade-up delay-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <StatCard value={tenants.length} label="Total Tenants" dark />
        <StatCard value={tenants.filter(t => t.whatsapp_number).length} label="WhatsApp Connected" />
        <StatCard value={selectedTenant ? 1 : 0} label="Active Session" accent />
      </div>

      {/* Table */}
      <div className="card fade-up delay-2" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            All Tenants
          </span>
          <span style={{ fontSize: 12, color: 'var(--muted-light)' }}>Click a row to select</span>
        </div>

        {tenants.length === 0 ? (
          <div style={{ padding: '56px 24px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 20, color: 'var(--muted-light)', marginBottom: 8 }}>
              No tenants yet
            </div>
            <p style={{ fontSize: 13, color: 'var(--muted-light)', margin: 0 }}>
              Create your first tenant to get started
            </p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Company', 'Industry', 'WhatsApp', 'Created', ''].map(h => (
                  <th key={h} style={{ padding: '12px 24px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tenants.map((t, i) => (
                <tr
                  key={t.id}
                  onClick={() => onSelectTenant(t)}
                  style={{
                    cursor: 'pointer',
                    background: selectedTenant?.id === t.id ? 'rgba(201,186,238,0.15)' : 'transparent',
                    borderBottom: i < tenants.length - 1 ? '1px solid var(--border)' : 'none',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { if (selectedTenant?.id !== t.id) e.currentTarget.style.background = 'rgba(26,26,24,0.025)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = selectedTenant?.id === t.id ? 'rgba(201,186,238,0.15)' : 'transparent' }}
                >
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {selectedTenant?.id === t.id && (
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--lavender-deep)', flexShrink: 0 }} />
                      )}
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{t.company_name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '16px 24px', fontSize: 13, color: 'var(--muted)' }}>{t.industry || '—'}</td>
                  <td style={{ padding: '16px 24px' }}>
                    {t.whatsapp_number
                      ? <span className="tag tag-success">{t.whatsapp_number}</span>
                      : <span style={{ fontSize: 13, color: 'var(--muted-light)' }}>—</span>
                    }
                  </td>
                  <td style={{ padding: '16px 24px', fontSize: 13, color: 'var(--muted)' }}>
                    {new Date(t.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <button className="btn-danger" onClick={e => handleDelete(t.id, e)}>
                      <Trash2 size={12} strokeWidth={2} /> Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function StatCard({ value, label, dark, accent }) {
  const bg = dark ? 'var(--forest)' : accent ? 'var(--lavender-soft)' : 'var(--card)'
  const textColor = dark ? 'var(--cream)' : 'var(--ink)'
  const labelColor = dark ? 'rgba(237,232,220,0.5)' : 'var(--muted)'
  return (
    <div style={{ background: bg, border: dark || accent ? 'none' : '1px solid var(--border)', borderRadius: 16, padding: '22px 24px' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 36, fontWeight: 700, color: textColor, lineHeight: 1, letterSpacing: '-0.04em' }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: labelColor, marginTop: 6, fontWeight: 500, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
        {label}
      </div>
    </div>
  )
}
