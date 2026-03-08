import { useState } from 'react'
import { Building2, Upload, FileText, Search, ChevronDown } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import UploadPage from './pages/Upload'
import Documents from './pages/Documents'
import QueryPage from './pages/Query'

const NAV = [
  { id: 'Dashboard', label: 'Tenants',   icon: Building2 },
  { id: 'Upload',    label: 'Upload',    icon: Upload },
  { id: 'Documents', label: 'Documents', icon: FileText },
  { id: 'Query',     label: 'Query',     icon: Search },
]

function Waveform() {
  const heights = [14, 22, 32, 26, 36, 20, 28, 16]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 40 }}>
      {heights.map((h, i) => (
        <div
          key={i}
          className="waveform-bar"
          style={{
            width: 3,
            height: h,
            borderRadius: 99,
            background: 'rgba(201,186,238,0.55)',
          }}
        />
      ))}
    </div>
  )
}

export default function App() {
  const [page, setPage] = useState('Dashboard')
  const [tenant, setTenant] = useState(null)

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: 'var(--sidebar-w)',
        minWidth: 'var(--sidebar-w)',
        background: 'var(--forest)',
        display: 'flex',
        flexDirection: 'column',
        padding: '28px 16px',
        gap: 0,
        overflowY: 'auto',
      }}>

        {/* Logo */}
        <div style={{ padding: '0 8px', marginBottom: 32 }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            fontStyle: 'italic',
            fontWeight: 700,
            color: 'var(--cream)',
            letterSpacing: '-0.03em',
            lineHeight: 1,
          }}>
            Patherle
          </div>
          <div style={{
            fontSize: 11,
            color: 'rgba(237,232,220,0.38)',
            fontWeight: 500,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginTop: 4,
          }}>
            Multilingual · WhatsApp
          </div>
        </div>

        {/* Waveform decoration */}
        <div style={{ padding: '0 8px', marginBottom: 28 }}>
          <Waveform />
        </div>

        {/* Nav */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map(({ id, label, icon: Icon }) => (
            <div
              key={id}
              className={`nav-item ${page === id ? 'active' : ''}`}
              onClick={() => setPage(id)}
            >
              <Icon size={16} strokeWidth={2} />
              {label}
            </div>
          ))}
        </nav>

        {/* Active tenant pill */}
        {tenant && (
          <div style={{ marginTop: 'auto', padding: '0 4px' }}>
            <div style={{
              borderTop: '1px solid rgba(237,232,220,0.1)',
              paddingTop: 20,
              marginBottom: 4,
            }}>
              <div style={{ fontSize: 10, color: 'rgba(237,232,220,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                Active tenant
              </div>
              <div style={{
                background: 'rgba(237,232,220,0.08)',
                borderRadius: 10,
                padding: '10px 12px',
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--cream)', lineHeight: 1.2 }}>
                  {tenant.company_name}
                </div>
                {tenant.industry && (
                  <div style={{ fontSize: 11, color: 'rgba(237,232,220,0.45)', marginTop: 2 }}>
                    {tenant.industry}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* ── Main ── */}
      <main style={{
        flex: 1,
        overflowY: 'auto',
        background: 'var(--cream)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Top bar */}
        <header style={{
          padding: '24px 36px 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            <h1 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 28,
              fontWeight: 700,
              fontStyle: 'italic',
              letterSpacing: '-0.04em',
              color: 'var(--ink)',
              lineHeight: 1,
              margin: 0,
            }}>
              {NAV.find(n => n.id === page)?.label}
            </h1>
          </div>

          {/* Tenant selector */}
          <TenantPill tenant={tenant} onClear={() => setTenant(null)} />
        </header>

        {/* Page content */}
        <div style={{ flex: 1, padding: '28px 36px' }}>
          {page === 'Dashboard' && <Dashboard selectedTenant={tenant} onSelectTenant={setTenant} />}
          {page === 'Upload'    && <UploadPage selectedTenant={tenant} />}
          {page === 'Documents' && <Documents selectedTenant={tenant} />}
          {page === 'Query'     && <QueryPage selectedTenant={tenant} />}
        </div>
      </main>
    </div>
  )
}

function TenantPill({ tenant, onClear }) {
  if (!tenant) return (
    <div style={{
      fontSize: 12,
      color: 'var(--muted)',
      background: 'rgba(26,26,24,0.06)',
      padding: '7px 14px',
      borderRadius: 100,
    }}>
      No tenant selected
    </div>
  )
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      background: 'var(--forest)', color: 'var(--cream)',
      padding: '7px 14px', borderRadius: 100, fontSize: 13, fontWeight: 500,
    }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%',
        background: 'var(--lavender)', flexShrink: 0,
      }} />
      {tenant.company_name}
      <button
        onClick={onClear}
        style={{ background: 'none', border: 'none', color: 'rgba(237,232,220,0.5)',
          cursor: 'pointer', fontSize: 15, padding: '0 0 0 2px', lineHeight: 1 }}
      >×</button>
    </div>
  )
}
