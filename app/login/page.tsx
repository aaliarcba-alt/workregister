'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      localStorage.setItem('wr_user', JSON.stringify(data.user))
      router.push(data.user.isManager ? '/manager' : '/dashboard')
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#060d18', position: 'relative', overflow: 'hidden'
    }}>
      {/* Background grid */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(rgba(56,114,200,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(56,114,200,0.04) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />
      {/* Glow */}
      <div style={{
        position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 300, borderRadius: '50%',
        background: 'radial-gradient(ellipse, rgba(56,114,200,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', width: '100%', maxWidth: 420, padding: '0 24px' }}>
        {/* Logo area */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 52, height: 52, borderRadius: 14,
            background: 'linear-gradient(135deg, #3872c8, #1e3d5c)',
            marginBottom: 20,
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="7" height="7" rx="1.5" fill="white" opacity="0.9"/>
              <rect x="14" y="3" width="7" height="7" rx="1.5" fill="white" opacity="0.6"/>
              <rect x="3" y="14" width="7" height="7" rx="1.5" fill="white" opacity="0.6"/>
              <rect x="14" y="14" width="7" height="7" rx="1.5" fill="white" opacity="0.9"/>
            </svg>
          </div>
          <h1 style={{
            fontFamily: 'Syne, sans-serif', fontSize: 28, fontWeight: 700,
            color: '#e8edf5', margin: '0 0 6px',letterSpacing: '-0.5px'
          }}>Work Register</h1>
          <p style={{ color: '#4a6380', fontSize: 14, margin: 0 }}>Sintex — Digital Team</p>
        </div>

        {/* Card */}
        <div style={{
          background: '#0d1b2e', border: '1px solid #162d47',
          borderRadius: 16, padding: 32,
        }}>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', color: '#8ba3c4', fontSize: 13, marginBottom: 8, fontWeight: 500 }}>
                Email address
              </label>
              <input
                className="input-field"
                type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@welspun.com"
                required autoFocus
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', color: '#8ba3c4', fontSize: 13, marginBottom: 8, fontWeight: 500 }}>
                Password
              </label>
              <input
                className="input-field"
                type="password" value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                color: '#f87171', borderRadius: 8, padding: '10px 14px',
                fontSize: 13, marginBottom: 18,
              }}>{error}</div>
            )}
            <button className="btn-primary" type="submit" disabled={loading}
              style={{ width: '100%', padding: '12px', fontSize: 15 }}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', color: '#2a3d54', fontSize: 12, marginTop: 24 }}>
          Welspun World — Internal Tool
        </p>
      </div>
    </div>
  )
}
