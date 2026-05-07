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
    <main className="container" style={{ marginTop: '1.5rem', paddingBottom: '3rem' }}>
      <div className="card">
        <h2 style={{ marginBottom: '0.25rem' }}>My Profile</h2>
        <p style={{ marginBottom: '1rem' }}>Manage your account details.</p>

        <form onSubmit={handleSave} className="flex flex-col gap-3">
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

          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>

        <button
          className="btn btn-secondary w-full"
          style={{ marginTop: '0.8rem', color: '#ef4444', border: '1px solid #ef4444' }}
          onClick={handleLogout}
        >
          Logout
        </button>
      </div>
    </main>
  )
}
