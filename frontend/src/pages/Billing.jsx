import { useState } from 'react'
import { Check, Copy, Zap, Building2, Sparkles } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const RZP_KEY = import.meta.env.VITE_RAZORPAY_KEY_ID || ''

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 999,
    priceLabel: '₹999',
    period: '/mo',
    desc: 'Perfect for small shops, solo founders',
    icon: Zap,
    color: 'var(--lavender)',
    features: ['1 WhatsApp number', '5,000 queries/mo', '3 documents', 'English + Hindi', 'Email support'],
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 2999,
    priceLabel: '₹2,999',
    period: '/mo',
    desc: 'For growing businesses with real volume',
    icon: Sparkles,
    color: '#7ECBA1',
    featured: true,
    features: ['5 WhatsApp numbers', '50,000 queries/mo', '25 documents', 'All 10+ Indian languages', 'Voice notes (STT)', 'Priority support', 'Analytics dashboard'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 9999,
    priceLabel: '₹9,999',
    period: '/mo',
    desc: 'For chains, franchises, large deployments',
    icon: Building2,
    color: '#F0C674',
    features: ['Unlimited WhatsApp numbers', 'Unlimited queries', 'Unlimited documents', 'All languages', 'Voice + TTS', 'Dedicated support', 'Custom SLA', 'White-label option'],
  },
]

const CRYPTO = [
  { symbol: 'BTC', name: 'Bitcoin', address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', color: '#F7931A' },
  { symbol: 'ETH', name: 'Ethereum / USDT (ERC-20)', address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F', color: '#627EEA' },
  { symbol: 'SOL', name: 'Solana / USDC (SPL)', address: 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH', color: '#9945FF' },
]

export default function Billing({ user }) {
  const [selected, setSelected] = useState('growth')
  const [paying, setPaying] = useState(false)
  const [copied, setCopied] = useState('')
  const [tab, setTab] = useState('card') // 'card' | 'crypto'

  const handleRazorpay = async () => {
    const plan = PLANS.find(p => p.id === selected)
    setPaying(true)
    try {
      const res = await fetch(`${API}/api/payments/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan.id, amount: plan.price * 100 }),
      })
      const order = await res.json()

      const options = {
        key: RZP_KEY,
        amount: order.amount,
        currency: 'INR',
        name: 'Patherle',
        description: `${plan.name} Plan`,
        order_id: order.id,
        prefill: { email: user?.email || '' },
        theme: { color: '#162019' },
        handler(response) {
          alert(`Payment successful! Payment ID: ${response.razorpay_payment_id}`)
        },
      }

      const rzp = new window.Razorpay(options)
      rzp.open()
    } catch (err) {
      alert('Payment setup failed. Please try again.')
    } finally {
      setPaying(false)
    }
  }

  const copy = (text, key) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(''), 2000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

      {/* Plans */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
          Choose a Plan
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {PLANS.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              selected={selected === plan.id}
              onSelect={() => setSelected(plan.id)}
            />
          ))}
        </div>
      </div>

      {/* Payment method */}
      <div className="card fade-up">
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 20 }}>
          Payment Method
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', background: 'var(--cream)', borderRadius: 100, padding: 4, gap: 4, width: 'fit-content', marginBottom: 24 }}>
          {[{ id: 'card', label: '💳 Card & UPI' }, { id: 'crypto', label: '⚡ Crypto' }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '7px 20px', borderRadius: 100, border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600,
              background: tab === t.id ? 'var(--forest)' : 'transparent',
              color: tab === t.id ? 'var(--cream)' : 'var(--muted)',
              transition: 'all 0.18s ease',
            }}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'card' && (
          <div>
            <div style={{ fontSize: 13.5, color: 'var(--muted)', marginBottom: 20, lineHeight: 1.6 }}>
              Pay securely via Razorpay — supports all Indian cards, UPI (GPay, PhonePe, Paytm), netbanking, and EMI.
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              {['Visa', 'Mastercard', 'UPI', 'RuPay'].map(b => (
                <span key={b} style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6, border: '1.5px solid var(--border-dark)', color: 'var(--muted)' }}>{b}</span>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ flex: 1, padding: 16, background: 'var(--cream)', borderRadius: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Selected plan</div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-display)', fontStyle: 'italic', color: 'var(--ink)' }}>
                  {PLANS.find(p => p.id === selected)?.name} · {PLANS.find(p => p.id === selected)?.priceLabel}/mo
                </div>
              </div>
              <button onClick={handleRazorpay} disabled={paying} className="btn-lavender" style={{ padding: '12px 28px', fontSize: 15 }}>
                {paying ? 'Opening…' : 'Pay with Razorpay'}
              </button>
            </div>
          </div>
        )}

        {tab === 'crypto' && (
          <div>
            <div style={{ fontSize: 13.5, color: 'var(--muted)', marginBottom: 20, lineHeight: 1.6 }}>
              Send crypto equivalent to the selected plan price to any address below. DM us on WhatsApp after payment to activate your plan.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {CRYPTO.map(c => (
                <div key={c.symbol} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', background: 'var(--cream)', borderRadius: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                    {c.symbol}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 3 }}>{c.name}</div>
                    <div style={{ fontSize: 11.5, fontFamily: 'monospace', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.address}
                    </div>
                  </div>
                  <button
                    onClick={() => copy(c.address, c.symbol)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 100, border: '1.5px solid var(--border-dark)', background: 'white', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 500, color: copied === c.symbol ? '#2D7A4A' : 'var(--muted)', transition: 'all 0.18s', flexShrink: 0 }}
                  >
                    {copied === c.symbol ? <Check size={13} /> : <Copy size={13} />}
                    {copied === c.symbol ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16, fontSize: 12, color: 'var(--muted)', padding: '10px 14px', background: 'rgba(201,186,238,0.2)', borderRadius: 10, borderLeft: '3px solid var(--lavender)' }}>
              After sending, message us at <strong>+91-XXXXXXXXXX</strong> with your transaction hash and email to activate your account.
            </div>
          </div>
        )}
      </div>

      {/* Razorpay script */}
      <RazorpayScript />
    </div>
  )
}

function PlanCard({ plan, selected, onSelect }) {
  const Icon = plan.icon
  return (
    <div
      onClick={onSelect}
      className="card"
      style={{
        cursor: 'pointer', position: 'relative', overflow: 'hidden',
        border: selected ? `2px solid ${plan.color}` : '1.5px solid var(--border)',
        background: selected ? 'white' : 'var(--card)',
        transition: 'all 0.2s ease',
        transform: selected ? 'translateY(-2px)' : 'none',
        boxShadow: selected ? `0 8px 24px rgba(0,0,0,0.08), 0 0 0 1px ${plan.color}33` : 'none',
      }}
    >
      {plan.featured && (
        <div style={{ position: 'absolute', top: 12, right: 12, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '3px 8px', borderRadius: 100, background: plan.color, color: 'var(--forest)' }}>
          Popular
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: plan.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={18} strokeWidth={2} color="var(--forest)" />
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{plan.name}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{plan.desc}</div>
        </div>
      </div>
      <div style={{ marginBottom: 20 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, fontStyle: 'italic', letterSpacing: '-0.04em', color: 'var(--ink)' }}>{plan.priceLabel}</span>
        <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 2 }}>{plan.period}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {plan.features.map(f => (
          <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--ink)' }}>
            <Check size={13} color={plan.color === 'var(--lavender)' ? 'var(--lavender-deep)' : plan.color} strokeWidth={2.5} style={{ flexShrink: 0 }} />
            {f}
          </div>
        ))}
      </div>
    </div>
  )
}

function RazorpayScript() {
  // Load Razorpay checkout script once
  if (!document.getElementById('rzp-script')) {
    const s = document.createElement('script')
    s.id = 'rzp-script'
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    document.head.appendChild(s)
  }
  return null
}
