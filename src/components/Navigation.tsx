'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type NavItem = {
  href: string
  label: string
  shortLabel?: string
  icon: 'home' | 'calendar' | 'history' | 'routines' | 'exercises' | 'clients'
}

function NavGlyph({ icon, active = false }: { icon: NavItem['icon']; active?: boolean }) {
  const stroke = active ? 'var(--primary)' : 'currentColor'
  const common = {
    width: 19,
    height: 19,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }

  if (icon === 'home') {
    return (
      <svg {...common}>
        <path d="M3 11.5L12 4l9 7.5" />
        <path d="M5.5 10.5V20h13V10.5" />
      </svg>
    )
  }

  if (icon === 'calendar') {
    return (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 10h18" />
      </svg>
    )
  }

  if (icon === 'history') {
    return (
      <svg {...common}>
        <path d="M3 12a9 9 0 109-9 9.2 9.2 0 00-6.4 2.6" />
        <path d="M3 4v5h5" />
        <path d="M12 7v5l3 2" />
      </svg>
    )
  }

  if (icon === 'routines') {
    return (
      <svg {...common}>
        <path d="M9 6h11" />
        <path d="M9 12h11" />
        <path d="M9 18h11" />
        <path d="M4 6h.01M4 12h.01M4 18h.01" />
      </svg>
    )
  }

  if (icon === 'clients') {
    return (
      <svg {...common}>
        <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 00-3-3.87" />
        <path d="M16 3.13a4 4 0 010 7.75" />
      </svg>
    )
  }

  if (icon === 'exercises') {
    return (
      <svg {...common}>
        <path d="M2 10h4v4H2z" />
        <path d="M18 10h4v4h-4z" />
        <path d="M8 9h2v6H8z" />
        <path d="M14 9h2v6h-2z" />
        <path d="M6 12h2" />
        <path d="M16 12h2" />
        <path d="M10 12h4" />
      </svg>
    )
  }

  return (
    <svg {...common}>
      <path d="M6 6h12" />
      <path d="M5 12h14" />
      <path d="M8 18h8" />
    </svg>
  )
}

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
        supabase
          .from('users')
          .select('role, username, full_name')
          .eq('id', session.user.id)
          .single()
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
        supabase
          .from('users')
          .select('role, username, full_name')
          .eq('id', session.user.id)
          .single()
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
  if (pathname.startsWith('/auth') || pathname === '/') return null

  const trainerNav: NavItem[] = [
    { href: '/trainer', label: 'Clients', shortLabel: 'Clients', icon: 'clients' },
    { href: '/trainer/schedules', label: 'Schedules', shortLabel: 'Schedules', icon: 'routines' },
    { href: '/exercises', label: 'Exercises', shortLabel: 'Exercises', icon: 'exercises' },
  ]

  const athleteNav: NavItem[] = [
    { href: '/dashboard', label: 'Today', shortLabel: 'Today', icon: 'home' },
    { href: '/athlete/schedule', label: 'Schedule', shortLabel: 'Schedule', icon: 'calendar' },
    { href: '/history', label: 'History', shortLabel: 'History', icon: 'history' },
    { href: '/plan/create', label: 'Routines', shortLabel: 'Routines', icon: 'routines' },
    { href: '/exercises', label: 'Exercises', shortLabel: 'Exercises', icon: 'exercises' },
  ]

  const navItems = role === 'trainer' ? trainerNav : athleteNav
  const homeHref = role === 'trainer' ? '/trainer' : '/dashboard'
  const mobileNavItems = navItems

  const isActivePath = (href: string) => {
    if (href === '/trainer') return pathname === '/trainer'
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <>
      <nav className="nav-shell">
        <div className="nav-inner">
          <Link href={homeHref} className="nav-brand">
            <span className="nav-brand-mark">✦</span>
            <span className="nav-brand-copy">
              <span className="nav-brand-title">FORGE</span>
              <span className="nav-brand-subtitle">EXECUTION-FIRST</span>
            </span>
          </Link>

          <div className="nav-desktop-links hide-scrollbar">
            {navItems.map((item) => {
              const active = isActivePath(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-link${active ? ' active' : ''}`}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>

          <div className="nav-actions">
            <button className="nav-icon-button" aria-label="Notifications">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 01-3.46 0" />
              </svg>
            </button>
            <Link href="/profile" title="Profile" className="nav-profile">
              {displayName}
            </Link>
          </div>
        </div>
      </nav>

      <div className="mobile-tabbar">
        <div className="mobile-tabbar-grid" style={{ gridTemplateColumns: `repeat(${mobileNavItems.length}, minmax(0, 1fr))` }}>
          {mobileNavItems.map((item) => {
            const active = isActivePath(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`mobile-tab${active ? ' active' : ''}`}
              >
                <span className="mobile-tab-icon"><NavGlyph icon={item.icon} active={active} /></span>
                <span className="mobile-tab-label">{item.shortLabel || item.label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </>
  )
}
