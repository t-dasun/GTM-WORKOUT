'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getCurrentSession, getUserProfile, getUserSchedule, getUserScheduleHistory, getTrainers, linkTrainer, updateUserScheduleMapping, deleteScheduleHistory, reactivateFromHistory } from '@/lib/api'

export default function SchedulePage() {
  const router = useRouter()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [scheduleData, setScheduleData] = useState<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [profile, setProfile] = useState<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [trainers, setTrainers] = useState<any[]>([])
  
  const [loading, setLoading] = useState(true)
  const [linking, setLinking] = useState(false)
  const [selectedTrainer, setSelectedTrainer] = useState('')
  const [trainerStatus, setTrainerStatus] = useState<'approved' | 'pending' | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [savingMapping, setSavingMapping] = useState(false)
  const [activatingId, setActivatingId] = useState<string | null>(null)
  const [deletingHistoryId, setDeletingHistoryId] = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [history, setHistory] = useState<any[]>([])

  useEffect(() => {
    async function loadData() {
      try {
        const sess = await getCurrentSession()
        if (!sess) {
          router.push('/auth')
          return
        }
        
        const [sched, prof, trList, hist] = await Promise.all([
          getUserSchedule(sess.user.id).catch(() => null),
          getUserProfile(sess.user.id),
          getTrainers(),
          getUserScheduleHistory(sess.user.id)
        ])

        if (prof.data?.role === 'trainer') {
          router.push('/trainer')
          return
        }
        
        setScheduleData(sched)
        setMapping(sched?.day_of_week_mapping || {})
        setProfile(prof.data)
        setTrainers(trList)
        setSelectedTrainer(prof.data?.trainer_link_trainer_id || '')
        setTrainerStatus(prof.data?.trainer_link_status || null)
        setHistory(hist || [])
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [router])

  const handleLinkTrainer = async () => {
    if (!profile) return
    setLinking(true)
    try {
      const targetTrainer = selectedTrainer === "" ? null : selectedTrainer
      await linkTrainer(profile.id, targetTrainer)

      const updatedProfile = await getUserProfile(profile.id)
      setProfile(updatedProfile.data)
      setSelectedTrainer(updatedProfile.data?.trainer_link_trainer_id || '')
      setTrainerStatus(updatedProfile.data?.trainer_link_status || null)

      alert(targetTrainer ? 'Trainer request sent successfully!' : 'Trainer removed successfully!')
    } catch (err) {
      console.error(err)
      alert('Failed to link trainer')
    } finally {
      setLinking(false)
    }
  }

  const handleSaveMapping = async () => {
    if (!profile?.id || !scheduleData?.template_id) return
    setSavingMapping(true)

    try {
      const updated = await updateUserScheduleMapping(profile.id, mapping)
      setScheduleData({ ...scheduleData, ...updated, day_of_week_mapping: mapping })
      const hist = await getUserScheduleHistory(profile.id)
      setHistory(hist || [])
      alert('Schedule mapping updated!')
    } catch (err) {
      console.error(err)
      alert('Failed to update schedule mapping')
    } finally {
      setSavingMapping(false)
    }
  }

  const handleActivateHistory = async (historyId: string) => {
    if (!profile?.id) return
    if (!confirm('Activate this schedule? Your current schedule will be replaced.')) return
    setActivatingId(historyId)
    try {
      await reactivateFromHistory(profile.id, historyId)
      const [sched, hist] = await Promise.all([
        getUserSchedule(profile.id).catch(() => null),
        getUserScheduleHistory(profile.id)
      ])
      setScheduleData(sched)
      setMapping(sched?.day_of_week_mapping || {})
      setHistory(hist || [])
    } catch (err) {
      console.error(err)
      alert('Failed to activate schedule')
    } finally {
      setActivatingId(null)
    }
  }

  const handleDeleteHistory = async (historyId: string) => {
    if (!profile?.id) return
    if (!confirm('Delete this history entry? This cannot be undone.')) return
    setDeletingHistoryId(historyId)
    try {
      await deleteScheduleHistory(profile.id, historyId)
      setHistory(prev => prev.filter(h => h.id !== historyId))
    } catch (err) {
      console.error(err)
      alert('Failed to delete history entry')
    } finally {
      setDeletingHistoryId(null)
    }
  }

  if (loading) return <main className="container page-shell schedule-page text-center mt-4">Loading schedule...</main>

  const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const totalTemplateDays = scheduleData?.workout_templates?.template_days?.length || 0
  const dayOptions = Array.from({ length: totalTemplateDays }, (_, idx) => `Day ${idx + 1}`)

  return (
    <main className="container page-shell schedule-page">
      <div className="page-header page-header--split">
        <div>
          <span className="page-eyebrow">Athlete schedule</span>
          <h1 className="page-title">My Schedule</h1>
          <p className="page-subtitle">Manage your trainer connection, map workout blocks to weekdays, and keep old plans available from a layout tuned for mobile use.</p>
        </div>
        <div className="schedule-inline-actions">
          {scheduleData && (
            <Link href="/athlete/schedule/customize" className="btn btn-secondary">
              ⚙ Customize
            </Link>
          )}
          <Link href="/plan/create" className="btn btn-primary">
            + New Plan
          </Link>
        </div>
      </div>

      <div className="schedule-layout">
      <div className="schedule-stack">
      <div className="card hero-card mb-4" style={{ backgroundColor: 'var(--surface-hover)' }}>
        <h3 style={{ marginBottom: '1rem' }}>My Trainer</h3>
        <div className="schedule-inline-actions">
          <select 
            className="input-field" 
            style={{ flex: 1, marginBottom: 0 }} 
            value={selectedTrainer} 
            onChange={e => setSelectedTrainer(e.target.value)}
          >
            <option value="">No Trainer (Independent)</option>
            {trainers.map(t => (
              <option key={t.id} value={t.id}>{t.full_name || `@${t.username}` || t.email}</option>
            ))}
          </select>
          <button 
            className="btn btn-primary" 
            onClick={handleLinkTrainer} 
            disabled={linking || (selectedTrainer === "" && !profile?.trainer_link_trainer_id) || selectedTrainer === profile?.trainer_link_trainer_id}
          >
            {linking ? 'Saving...' : 'Save'}
          </button>
        </div>
        {selectedTrainer && trainerStatus === 'pending' && (
          <p className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: '#f59e0b' }}>
            Pending approval from trainer.
          </p>
        )}
        {selectedTrainer && trainerStatus === 'approved' && (
          <p className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: '#10b981' }}>
            Trainer approved.
          </p>
        )}
        <p className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>
          Link a trainer to your account. Your trainer will be able to manage your workout schedules and schedule mapping.
        </p>
      </div>
      
      {!scheduleData ? (
        <div className="card text-center" style={{ marginTop: '2rem', padding: '2rem' }}>
          <h3 className="mb-4">No Active Plan</h3>
          <p className="text-muted mb-4" style={{ color: 'var(--text-muted)' }}>You have not assigned any workout schedule yet.</p>
          <Link href="/plan/create" className="btn btn-primary" style={{ textDecoration: 'none' }}>
            Create Workout Plan
          </Link>
        </div>
      ) : (
        <>
          <div className="card" style={{ marginTop: '0.5rem' }}>
            <h3 style={{ marginBottom: '0.25rem' }}>Active Schedule</h3>
            <p className="text-muted" style={{ fontWeight: 500, color: 'var(--primary)', marginBottom: 0 }}>{scheduleData.workout_templates?.name || 'Unknown Plan'}</p>
            <p style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>
              {totalTemplateDays} training day{totalTemplateDays === 1 ? '' : 's'} in this plan. Pick which day of the week each workout block should land on.
            </p>
          </div>

          <div className="card" style={{ marginTop: '2rem' }}>
            <h3>Weekly Mapping</h3>
            <p style={{ fontSize: '0.75rem', marginBottom: '1rem' }}>Trainer can assign the schedule. You control which weekday each schedule day belongs to.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {weekDays.map((day, idx) => {
                const plan = mapping[day] || 'Rest'
                return (
                  <div key={idx} className="schedule-mapping-row" style={{ padding: '0.65rem 0.5rem', borderBottom: idx < 6 ? '1px solid var(--border)' : 'none' }}>
                    <span className="schedule-mapping-day" style={{ fontWeight: 500 }}>{day}</span>
                    <select
                      className="input-field schedule-mapping-select"
                      style={{ padding: '0.45rem', marginBottom: 0 }}
                      value={plan}
                      onChange={(e) => setMapping((prev) => ({ ...prev, [day]: e.target.value }))}
                    >
                      <option value="Rest">Rest</option>
                      {dayOptions.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                )
              })}
            </div>
            <button className="btn btn-primary" style={{ marginTop: '1rem', width: '100%' }} onClick={handleSaveMapping} disabled={savingMapping}>
              {savingMapping ? 'Saving...' : 'Save Mapping'}
            </button>
          </div>
        </>
      )}

      </div>

      <div className="schedule-stack">
      <div className="card" style={{ marginTop: '0', marginBottom: '2rem' }}>
        <div className="flex justify-between items-center" style={{ marginBottom: '1rem' }}>
          <div>
            <h3 style={{ marginBottom: '0.1rem' }}>Schedule History</h3>
            <p style={{ fontSize: '0.75rem' }}>Past & current schedules. Activate any previous one to resume it.</p>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {history.map((h) => {
            const isActive = !h.ended_at
            const start = new Date(h.started_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
            const end = h.ended_at ? new Date(h.ended_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Present'
            const mappedDays = h.day_of_week_mapping ? Object.entries(h.day_of_week_mapping as Record<string, string>).filter(([, v]) => v !== 'Rest') : []
            return (
              <div key={h.id} style={{
                border: `1px solid ${isActive ? 'rgba(249,115,22,0.5)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-md)',
                padding: '0.75rem 0.85rem',
                background: isActive ? 'rgba(249,115,22,0.06)' : 'var(--background)'
              }}>
                <div className="schedule-history-row" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex items-center" style={{ gap: '0.4rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
                      <p style={{ color: 'var(--text-main)', fontWeight: 600, margin: 0 }}>{h.workout_templates?.name || 'Unknown Plan'}</p>
                      {isActive && (
                        <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.45rem', borderRadius: '999px', background: 'rgba(249,115,22,0.2)', color: 'var(--primary)', border: '1px solid rgba(249,115,22,0.4)', whiteSpace: 'nowrap' }}>
                          Active
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '0.72rem', margin: 0, marginBottom: '0.2rem' }}>{start} → {end}</p>
                    {h.workout_templates?.level && (
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>Level: {h.workout_templates.level}</p>
                    )}
                    {mappedDays.length > 0 && (
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
                        {mappedDays.slice(0, 4).map(([day, val]) => `${day.slice(0,3)}: ${val}`).join(' · ')}
                        {mappedDays.length > 4 && ` +${mappedDays.length - 4} more`}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2" style={{ flexShrink: 0 }}>
                    {!isActive && (
                      <button
                        className="btn btn-primary"
                        style={{ padding: '0.35rem 0.7rem', fontSize: '0.72rem' }}
                        disabled={activatingId === h.id}
                        onClick={() => handleActivateHistory(h.id)}
                      >
                        {activatingId === h.id ? '...' : 'Activate'}
                      </button>
                    )}
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '0.35rem 0.7rem', fontSize: '0.72rem', color: '#ef4444', borderColor: 'rgba(239,68,68,0.35)' }}
                      disabled={deletingHistoryId === h.id}
                      onClick={() => handleDeleteHistory(h.id)}
                    >
                      {deletingHistoryId === h.id ? '...' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
          {history.length === 0 && (
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>No schedule history yet.</p>
          )}
        </div>
      </div>
      </div>
      </div>
    </main>
  )
}
