'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function Navigation() {
  const pathname = usePathname()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [session, setSession] = useState<any>(null)
  const [role, setRole] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState('U')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        supabase.from('users').select('role, username, full_name').eq('id', session.user.id).single()
          .then(({ data }) => {
            if (data) {
              setRole(data.role)
              const label = data.full_name || data.username || session.user.email || 'U'
              setDisplayName(label.charAt(0).toUpperCase())
            }
          })
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user) {
        supabase.from('users').select('role, username, full_name').eq('id', session.user.id).single()
          .then(({ data }) => {
            if (data) {
              setRole(data.role)
              const label = data.full_name || data.username || session.user.email || 'U'
              setDisplayName(label.charAt(0).toUpperCase())
            }
          })
      } else {
        setRole(null)
        setDisplayName('U')
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  if (!session) return null
  if (pathname === '/auth' || pathname === '/') return null

  const trainerNav = [
    { href: '/trainer', label: 'Clients' },
    { href: '/plan/create', label: 'Routines' },
    { href: '/exercises', label: 'Exercises' }
  ]

  const athleteNav = [
    { href: '/dashboard', label: 'Today' },
    { href: '/athlete/schedule', label: 'Schedule' },
    { href: '/history', label: 'History' },
    { href: '/plan/create', label: 'Routines' },
    { href: '/exercises', label: 'Exercises' }
  ]

  const navItems = role === 'trainer' ? trainerNav : athleteNav

  return (
    <nav style={{
      position: 'sticky',
      top: 0,
      zIndex: 60,
      background: 'rgba(9, 9, 11, 0.92)',
      backdropFilter: 'blur(8px)',
      borderBottom: '1px solid rgba(63, 63, 70, 0.7)'
    }}>
      <div style={{ maxWidth: '1120px', margin: '0 auto', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <Link href={role === 'trainer' ? '/trainer' : '/dashboard'} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.55rem', flexShrink: 0 }}>
          <span style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'var(--primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#111' }}>✦</span>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '1rem', lineHeight: 1 }}>FORGE</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.6rem', letterSpacing: '0.08em' }}>EXECUTION-FIRST</div>
          </div>
        </Link>

        <div className="hide-scrollbar" style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', overflowX: 'auto', WebkitOverflowScrolling: 'touch', flex: 1 }}>
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  textDecoration: 'none',
                  color: active ? 'var(--text-main)' : 'var(--text-muted)',
                  background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
                  border: active ? '1px solid rgba(255,255,255,0.12)' : '1px solid transparent',
                  borderRadius: '10px',
                  padding: '0.45rem 0.75rem',
                  fontSize: '0.82rem',
                  whiteSpace: 'nowrap'
                }}
              >
                {item.label}
              </Link>
            )
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button style={{ width: '32px', height: '32px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer' }}>🔔</button>
          <Link
            href="/profile"
            title="Profile"
            style={{ width: '32px', height: '32px', borderRadius: '999px', border: '1px solid var(--border)', background: 'var(--surface-hover)', color: 'var(--text-main)', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}
          >
            {displayName}
          </Link>
        </div>
      </div>
    </nav>
  )
}
