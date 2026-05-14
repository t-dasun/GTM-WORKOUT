'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type UserRole = 'athlete' | 'trainer'

export default function AuthRoleForm({
  role,
  title,
  subtitle,
}: {
  role: UserRole
  title: string
  subtitle: string
}) {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const normalizedEmail = email.trim().toLowerCase()
      if (!normalizedEmail) {
        throw new Error('Please enter your email address.')
      }

      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        })
        if (error) throw error

        const user = data.user
        if (user) {
          const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
          if (profile?.role === 'trainer') {
            router.push('/trainer')
            return
          }
        }
        router.push('/dashboard')
      } else {
        const { error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: {
              username: username.trim(),
              full_name: username.trim(),
              role,
            },
          },
        })
        if (error) throw error

        if (role === 'trainer') {
          router.push('/trainer')
        } else {
          router.push('/dashboard')
        }
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      const message = err?.message || 'An error occurred during authentication.'
      if (typeof message === 'string' && message.toLowerCase().includes('invalid login credentials')) {
        setError('Invalid email or password. On mobile, make sure email has no spaces and no auto-capital letters.')
      } else {
        setError(message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="container page-shell auth-page" style={{ marginTop: '2rem' }}>
      <section className="auth-layout auth-layout--role">
        <div className="hero-card card auth-hero-card">
          <div className="page-header">
            <span className="page-eyebrow">Forge access</span>
            <h1 className="page-title">{isLogin ? title : `Create ${role} account`}</h1>
            <p className="page-subtitle">{subtitle}</p>
          </div>
        </div>

        <div className="card auth-form-card" style={{ marginBottom: 0 }}>
          <h2 className="mb-4">{isLogin ? 'Sign in' : 'Sign up'}</h2>

          {error && (
            <div style={{ backgroundColor: '#ef444420', color: '#ef4444', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.875rem' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleAuth} className="flex flex-col gap-4">
            {!isLogin && (
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label" htmlFor="username">Username</label>
                <input
                  id="username"
                  type="text"
                  className="input-field"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                className="input-field"
                value={email}
                onChange={(e) => setEmail(e.target.value.replace(/\s+/g, ''))}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                inputMode="email"
                required
              />
            </div>

            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                className="input-field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary w-full" disabled={loading} style={{ marginTop: '0.5rem' }}>
              {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Sign Up')}
            </button>
          </form>

          <div className="text-center mt-4" style={{ fontSize: '0.875rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
            </span>
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 500 }}
            >
              {isLogin ? `Sign Up as ${role}` : `Sign In as ${role}`}
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}
