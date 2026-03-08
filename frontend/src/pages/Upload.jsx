import { useState, useRef } from 'react'
import { UploadCloud, FileText, CheckCircle2, XCircle, ArrowRight } from 'lucide-react'

export default function UploadPage({ selectedTenant }) {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef()

  if (!selectedTenant) {
    return <EmptyState message="Select a tenant from the Tenants page first." />
  }

  const handleFile = (f) => {
    if (!f) return
    const ok = ['application/pdf', 'text/csv', 'application/vnd.ms-excel'].includes(f.type)
      || f.name.endsWith('.csv') || f.name.endsWith('.pdf')
    if (!ok) { setError('Only PDF and CSV files are allowed.'); return }
    setFile(f); setResult(null); setError(null)
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true); setResult(null); setError(null)
    const form = new FormData()
    form.append('file', file)
    form.append('tenantId', selectedTenant.id)
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data); setFile(null)
    } catch (err) { setError(err.message) }
    setUploading(false)
  }

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false)
    handleFile(e.dataTransfer.files[0])
  }

  const isPdf = file?.name?.endsWith('.pdf')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 640 }}>

      <div className="fade-up">
        <p style={{ color: 'var(--muted)', fontSize: 14, margin: 0 }}>
          Uploading to <strong style={{ color: 'var(--ink)' }}>{selectedTenant.company_name}</strong>.
          Files are parsed, chunked into 500-char blocks, and embedded into Pinecone.
        </p>
      </div>

      {/* Drop zone */}
      <div
        className="fade-up delay-1"
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? 'var(--lavender-deep)' : file ? 'var(--forest)' : 'var(--border-dark)'}`,
          borderRadius: 20,
          padding: '52px 40px',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragOver ? 'rgba(201,186,238,0.08)' : file ? 'rgba(22,32,25,0.03)' : 'transparent',
          transition: 'all 0.2s ease',
        }}
      >
        <input ref={inputRef} type="file" accept=".pdf,.csv" onChange={e => handleFile(e.target.files[0])} style={{ display: 'none' }} />

        {file ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14, background: 'var(--forest)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <FileText size={22} color="var(--cream)" strokeWidth={1.5} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{file.name}</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 3 }}>
                {(file.size / 1024).toFixed(1)} KB · <span className={`tag ${isPdf ? 'tag-pdf' : 'tag-csv'}`}>{isPdf ? 'PDF' : 'CSV'}</span>
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted-light)' }}>Click to choose a different file</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14, background: 'var(--cream-dark)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <UploadCloud size={22} color="var(--muted)" strokeWidth={1.5} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--ink)' }}>
                Drop a file here, or <span style={{ color: 'var(--lavender-deep)', fontWeight: 600 }}>browse</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>PDF or CSV · up to 10 MB</div>
            </div>
          </div>
        )}
      </div>

      {/* Upload button */}
      {file && !uploading && (
        <button className="btn-lavender fade-up" style={{ alignSelf: 'flex-start' }} onClick={handleUpload}>
          Index this file <ArrowRight size={14} strokeWidth={2.5} />
        </button>
      )}

      {/* Progress */}
      {uploading && (
        <div className="card fade-up" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <UploadingDots />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>Processing…</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Parsing → chunking → embedding → storing</div>
          </div>
        </div>
      )}

      {/* Success */}
      {result && (
        <div className="card fade-up" style={{ border: '1.5px solid rgba(45,122,74,0.25)', background: '#F5FCF8' }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <CheckCircle2 size={20} color="#2D7A4A" strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#2D7A4A', marginBottom: 10 }}>Indexed successfully</div>
              <div style={{ display: 'flex', gap: 20 }}>
                {[
                  { label: 'Characters', value: result.stats?.characters?.toLocaleString() },
                  { label: 'Chunks', value: result.stats?.chunks },
                  { label: 'Vectors', value: result.stats?.vectors },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 22, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.03em' }}>{value}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="card fade-up" style={{ border: '1.5px solid rgba(192,57,43,0.25)', background: '#FEF5F5' }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <XCircle size={20} color="#B03030" strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#B03030', marginBottom: 4 }}>Upload failed</div>
              <div style={{ fontSize: 13, color: '#8B3030' }}>{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Pipeline explainer */}
      <div className="fade-up delay-2" style={{ marginTop: 8 }}>
        <Pipeline />
      </div>
    </div>
  )
}

function Pipeline() {
  const steps = [
    { label: 'Parse', desc: 'Extract text from PDF/CSV' },
    { label: 'Chunk', desc: '500-char blocks, 50 overlap' },
    { label: 'Embed', desc: 'BGE-m3 → 1024-dim vectors' },
    { label: 'Store', desc: 'Pinecone + Supabase record' },
  ]
  return (
    <div style={{ display: 'flex', gap: 0, alignItems: 'stretch' }}>
      {steps.map((s, i) => (
        <div key={s.label} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
          <div style={{ flex: 1, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {String(i + 1).padStart(2, '0')} · {s.label}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted-light)', marginTop: 3 }}>{s.desc}</div>
          </div>
          {i < steps.length - 1 && (
            <div style={{ width: 20, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
              <ArrowRight size={13} color="var(--muted-light)" strokeWidth={2} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function UploadingDots() {
  const dots = [0, 1, 2, 3, 4, 5, 6, 7]
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center', flexShrink: 0 }}>
      {dots.map((_, i) => (
        <div key={i} className="waveform-bar" style={{
          width: 3, height: 18, borderRadius: 99, background: 'var(--lavender-deep)',
        }} />
      ))}
    </div>
  )
}

function EmptyState({ message }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 320, gap: 10 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 22, color: 'var(--muted-light)' }}>
        Nothing here yet
      </div>
      <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0, textAlign: 'center' }}>{message}</p>
    </div>
  )
}
