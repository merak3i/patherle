import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handle = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      if (mode === 'signup') {
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name } },
        })
        if (err) throw err
        setSuccess('Check your email to confirm your account!')
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password })
        if (err) throw err
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setError('')
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (err) setError(err.message)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--cream)', padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 36, fontStyle: 'italic',
            fontWeight: 700, color: 'var(--forest)', letterSpacing: '-0.04em', lineHeight: 1,
          }}>
            Patherle
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6, letterSpacing: '0.03em' }}>
            multilingual · whatsapp AI
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: '#fff', borderRadius: 20, padding: 36,
          border: '1.5px solid var(--border)', boxShadow: '0 4px 32px rgba(0,0,0,0.04)',
        }}>
          {/* Mode toggle */}
          <div style={{
            display: 'flex', background: 'var(--cream)', borderRadius: 100,
            padding: 4, marginBottom: 28, gap: 4,
          }}>
            {['login', 'signup'].map(m => (
              <button key={m} onClick={() => { setMode(m); setError(''); setSuccess('') }} style={{
                flex: 1, padding: '8px 0', borderRadius: 100, border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font-body)', fontSize: 13.5, fontWeight: 600,
                background: mode === m ? 'var(--forest)' : 'transparent',
                color: mode === m ? 'var(--cream)' : 'var(--muted)',
                transition: 'all 0.18s ease',
              }}>
                {m === 'login' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          <form onSubmit={handle} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {mode === 'signup' && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.04em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                  Name
                </label>
                <input
                  type="text"
                  className="field"
                  placeholder="your name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </div>
            )}

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.04em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                Email
              </label>
              <input
                type="email"
                className="field"
                placeholder="you@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.04em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                Password
              </label>
              <input
                type="password"
                className="field"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            {error && (
              <div style={{ fontSize: 13, color: '#C0392B', background: 'rgba(192,57,43,0.07)', borderRadius: 8, padding: '8px 12px' }}>
                {error}
              </div>
            )}
            {success && (
              <div style={{ fontSize: 13, color: '#2D7A4A', background: 'rgba(45,122,74,0.07)', borderRadius: 8, padding: '8px 12px' }}>
                {success}
              </div>
            )}

            <button type="submit" className="btn-lavender" disabled={loading} style={{ width: '100%', justifyContent: 'center', marginTop: 4, padding: '12px 0' }}>
              {loading ? 'Please wait…' : (mode === 'login' ? 'Sign In' : 'Create Account')}
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>or</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          <button
            onClick={handleGoogle}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              padding: '11px 0', border: '1.5px solid var(--border-dark)', borderRadius: 100,
              background: 'white', cursor: 'pointer', fontFamily: 'var(--font-body)',
              fontSize: 14, fontWeight: 500, color: 'var(--ink)', transition: 'all 0.18s',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(26,26,24,0.4)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-dark)'}
          >
            <GoogleIcon />
            Continue with Google
          </button>
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted)', marginTop: 20 }}>
          By signing up you agree to our Terms &amp; Privacy Policy
        </p>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/>
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
    </svg>
  )
}
