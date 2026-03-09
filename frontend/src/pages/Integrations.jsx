import { useState, useEffect } from 'react'
import { Copy, Check, ExternalLink, Zap, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useT } from '../lib/i18n'
import { useLang } from '../context/LangContext'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

// ── Telegram SVG logo ─────────────────────────────────────────────────────────
function TelegramLogo({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="12" fill="#29B6F6"/>
      <path d="M5.491 11.74L18.661 6.28c.632-.24 1.185.155.98.943l-2.21 10.38c-.163.762-.633.944-1.282.588l-3.545-2.613-1.71 1.643c-.19.183-.35.337-.716.337l.256-3.61 6.572-5.936c.286-.254-.062-.395-.443-.141L7.83 13.928l-3.397-1.064c-.736-.233-.752-.737.32-1.124z" fill="white"/>
    </svg>
  )
}

// ── WhatsApp SVG logo ─────────────────────────────────────────────────────────
function WhatsAppLogo({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="12" fill="#25D366"/>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.978-1.413A9.953 9.953 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" fill="white"/>
    </svg>
  )
}

export default function Integrations({ selectedTenant }) {
  const { lang } = useLang()
  const T = useT(lang)
  const ti = T.integrations
  const tc = T.common

  const [waToken, setWaToken]     = useState('')
  const [waPhoneId, setWaPhoneId] = useState('')
  const [tgToken, setTgToken]     = useState('')
  const [tgUser, setTgUser]       = useState('')
  const [waSaved, setWaSaved]     = useState(false)
  const [tgSaved, setTgSaved]     = useState(false)
  const [tgRegistered, setTgRegistered] = useState(false)
  const [registering, setRegistering]   = useState(false)
  const [saving, setSaving]       = useState({ wa: false, tg: false })
  const [copied, setCopied]       = useState('')
  const [tgWebhookInfo, setTgWebhookInfo] = useState(null)

  // Load existing credentials when tenant changes
  useEffect(() => {
    if (!selectedTenant) return
    setWaToken(selectedTenant.whatsapp_token || '')
    setWaPhoneId(selectedTenant.whatsapp_phone_id || '')
    setTgToken(selectedTenant.telegram_bot_token || '')
    setTgUser(selectedTenant.telegram_bot_username || '')
    setWaSaved(false); setTgSaved(false); setTgRegistered(false)
  }, [selectedTenant?.id])

  const copy = (text, key) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(''), 2000)
  }

  const webhookUrl = selectedTenant
    ? `${API}/webhook/telegram/${selectedTenant.id}`
    : `${API}/webhook/telegram/{tenantId}`

  const saveWA = async () => {
    if (!selectedTenant) return
    setSaving(s => ({ ...s, wa: true }))
    await supabase.from('tenants').update({ whatsapp_token: waToken, whatsapp_phone_id: waPhoneId }).eq('id', selectedTenant.id)
    setSaving(s => ({ ...s, wa: false }))
    setWaSaved(true)
    setTimeout(() => setWaSaved(false), 3000)
  }

  const saveTG = async () => {
    if (!selectedTenant) return
    setSaving(s => ({ ...s, tg: true }))
    await supabase.from('tenants').update({ telegram_bot_token: tgToken, telegram_bot_username: tgUser }).eq('id', selectedTenant.id)
    setSaving(s => ({ ...s, tg: false }))
    setTgSaved(true)
    setTimeout(() => setTgSaved(false), 3000)
  }

  const registerTelegramWebhook = async () => {
    if (!selectedTenant || !tgToken) return
    setRegistering(true)
    try {
      const res = await fetch(`${API}/webhook/telegram/${selectedTenant.id}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookBaseUrl: API }),
      })
      const data = await res.json()
      if (data.success) {
        setTgRegistered(true)
        setTgWebhookInfo(data)
      } else {
        alert(`Webhook registration failed: ${data.error}`)
      }
    } catch (err) {
      alert(`Error: ${err.message}`)
    } finally {
      setRegistering(false)
    }
  }

  if (!selectedTenant) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 12, color: 'var(--muted)' }}>
      <Zap size={40} strokeWidth={1.5} color="var(--muted-light)" />
      <div style={{ fontSize: 15 }}>{ti.noTenant}</div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 720 }}>
      <p style={{ fontSize: 13.5, color: 'var(--muted)', margin: 0 }}>{ti.subtitle}</p>

      {/* ── WhatsApp Business API ── */}
      <IntegrationCard
        logo={<WhatsAppLogo size={22} />}
        title={ti.whatsapp}
        desc={ti.whatsappDesc}
        color="#25D366"
        docsUrl="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
        docsLabel={ti.howToWA}
        connected={!!selectedTenant.whatsapp_token}
      >
        <Field label={ti.token} value={waToken} onChange={setWaToken} type="password" placeholder="EAAxxxxx…" />
        <Field label={ti.phoneId} value={waPhoneId} onChange={setWaPhoneId} placeholder="123456789012345" />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
          <button onClick={saveWA} disabled={saving.wa} className="btn-lavender" style={{ padding: '9px 22px', fontSize: 13.5 }}>
            {saving.wa ? tc.saving : tc.save}
          </button>
          {waSaved && <SavedPill />}
        </div>
      </IntegrationCard>

      {/* ── Telegram Bot API ── */}
      <IntegrationCard
        logo={<TelegramLogo size={22} />}
        title={ti.telegram}
        desc={ti.telegramDesc}
        color="#29B6F6"
        docsUrl="https://core.telegram.org/bots#how-do-i-create-a-bot"
        docsLabel={ti.howToTG}
        connected={!!selectedTenant.telegram_bot_token}
      >
        <Field label={ti.botToken} value={tgToken} onChange={setTgToken} type="password" placeholder="1234567890:ABCdef…" />
        <Field label={ti.botUsername} value={tgUser} onChange={setTgUser} placeholder="@your_bot_username" />

        {/* Webhook URL (read-only, copy) */}
        <div style={{ marginTop: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
            {ti.webhookUrl}
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, padding: '9px 14px', background: 'rgba(22,32,25,0.04)', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 12, fontFamily: 'monospace', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {webhookUrl}
            </div>
            <button onClick={() => copy(webhookUrl, 'webhook')} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 100, border: '1.5px solid var(--border-dark)', background: 'white', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 500, color: copied === 'webhook' ? '#2D7A4A' : 'var(--muted)', transition: 'all 0.18s', whiteSpace: 'nowrap' }}>
              {copied === 'webhook' ? <Check size={13} /> : <Copy size={13} />}
              {copied === 'webhook' ? tc.copied : tc.copy}
            </button>
          </div>
        </div>

        {/* Steps */}
        <div style={{ marginTop: 12, padding: '12px 16px', background: 'rgba(41,182,246,0.06)', borderRadius: 12, border: '1.5px solid rgba(41,182,246,0.18)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#1b8fb3', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Setup Steps</div>
          {[
            { n: 1, text: 'Open Telegram → search @BotFather → /newbot' },
            { n: 2, text: 'Copy the bot token and paste it above' },
            { n: 3, text: 'Save credentials, then click "Register Webhook"' },
            { n: 4, text: 'Your bot is live! Test it by messaging it on Telegram' },
          ].map(s => (
            <div key={s.n} style={{ display: 'flex', gap: 10, fontSize: 12.5, color: 'var(--ink)', marginBottom: 5, alignItems: 'flex-start' }}>
              <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#29B6F6', color: 'white', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{s.n}</span>
              {s.text}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
          <button onClick={saveTG} disabled={saving.tg} className="btn-lavender" style={{ padding: '9px 22px', fontSize: 13.5 }}>
            {saving.tg ? tc.saving : tc.save}
          </button>
          <button
            onClick={registerTelegramWebhook}
            disabled={registering || !tgToken}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px', borderRadius: 100, border: 'none', background: tgToken ? '#29B6F6' : 'var(--border)', color: tgToken ? 'white' : 'var(--muted)', cursor: tgToken ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-body)', fontSize: 13.5, fontWeight: 600, transition: 'all 0.18s' }}
          >
            <TelegramLogo size={14} />
            {registering ? ti.registering : ti.registerWebhook}
          </button>
          {tgSaved && <SavedPill />}
          {tgRegistered && (
            <span style={{ fontSize: 12.5, color: '#1b8fb3', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Check size={13} strokeWidth={2.5} /> {ti.registered}
            </span>
          )}
        </div>

        {tgWebhookInfo && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(45,122,74,0.07)', borderRadius: 10, fontSize: 12, color: '#2D7A4A', fontFamily: 'monospace', overflow: 'auto' }}>
            ✅ Webhook set: {tgWebhookInfo.webhook_url}
          </div>
        )}
      </IntegrationCard>

      {/* ── Usage note ── */}
      <div style={{ display: 'flex', gap: 10, padding: '14px 18px', background: 'rgba(201,186,238,0.15)', borderRadius: 14, border: '1.5px solid rgba(201,186,238,0.35)', fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>
        <AlertCircle size={18} color="var(--lavender-deep)" strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <strong>Analytics tracking:</strong> All messages from both WhatsApp and Telegram are tracked in the Analytics tab. Source is labeled as <code style={{ background: 'rgba(0,0,0,0.05)', borderRadius: 4, padding: '1px 5px' }}>whatsapp</code> or <code style={{ background: 'rgba(0,0,0,0.05)', borderRadius: 4, padding: '1px 5px' }}>telegram</code>.
        </div>
      </div>
    </div>
  )
}

// ─── Reusable sub-components ──────────────────────────────────────────────────

function IntegrationCard({ logo, title, desc, color, docsUrl, docsLabel, connected, children }) {
  return (
    <div className="card fade-up" style={{ border: connected ? `2px solid ${color}22` : '1.5px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {logo}
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 3 }}>{title}</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.4, maxWidth: 400 }}>{desc}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 100, background: connected ? 'rgba(45,122,74,0.1)' : 'rgba(0,0,0,0.05)', color: connected ? '#2D7A4A' : 'var(--muted)' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: connected ? '#2D7A4A' : 'var(--muted-light)' }} />
            {connected ? 'Connected' : 'Not connected'}
          </div>
          <a href={docsUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: 'var(--muted)', textDecoration: 'none', padding: '4px 10px', borderRadius: 100, border: '1.5px solid var(--border-dark)', transition: 'all 0.18s' }}>
            <ExternalLink size={11} /> {docsLabel}
          </a>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', placeholder }) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
        {label}
      </label>
      <input
        type={type}
        className="field"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
      />
    </div>
  )
}

function SavedPill() {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: '#2D7A4A', fontWeight: 600 }}>
      <Check size={13} strokeWidth={2.5} /> Saved!
    </span>
  )
}
