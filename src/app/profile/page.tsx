'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentSession, getUserProfile, updateUserProfile } from '@/lib/api'

export default function ProfilePage() {
  const router = useRouter()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [session, setSession] = useState<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [profile, setProfile] = useState<any>(null)
  const [fullName, setFullName] = useState('')
  const [gender, setGender] = useState('')
  const [weight, setWeight] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const sess = await getCurrentSession()
        if (!sess) {
          router.push('/auth')
          return
        }
        setSession(sess)

        const prof = await getUserProfile(sess.user.id)
        setProfile(prof.data)
        setFullName(prof.data?.full_name || prof.data?.username || '')
        setGender(prof.data?.gender || '')
        setWeight(prof.data?.weight ? String(prof.data.weight) : '')
        setPhone(prof.data?.whatsapp || '')
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session?.user?.id) return
    setSaving(true)
    try {
      const updated = await updateUserProfile(session.user.id, {
        full_name: fullName,
        gender: gender || null,
        weight: weight ? Number(weight) : null,
        whatsapp: phone || null
      })
      setProfile(updated)
      alert('Profile updated')
    } catch (err) {
      console.error(err)
      alert('Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  if (loading) return <main className="container" style={{ marginTop: '2rem' }}>Loading profile...</main>

  return (
    <main className="container page-shell profile-page" style={{ marginTop: '1.25rem' }}>
      <div className="page-header">
        <span className="page-eyebrow">Account</span>
        <h1 className="page-title">My Profile</h1>
        <p className="page-subtitle">Manage your account details, contact info, and quick athlete body metrics from a layout built to work smoothly on phones and tablets.</p>
      </div>

      <section className="profile-layout">
        <div className="card hero-card" style={{ marginBottom: 0 }}>
          <div className="profile-summary-row">
            <div>
              <h2 style={{ marginBottom: '0.25rem' }}>{fullName || profile?.username || 'Athlete'}</h2>
              <p style={{ marginBottom: '0.35rem' }}>{profile?.email}</p>
              <span className="badge" style={{ color: 'var(--primary)', borderColor: 'rgba(249,115,22,0.35)', background: 'rgba(249,115,22,0.12)' }}>
                {(profile?.role || 'user').toUpperCase()}
              </span>
            </div>
            <div className="profile-stat-grid" style={{ width: '100%' }}>
              <div className="card surface-muted" style={{ marginBottom: 0 }}>
                <p style={{ fontSize: '0.7rem', marginBottom: '0.2rem' }}>BODY WEIGHT</p>
                <h3 style={{ marginBottom: 0 }}>{weight || '—'} {weight ? 'kg' : ''}</h3>
              </div>
              <div className="card surface-muted" style={{ marginBottom: 0 }}>
                <p style={{ fontSize: '0.7rem', marginBottom: '0.2rem' }}>CONTACT</p>
                <h3 style={{ marginBottom: 0, fontSize: '1rem' }}>{phone || 'Not set'}</h3>
              </div>
            </div>
          </div>
        </div>

        <div className="stack-md">
          <div className="card" style={{ marginBottom: 0 }}>
            <form onSubmit={handleSave} className="flex flex-col gap-3">
              <div className="form-grid">
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Username</label>
                  <input className="input-field" value={profile?.username || ''} disabled />
                </div>

                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Email</label>
                  <input className="input-field" value={profile?.email || ''} disabled />
                </div>

                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Display Name</label>
                  <input className="input-field" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>

                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Gender</label>
                  <input className="input-field" value={gender} onChange={(e) => setGender(e.target.value)} placeholder="Male / Female / Other" />
                </div>

                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Weight (kg)</label>
                  <input className="input-field" type="number" value={weight} onChange={(e) => setWeight(e.target.value)} />
                </div>

                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Phone / WhatsApp</label>
                  <input className="input-field" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+94..." />
                </div>
              </div>

              <div className="profile-actions" style={{ marginTop: '0.5rem' }}>
                <button className="btn btn-primary" type="submit" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Profile'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ color: '#ef4444', borderColor: '#ef4444' }}
                  onClick={handleLogout}
                >
                  Logout
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>
    </main>
  )
}
