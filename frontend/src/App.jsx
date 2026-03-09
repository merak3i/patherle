import { useState } from 'react'
import { Building2, Upload, FileText, Search, BarChart2, CreditCard, Plug, LogOut } from 'lucide-react'
import { useAuth } from './context/AuthContext'
import { useLang } from './context/LangContext'
import { useT, LANGS } from './lib/i18n'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import UploadPage from './pages/Upload'
import Documents from './pages/Documents'
import QueryPage from './pages/Query'
import Analytics from './pages/Analytics'
import Billing from './pages/Billing'
import Integrations from './pages/Integrations'

const NAV_IDS  = ['Dashboard','Upload','Documents','Query','Analytics','Billing','Integrations']
const NAV_ICONS = { Dashboard: Building2, Upload, Documents: FileText, Query: Search, Analytics: BarChart2, Billing: CreditCard, Integrations: Plug }
const NAV_KEYS  = { Dashboard: 'tenants', Upload: 'upload', Documents: 'documents', Query: 'query', Analytics: 'analytics', Billing: 'billing', Integrations: 'integrations' }

function Waveform() {
  const heights = [14, 22, 32, 26, 36, 20, 28, 16]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 40 }}>
      {heights.map((h, i) => (
        <div key={i} className="waveform-bar" style={{ width: 3, height: h, borderRadius: 99, background: 'rgba(201,186,238,0.55)' }} />
      ))}
    </div>
  )
}

function LangSwitcher() {
  const { lang, setLang } = useLang()
  return (
    <div style={{ display: 'flex', gap: 2, padding: 3, background: 'rgba(237,232,220,0.08)', borderRadius: 100, marginBottom: 20 }}>
      {LANGS.map(l => (
        <button key={l.code} onClick={() => setLang(l.code)} title={l.native} style={{ padding: '5px 10px', borderRadius: 100, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 700, background: lang === l.code ? 'var(--lavender)' : 'transparent', color: lang === l.code ? 'var(--forest)' : 'rgba(237,232,220,0.45)', transition: 'all 0.18s ease' }}>
          {l.label}
        </button>
      ))}
    </div>
  )
}

export default function App() {
  const { user, loading, signOut } = useAuth()
  const { lang } = useLang()
  const T = useT(lang)
  const [page, setPage] = useState('Dashboard')
  const [tenant, setTenant] = useState(null)

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--cream)' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontStyle: 'italic', color: 'var(--muted)', letterSpacing: '-0.04em' }}>{T.shell.loading}</div>
    </div>
  )

  if (!user) return <Login />

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      <aside style={{ width: 'var(--sidebar-w)', minWidth: 'var(--sidebar-w)', background: 'var(--forest)', display: 'flex', flexDirection: 'column', padding: '28px 16px', overflowY: 'auto' }}>
        <div style={{ padding: '0 8px', marginBottom: 24 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontStyle: 'italic', fontWeight: 700, color: 'var(--cream)', letterSpacing: '-0.03em', lineHeight: 1 }}>Patherle</div>
          <div style={{ fontSize: 10, color: 'rgba(237,232,220,0.35)', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 4, lineHeight: 1.4 }}>{T.shell.tagline}</div>
        </div>

        <div style={{ padding: '0 4px' }}><LangSwitcher /></div>
        <div style={{ padding: '0 8px', marginBottom: 20 }}><Waveform /></div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV_IDS.map(id => {
            const Icon = NAV_ICONS[id]
            return (
              <div key={id} className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => setPage(id)}>
                <Icon size={16} strokeWidth={2} />
                {T.nav[NAV_KEYS[id]]}
              </div>
            )
          })}
        </nav>

        <div style={{ marginTop: 'auto', padding: '0 4px' }}>
          {tenant && (
            <div style={{ borderTop: '1px solid rgba(237,232,220,0.1)', paddingTop: 20, marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: 'rgba(237,232,220,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{T.shell.activeTenant}</div>
              <div style={{ background: 'rgba(237,232,220,0.08)', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--cream)', lineHeight: 1.2 }}>{tenant.company_name}</div>
                {tenant.industry && <div style={{ fontSize: 11, color: 'rgba(237,232,220,0.45)', marginTop: 2 }}>{tenant.industry}</div>}
              </div>
            </div>
          )}
          <div style={{ borderTop: '1px solid rgba(237,232,220,0.1)', paddingTop: 16 }}>
            <div style={{ fontSize: 11, color: 'rgba(237,232,220,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 8 }}>{user.email}</div>
            <button onClick={signOut} style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%', padding: '8px 10px', borderRadius: 100, border: 'none', background: 'rgba(237,232,220,0.07)', color: 'rgba(237,232,220,0.5)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500, transition: 'all 0.18s' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(237,232,220,0.12)'; e.currentTarget.style.color = 'rgba(237,232,220,0.8)' }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(237,232,220,0.07)'; e.currentTarget.style.color = 'rgba(237,232,220,0.5)' }}>
              <LogOut size={14} strokeWidth={2} /> {T.shell.signOut}
            </button>
          </div>
        </div>
      </aside>

      <main style={{ flex: 1, overflowY: 'auto', background: 'var(--cream)', display: 'flex', flexDirection: 'column' }}>
        <header style={{ padding: '24px 36px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, fontStyle: 'italic', letterSpacing: '-0.04em', color: 'var(--ink)', lineHeight: 1, margin: 0 }}>
            {T.nav[NAV_KEYS[page]]}
          </h1>
          <TenantPill tenant={tenant} label={T.shell.noTenant} onClear={() => setTenant(null)} />
        </header>
        <div style={{ flex: 1, padding: '28px 36px' }}>
          {page === 'Dashboard'    && <Dashboard selectedTenant={tenant} onSelectTenant={setTenant} />}
          {page === 'Upload'       && <UploadPage selectedTenant={tenant} />}
          {page === 'Documents'    && <Documents selectedTenant={tenant} />}
          {page === 'Query'        && <QueryPage selectedTenant={tenant} />}
          {page === 'Analytics'    && <Analytics selectedTenant={tenant} />}
          {page === 'Billing'      && <Billing user={user} />}
          {page === 'Integrations' && <Integrations selectedTenant={tenant} />}
        </div>
      </main>
    </div>
  )
}

function TenantPill({ tenant, label, onClear }) {
  if (!tenant) return <div style={{ fontSize: 12, color: 'var(--muted)', background: 'rgba(26,26,24,0.06)', padding: '7px 14px', borderRadius: 100 }}>{label}</div>
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--forest)', color: 'var(--cream)', padding: '7px 14px', borderRadius: 100, fontSize: 13, fontWeight: 500 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--lavender)', flexShrink: 0 }} />
      {tenant.company_name}
      <button onClick={onClear} style={{ background: 'none', border: 'none', color: 'rgba(237,232,220,0.5)', cursor: 'pointer', fontSize: 15, padding: '0 0 0 2px', lineHeight: 1 }}>×</button>
    </div>
  )
}
