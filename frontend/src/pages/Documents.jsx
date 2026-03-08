import { useState, useEffect } from 'react'
import { Trash2, RefreshCw, FileText } from 'lucide-react'

export default function Documents({ selectedTenant }) {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchDocs = async () => {
    if (!selectedTenant) return
    setLoading(true)
    try {
      const res = await fetch(`/api/documents/${selectedTenant.id}`)
      const data = await res.json()
      setDocuments(Array.isArray(data) ? data : [])
    } catch { setDocuments([]) }
    setLoading(false)
  }

  useEffect(() => { fetchDocs() }, [selectedTenant])

  const handleDelete = async (id) => {
    if (!confirm('Delete this document and remove its vectors from Pinecone?')) return
    await fetch(`/api/documents/${id}`, { method: 'DELETE' })
    fetchDocs()
  }

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

  const totalChunks = documents.reduce((s, d) => s + (d.chunk_count || 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header */}
      <div className="fade-up" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <p style={{ color: 'var(--muted)', fontSize: 14, margin: 0 }}>
          Knowledge base for <strong style={{ color: 'var(--ink)' }}>{selectedTenant.company_name}</strong>
        </p>
        <button className="btn-ghost" onClick={fetchDocs} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={13} strokeWidth={2} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="fade-up delay-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        <MiniStat value={documents.length} label="Documents" dark />
        <MiniStat value={totalChunks.toLocaleString()} label="Total chunks" />
        <MiniStat value={totalChunks.toLocaleString()} label="Pinecone vectors" accent />
      </div>

      {/* Table */}
      <div className="card fade-up delay-2" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Indexed files
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--muted-light)', fontSize: 14 }}>Loading…</div>
        ) : documents.length === 0 ? (
          <div style={{ padding: '56px 24px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 20, color: 'var(--muted-light)', marginBottom: 8 }}>
              No documents yet
            </div>
            <p style={{ fontSize: 13, color: 'var(--muted-light)', margin: 0 }}>Upload PDF or CSV files to build the knowledge base.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['File', 'Type', 'Chunks', 'Vectors', 'Uploaded', ''].map(h => (
                  <th key={h} style={{ padding: '11px 24px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {documents.map((doc, i) => (
                <tr
                  key={doc.id}
                  style={{ borderBottom: i < documents.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 0.12s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(26,26,24,0.025)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: doc.file_type === 'pdf' ? '#FFE8E8' : '#E6F5EC',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <FileText size={14} color={doc.file_type === 'pdf' ? '#B03030' : '#2D7A4A'} strokeWidth={2} />
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {doc.filename}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <span className={`tag ${doc.file_type === 'pdf' ? 'tag-pdf' : 'tag-csv'}`}>
                      {doc.file_type?.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '16px 24px', fontSize: 14, fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em' }}>
                    {doc.chunk_count}
                  </td>
                  <td style={{ padding: '16px 24px', fontSize: 14, fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em' }}>
                    {doc.chunk_count}
                  </td>
                  <td style={{ padding: '16px 24px', fontSize: 13, color: 'var(--muted)' }}>
                    {new Date(doc.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <button className="btn-danger" onClick={() => handleDelete(doc.id)}>
                      <Trash2 size={12} strokeWidth={2} /> Remove
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

function MiniStat({ value, label, dark, accent }) {
  const bg = dark ? 'var(--forest)' : accent ? 'var(--lavender-soft)' : 'var(--card)'
  const textColor = dark ? 'var(--cream)' : 'var(--ink)'
  const labelColor = dark ? 'rgba(237,232,220,0.45)' : 'var(--muted)'
  return (
    <div style={{ background: bg, border: dark || accent ? 'none' : '1px solid var(--border)', borderRadius: 14, padding: '18px 20px' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 28, fontWeight: 700, color: textColor, letterSpacing: '-0.04em', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: labelColor, marginTop: 5, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {label}
      </div>
    </div>
  )
}
