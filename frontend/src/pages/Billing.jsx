import { useState } from 'react'
import { Check, Zap, Building2, Sparkles, ChevronRight, ArrowLeft } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const RZP_KEY = import.meta.env.VITE_RAZORPAY_KEY_ID || ''

// ─── Tier definitions (from product spec) ───────────────────────────────────
const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 999,
    priceLabel: '₹999',
    period: '/mo',
    desc: 'Solo founders & small shops getting started',
    icon: Zap,
    color: 'var(--lavender)',
    highlight: 'var(--lavender-deep)',
    specs: [
      { label: 'Message Volume',   value: '1,000 / month' },
      { label: 'Channel Access',   value: 'WhatsApp or Telegram (single)' },
      { label: 'Tenant Workspace', value: '1 isolated workspace' },
      { label: 'Data Ingestion',   value: 'PDF, CSV, URL scraping, API sync' },
      { label: 'Core Engine',      value: 'RAG · English, Hindi, Kannada' },
      { label: 'Commerce',         value: 'Product catalog & price showcase' },
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 2999,
    priceLabel: '₹2,999',
    period: '/mo',
    desc: 'Growing businesses with real volume',
    icon: Sparkles,
    color: '#7ECBA1',
    highlight: '#2D7A4A',
    featured: true,
    specs: [
      { label: 'Message Volume',   value: '5,000 / month' },
      { label: 'Channel Access',   value: 'WhatsApp + Telegram (dual, simultaneous)' },
      { label: 'Tenant Workspace', value: 'Up to 5 isolated sub-accounts' },
      { label: 'Data Ingestion',   value: 'PDF, CSV, URL scraping, API sync' },
      { label: 'Core Engine',      value: 'RAG · English, Hindi, Kannada' },
      { label: 'Commerce',         value: 'Product catalog & price showcase' },
      { label: 'Lead Generation',  value: 'Name & email capture before data release' },
      { label: 'Scheduling',       value: 'Calendar URL injection via intent triggers' },
      { label: 'Analytics',        value: 'Standard interaction telemetry' },
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 9999,
    priceLabel: '₹9,999',
    period: '/mo',
    desc: 'Chains, franchises & large deployments',
    icon: Building2,
    color: '#F0C674',
    highlight: '#8A6800',
    specs: [
      { label: 'Message Volume',   value: '25,000 / month' },
      { label: 'Channel Access',   value: 'Omnichannel deployment' },
      { label: 'Tenant Workspace', value: 'Up to 15 isolated sub-accounts' },
      { label: 'Data Ingestion',   value: 'PDF, CSV, URL scraping, API sync' },
      { label: 'Core Engine',      value: 'RAG · English, Hindi, Kannada' },
      { label: 'Commerce',         value: 'Product catalog & price showcase' },
      { label: 'Lead Generation',  value: 'Name & email capture before data release' },
      { label: 'Scheduling',       value: 'Calendar URL injection via intent triggers' },
      { label: 'Transaction Layer',value: 'Razorpay Card/UPI + Crypto links in-chat' },
      { label: 'Analytics',        value: 'Advanced lead & conversion telemetry' },
    ],
  },
]

// ─── Steps ───────────────────────────────────────────────────────────────────
// step 0 = plan select  |  step 1 = payment method  |  step 2 = checkout

export default function Billing({ user }) {
  const [selected, setSelected]   = useState('growth')
  const [step, setStep]           = useState(0)      // 0 | 1 | 2
  const [method, setMethod]       = useState('razorpay') // 'razorpay' | 'coindcx'
  const [paying, setPaying]       = useState(false)
  const [cdcxLink, setCdcxLink]   = useState(null)   // CoinDCX Pay URL from backend

  const plan = PLANS.find(p => p.id === selected)

  // ── Razorpay ──────────────────────────────────────────────────────────────
  const handleRazorpay = async () => {
    setPaying(true)
    try {
      const res = await fetch(`${API}/api/payments/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan.id }),
      })
      const order = await res.json()
      if (order.error) throw new Error(order.error)

      const options = {
        key: RZP_KEY,
        amount: order.amount,
        currency: 'INR',
        name: 'Patherle',
        description: `${plan.name} Plan — ${plan.specs.find(s => s.label === 'Message Volume')?.value}`,
        order_id: order.id,
        prefill: { email: user?.email || '' },
        theme: { color: '#162019' },
        handler(response) {
          alert(`✅ Payment confirmed!\nPayment ID: ${response.razorpay_payment_id}`)
        },
      }
      const rzp = new window.Razorpay(options)
      rzp.open()
    } catch (err) {
      alert(`Payment setup failed: ${err.message}`)
    } finally {
      setPaying(false)
    }
  }

  // ── CoinDCX Pay ───────────────────────────────────────────────────────────
  const handleCoinDCX = async () => {
    setPaying(true)
    try {
      const res = await fetch(`${API}/api/payments/coindcx-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan.id, email: user?.email || '' }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      if (data.checkout_url) {
        setCdcxLink(data.checkout_url)
        window.open(data.checkout_url, '_blank', 'noopener')
      }
    } catch (err) {
      alert(`CoinDCX Pay setup failed: ${err.message}`)
    } finally {
      setPaying(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Step indicator ── */}
      <StepBar step={step} />

      {/* ── Step 0: Choose plan ── */}
      {step === 0 && (
        <>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>
            Select the plan that fits your business — upgrade or downgrade anytime.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {PLANS.map(p => (
              <PlanCard key={p.id} plan={p} selected={selected === p.id} onSelect={() => setSelected(p.id)} />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setStep(1)}
              className="btn-lavender"
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 28px', fontSize: 15 }}
            >
              Continue to Payment <ChevronRight size={16} />
            </button>
          </div>
        </>
      )}

      {/* ── Step 1: Payment method ── */}
      {step === 1 && (
        <div className="card fade-up" style={{ maxWidth: 600 }}>
          <button onClick={() => setStep(0)} style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 13, fontFamily: 'var(--font-body)', marginBottom: 24, padding: 0 }}>
            <ArrowLeft size={14} /> Back to plans
          </button>

          {/* Summary pill */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: 'var(--cream)', borderRadius: 14, marginBottom: 28 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Selected Plan</div>
              <div style={{ fontSize: 18, fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.04em' }}>
                {plan.name}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                {plan.specs.find(s => s.label === 'Message Volume')?.value} · {plan.specs.find(s => s.label === 'Tenant Workspace')?.value}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, fontStyle: 'italic', letterSpacing: '-0.04em', color: 'var(--ink)', lineHeight: 1 }}>
                {plan.priceLabel}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>/month</div>
            </div>
          </div>

          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
            Payment Method
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
            <MethodCard
              id="razorpay"
              selected={method === 'razorpay'}
              onSelect={() => setMethod('razorpay')}
              icon="💳"
              title="Card / UPI / Netbanking"
              desc="Visa, Mastercard, RuPay, GPay, PhonePe, Paytm, EMI"
              badge="Razorpay"
              badgeColor="#072654"
            />
            <MethodCard
              id="coindcx"
              selected={method === 'coindcx'}
              onSelect={() => setMethod('coindcx')}
              icon="⚡"
              title="Crypto (Bitcoin, ETH, USDT)"
              desc="Pay in BTC, ETH, USDT, SOL or any major crypto. INR equivalent."
              badge="CoinDCX Pay"
              badgeColor="#F7931A"
            />
          </div>

          <button
            onClick={() => setStep(2)}
            className="btn-lavender"
            style={{ width: '100%', justifyContent: 'center', padding: '13px 0', fontSize: 15 }}
          >
            Proceed to {method === 'razorpay' ? 'Razorpay' : 'CoinDCX Pay'} →
          </button>
        </div>
      )}

      {/* ── Step 2: Checkout ── */}
      {step === 2 && (
        <div className="card fade-up" style={{ maxWidth: 600 }}>
          <button onClick={() => setStep(1)} style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 13, fontFamily: 'var(--font-body)', marginBottom: 24, padding: 0 }}>
            <ArrowLeft size={14} /> Back to payment method
          </button>

          {/* Order summary */}
          <div style={{ padding: '16px 18px', background: 'var(--cream)', borderRadius: 14, marginBottom: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Patherle {plan.name} Plan</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, fontStyle: 'italic', color: 'var(--ink)' }}>{plan.priceLabel}/mo</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {plan.specs.slice(0, 4).map(s => (
                <div key={s.label} style={{ display: 'flex', gap: 8, fontSize: 12 }}>
                  <span style={{ color: 'var(--muted)', minWidth: 110 }}>{s.label}</span>
                  <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>

          {method === 'razorpay' && (
            <RazorpayCheckout plan={plan} user={user} paying={paying} onPay={handleRazorpay} />
          )}
          {method === 'coindcx' && (
            <CoinDCXCheckout plan={plan} paying={paying} onPay={handleCoinDCX} checkoutUrl={cdcxLink} />
          )}
        </div>
      )}

      <RazorpayScript />
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StepBar({ step }) {
  const steps = ['Select Plan', 'Payment Method', 'Checkout']
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 8 }}>
      {steps.map((label, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, background: i <= step ? 'var(--forest)' : 'var(--border)', color: i <= step ? 'var(--cream)' : 'var(--muted)', transition: 'all 0.2s' }}>
              {i < step ? <Check size={13} strokeWidth={3} /> : i + 1}
            </div>
            <span style={{ fontSize: 12, fontWeight: i === step ? 600 : 400, color: i <= step ? 'var(--ink)' : 'var(--muted)', whiteSpace: 'nowrap' }}>{label}</span>
          </div>
          {i < steps.length - 1 && <div style={{ flex: 1, height: 1, background: i < step ? 'var(--forest)' : 'var(--border)', margin: '0 12px', transition: 'all 0.2s' }} />}
        </div>
      ))}
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
        cursor: 'pointer', position: 'relative',
        border: selected ? `2px solid ${plan.color}` : '1.5px solid var(--border)',
        background: selected ? 'white' : 'var(--card)',
        transition: 'all 0.2s ease',
        transform: selected ? 'translateY(-3px)' : 'none',
        boxShadow: selected ? `0 10px 28px rgba(0,0,0,0.08), 0 0 0 1px ${plan.color}44` : 'none',
      }}
    >
      {plan.featured && (
        <div style={{ position: 'absolute', top: 12, right: 12, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '3px 8px', borderRadius: 100, background: plan.color, color: plan.highlight }}>
          Popular
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: plan.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={18} strokeWidth={2} color={plan.highlight} />
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{plan.name}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.3 }}>{plan.desc}</div>
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, fontStyle: 'italic', letterSpacing: '-0.04em', color: 'var(--ink)' }}>{plan.priceLabel}</span>
        <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 2 }}>/mo</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {plan.specs.map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 12 }}>
            <Check size={12} color={plan.color === 'var(--lavender)' ? 'var(--lavender-deep)' : plan.highlight} strokeWidth={2.5} style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ color: 'var(--ink)', lineHeight: 1.35 }}><strong style={{ color: 'var(--muted)', fontWeight: 500 }}>{s.label}:</strong> {s.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MethodCard({ id, selected, onSelect, icon, title, desc, badge, badgeColor }) {
  return (
    <div
      onClick={onSelect}
      style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderRadius: 14,
        border: selected ? '2px solid var(--forest)' : '1.5px solid var(--border)',
        background: selected ? 'rgba(22,32,25,0.03)' : 'var(--cream)',
        cursor: 'pointer', transition: 'all 0.18s',
      }}
    >
      <div style={{ width: 44, height: 44, borderRadius: 12, background: selected ? 'var(--forest)' : 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0, transition: 'all 0.18s' }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{title}</span>
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '2px 7px', borderRadius: 100, background: badgeColor, color: 'white' }}>{badge}</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{desc}</div>
      </div>
      <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${selected ? 'var(--forest)' : 'var(--border-dark)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {selected && <div style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--forest)' }} />}
      </div>
    </div>
  )
}

function RazorpayCheckout({ paying, onPay }) {
  return (
    <div>
      <div style={{ fontSize: 13.5, color: 'var(--muted)', marginBottom: 20, lineHeight: 1.6 }}>
        You'll be redirected to Razorpay's secure checkout. Pay with any Indian card, UPI app (GPay, PhonePe, Paytm), netbanking, or EMI.
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
        {['Visa', 'Mastercard', 'UPI', 'RuPay', 'EMI'].map(b => (
          <span key={b} style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, border: '1.5px solid var(--border-dark)', color: 'var(--muted)' }}>{b}</span>
        ))}
      </div>
      <button onClick={onPay} disabled={paying} className="btn-lavender" style={{ width: '100%', justifyContent: 'center', padding: '14px 0', fontSize: 15 }}>
        {paying ? 'Opening Razorpay…' : '🔒 Pay Securely with Razorpay'}
      </button>
      <div style={{ marginTop: 12, fontSize: 11.5, color: 'var(--muted)', textAlign: 'center' }}>
        256-bit SSL encryption · PCI DSS compliant · Powered by Razorpay
      </div>
    </div>
  )
}

function CoinDCXCheckout({ plan, paying, onPay, checkoutUrl }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, padding: '12px 16px', background: 'rgba(247,147,26,0.07)', borderRadius: 12, border: '1.5px solid rgba(247,147,26,0.25)' }}>
        <span style={{ fontSize: 20 }}>⚡</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>CoinDCX Pay</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>India's largest crypto exchange — pay in BTC, ETH, USDT, SOL &amp; more</div>
        </div>
      </div>

      <div style={{ fontSize: 13.5, color: 'var(--muted)', marginBottom: 20, lineHeight: 1.6 }}>
        Click below to open CoinDCX Pay checkout. You'll see the exact crypto equivalent for{' '}
        <strong style={{ color: 'var(--ink)' }}>{plan.priceLabel}/month</strong> in real-time before confirming.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        {[
          { sym: 'BTC', name: 'Bitcoin', color: '#F7931A' },
          { sym: 'ETH', name: 'Ethereum', color: '#627EEA' },
          { sym: 'USDT', name: 'Tether (ERC-20)', color: '#26A17B' },
          { sym: 'SOL', name: 'Solana', color: '#9945FF' },
        ].map(c => (
          <div key={c.sym} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--cream)', borderRadius: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'white', flexShrink: 0 }}>{c.sym}</div>
            <span style={{ fontSize: 13, color: 'var(--ink)' }}>{c.name}</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)' }}>live rate on checkout</span>
          </div>
        ))}
      </div>

      {checkoutUrl && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(45,122,74,0.08)', borderRadius: 10, fontSize: 13, color: '#2D7A4A', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Check size={14} strokeWidth={2.5} />
          Checkout opened in a new tab. Didn't open?{' '}
          <a href={checkoutUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#2D7A4A', fontWeight: 600 }}>click here</a>
        </div>
      )}

      <button onClick={onPay} disabled={paying} style={{
        width: '100%', padding: '14px 0', borderRadius: 100, border: 'none', cursor: paying ? 'not-allowed' : 'pointer',
        background: 'linear-gradient(135deg, #F7931A 0%, #E88A15 100%)', color: 'white',
        fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        opacity: paying ? 0.7 : 1, transition: 'all 0.18s',
      }}>
        {paying ? 'Opening CoinDCX Pay…' : '⚡ Pay with CoinDCX Pay'}
      </button>
      <div style={{ marginTop: 12, fontSize: 11.5, color: 'var(--muted)', textAlign: 'center' }}>
        Powered by CoinDCX · India's largest regulated crypto exchange
      </div>
    </div>
  )
}

function RazorpayScript() {
  if (!document.getElementById('rzp-script')) {
    const s = document.createElement('script')
    s.id = 'rzp-script'
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    document.head.appendChild(s)
  }
  return null
}
