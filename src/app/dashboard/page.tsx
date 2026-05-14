'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import ExerciseLogger from '@/components/ExerciseLogger'
import Link from 'next/link'
import { getAthleteDashboardData, getCurrentSession, getPendingTrainerRequests, getUserProfile, logExercise, respondToTrainerRequest, updateUserProfile } from '@/lib/api'

const createSessionId = () => {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export default function Dashboard() {
  const router = useRouter()
  const workoutDaysRef = useRef<HTMLDivElement | null>(null)
  const thisWeekRef = useRef<HTMLDivElement | null>(null)
  const recentSessionsRef = useRef<HTMLDivElement | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [session, setSession] = useState<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [dashboardData, setDashboardData] = useState<any>(null)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasSchedule, setHasSchedule] = useState(true)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pendingRequests, setPendingRequests] = useState<any[]>([])
  const [requestLoadingId, setRequestLoadingId] = useState<string | null>(null)
  // loggedMap: exerciseId -> number of sets logged
  const [loggedMap, setLoggedMap] = useState<Record<string, number>>({})
  const [showFinishModal, setShowFinishModal] = useState(false)
  const [sameAsLastTimeSelected, setSameAsLastTimeSelected] = useState(true)
  const [profileWeight, setProfileWeight] = useState<number | null>(null)
  const [finishWeight, setFinishWeight] = useState('')
  const [workoutSessionIds, setWorkoutSessionIds] = useState<Record<number, string>>({})
  const [draftSetsMap, setDraftSetsMap] = useState<Record<string, { setNumber: number, reps: number, weight: number }[]>>({})
  const [isWorkoutLogExpanded, setIsWorkoutLogExpanded] = useState(true)
  const [expandedExerciseKey, setExpandedExerciseKey] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      try {
        const sess = await getCurrentSession()
        if (!sess) {
          router.push('/auth')
          return
        }
        setSession(sess)
        
        const profile = await getUserProfile(sess.user.id)
        if (profile.data?.role === 'trainer') {
          router.push('/trainer')
          return
        }
        const initialWeight = typeof profile.data?.weight === 'number' ? profile.data.weight : null
        setProfileWeight(initialWeight)
        setFinishWeight(initialWeight !== null ? String(initialWeight) : '')
        
        const [{ hasSchedule: sched, data }, reqs] = await Promise.all([
          getAthleteDashboardData(sess.user.id),
          getPendingTrainerRequests(sess.user.id)
        ])

        setHasSchedule(sched)
        if (data) {
          setDashboardData(data)
          setSelectedDay(data.upNextDayNumber)
          setWorkoutSessionIds(prev => {
            if (prev[data.upNextDayNumber]) return prev
            return { ...prev, [data.upNextDayNumber]: createSessionId() }
          })
        }
        setPendingRequests(reqs)
      } catch (err) {
        console.error('Failed to load dashboard data', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [router])

  useEffect(() => {
    if (!selectedDay) return
    const timer = setTimeout(() => {
      setWorkoutSessionIds(prev => {
        if (prev[selectedDay]) return prev
        return { ...prev, [selectedDay]: createSessionId() }
      })
    }, 0)
    return () => clearTimeout(timer)
  }, [selectedDay])

  if (loading) {
    return <main className="container page-shell dashboard-page" style={{ textAlign: 'center' }}>Loading dashboard...</main>
  }

  if (!hasSchedule || !dashboardData) {
    return (
      <main className="container" style={{ marginTop: '4rem', textAlign: 'center' }}>
        <h2>No Active Schedule</h2>
        <p className="mb-4 text-muted" style={{ color: 'var(--text-muted)' }}>You don&apos;t have any upcoming workouts. Wait for your trainer to assign one, or create your own schedule.</p>
        <div className="card text-center" style={{ borderColor: 'var(--primary)', marginTop: '2rem' }}>
          <h3 style={{ color: 'var(--primary)', marginBottom: '1rem' }}>Create a Plan</h3>
          <p className="mb-4" style={{ fontSize: '0.875rem' }}>Since your database is fresh, you&apos;ll need to set up a workout schedule and assign it before you can log exercises.</p>
          <Link href="/athlete/schedule" className="btn btn-primary w-full" style={{ textDecoration: 'none' }}>
            Go to Schedule Settings
          </Link>
        </div>
      </main>
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activeDay = dashboardData.days.find((d: any) => d.dayNumber === selectedDay) || dashboardData.days[0]
  const activeSessionId = workoutSessionIds[activeDay.dayNumber] || ''
  const upNextDayText = `Day ${dashboardData.upNextDayNumber}`
  const mappedBlockText = dashboardData.mappedBlock === 'Rest' ? `Rest day (${dashboardData.todayName})` : `${dashboardData.todayName} • ${dashboardData.mappedBlock}`
  const activeSummary = activeDay.exercises.length > 0
    ? `${activeDay.exercises.length} exercise${activeDay.exercises.length === 1 ? '' : 's'} ready to log`
    : 'No exercises set for this day yet'
  const insights = dashboardData.insights || {
    estimatedDurationMin: 45,
    lastSessionVolume: 0,
    previousSessionVolume: 0,
    sessionIncreased: false,
    streak: 0,
    weekSummary: [],
    recentSessions: []
  }

  const volumeTrendLabel = insights.sessionIncreased ? '↑ Improved' : '→ Stable'
  const lastSessionDateLabel = insights.recentSessions?.[0]?.date
    ? new Date(insights.recentSessions[0].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : 'No sessions'
  const weekInitials = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  const compactWeekSummary = weekInitials.map((label, idx) => {
    const row = insights.weekSummary?.[idx] as { status?: string; mapped?: string } | undefined
    const normalizedStatus = row?.mapped === 'Rest'
      ? 'rest'
      : (row?.status === 'done' || row?.status === 'done-late' || row?.status === 'missed' || row?.status === 'queued'
        ? row.status
        : 'rest')

    return {
      label,
      status: normalizedStatus,
    }
  })

  // Use day + tile index + exercise id to avoid collisions when same exercise appears on multiple days
  const getLogKey = (dayNumber: number, exerciseId: string, idx: number) => `${dayNumber}::${exerciseId}::${idx}`

  const selectDay = (dayNumber: number) => {
    setSelectedDay(dayNumber)
    setExpandedExerciseKey(null)
    setWorkoutSessionIds(prev => {
      if (prev[dayNumber]) return prev
      return { ...prev, [dayNumber]: createSessionId() }
    })
  }

  const scrollToWorkoutDays = () => {
    workoutDaysRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const scrollToSection = (ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleStartWorkout = () => {
    selectDay(dashboardData.upNextDayNumber)
    setTimeout(() => scrollToWorkoutDays(), 60)
  }

  const refreshDashboard = async (opts?: { preserveSelectedDay?: boolean }) => {
    if (!session?.user?.id) return
    const { hasSchedule: sched, data } = await getAthleteDashboardData(session.user.id)
    setHasSchedule(sched)
    if (data) {
      setDashboardData(data)
      const shouldPreserve = opts?.preserveSelectedDay ?? true
      const hasSelectedDay = typeof selectedDay === 'number' && data.days.some((d: { dayNumber: number }) => d.dayNumber === selectedDay)
      const nextDay = shouldPreserve && hasSelectedDay ? selectedDay : data.upNextDayNumber
      setSelectedDay(nextDay)
      setWorkoutSessionIds(prev => {
        if (prev[nextDay]) return prev
        return { ...prev, [nextDay]: createSessionId() }
      })
    }
  }

  const handleExerciseLogged = async (exerciseId: string, completedCount: number) => {
    setLoggedMap(prev => ({ ...prev, [exerciseId]: completedCount }))
    try {
      await refreshDashboard({ preserveSelectedDay: true })
    } catch (err) {
      console.error('Failed to refresh dashboard after log', err)
    }
  }

  const handleQuickFinishAll = () => {
    setSameAsLastTimeSelected(prev => !prev)
  }

  const handleSetsDraftChange = (exerciseKey: string, setsData: { setNumber: number, reps: number, weight: number }[]) => {
    setDraftSetsMap(prev => ({ ...prev, [exerciseKey]: setsData }))
  }

  const handleTrainerDecision = async (trainerId: string, decision: 'approved' | 'denied') => {
    if (!session?.user?.id) return
    setRequestLoadingId(trainerId)

    try {
      await respondToTrainerRequest(session.user.id, trainerId, decision)
      const refreshed = await getPendingTrainerRequests(session.user.id)
      setPendingRequests(refreshed)
    } catch (err) {
      console.error(err)
      alert(`Failed to ${decision === 'approved' ? 'approve' : 'deny'} trainer request`)
    } finally {
      setRequestLoadingId(null)
    }
  }

  const handleConfirmFinish = async () => {
    try {
      if (sameAsLastTimeSelected && session?.user?.id) {
        const sessionId = activeSessionId || createSessionId()
        if (!activeSessionId) {
          setWorkoutSessionIds(prev => ({ ...prev, [activeDay.dayNumber]: sessionId }))
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const exercises: any[] = activeDay.exercises
        const pending = exercises
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((ex: any, idx: number) => ({ ex, idx, logKey: getLogKey(activeDay.dayNumber, ex.id, idx) }))
          .filter(item => loggedMap[item.logKey] === undefined)

        if (pending.length > 0) {
          await Promise.all(
            pending.map(({ ex, logKey }) => {
              const sets = draftSetsMap[logKey] || ex.setsData
              return logExercise(session.user.id, ex.id, sets, {
                sessionId,
                sessionDayNumber: activeDay.dayNumber,
              })
            })
          )

          setLoggedMap(prev => {
            const next = { ...prev }
            pending.forEach(({ ex, logKey }) => {
              const sets = draftSetsMap[logKey] || ex.setsData
              next[logKey] = sets.length
            })
            return next
          })
        }
      }

      const parsedWeight = finishWeight.trim() === '' ? null : Number(finishWeight)
      if (parsedWeight !== null && !Number.isNaN(parsedWeight) && parsedWeight > 0 && session?.user?.id) {
        if (profileWeight === null || parsedWeight !== profileWeight) {
          await updateUserProfile(session.user.id, { weight: parsedWeight })
          setProfileWeight(parsedWeight)
        }
      }

      await refreshDashboard()
      setWorkoutSessionIds(prev => ({ ...prev, [activeDay.dayNumber]: createSessionId() }))
      setShowFinishModal(false)
      setLoggedMap({})
      setDraftSetsMap({})
      alert('Great workout! Session complete. 🔥')
    } catch (err) {
      console.error(err)
      alert('Workout saved, but failed to update body weight')
      setShowFinishModal(false)
      setLoggedMap({})
    }
  }

  return (
    <main className="container page-shell dashboard-page" style={{ paddingBottom: '5rem' }}>
      <div className="page-header">
        <span className="page-eyebrow">Athlete view</span>
        <h1 className="page-title">Training Dashboard</h1>
        <p className="page-subtitle">Track today&apos;s queue, log sets quickly, and review recovery insights from a layout tuned for mobile, tablet, and desktop.</p>
      </div>

      <div className="card hero-card" style={{
        borderColor: 'rgba(249, 115, 22, 0.45)',
        background: 'radial-gradient(circle at top right, rgba(249,115,22,0.22), rgba(24,24,27,0.98) 55%)',
        boxShadow: '0 24px 60px rgba(0, 0, 0, 0.24)',
        marginBottom: '1rem',
        padding: '1.2rem'
      }}>
        <p style={{
          display: 'inline-block',
          fontSize: '0.75rem',
          color: 'var(--primary)',
          border: '1px solid rgba(249, 115, 22, 0.45)',
          borderRadius: '999px',
          padding: '0.2rem 0.6rem',
          marginBottom: '0.75rem'
        }}>
          🔥 Queued from Tuesday · won&apos;t break your cycle
        </p>

        <div className="dashboard-hero-top" style={{ gap: '0.75rem' }}>
          <div>
            <h2 style={{ marginBottom: '0.35rem', fontSize: '1.8rem' }}>Up next: <span style={{ color: 'var(--primary)' }}>{upNextDayText}</span></h2>
            <p style={{ marginBottom: '0.25rem', fontSize: '0.92rem' }}>{dashboardData.templateLevel} • {activeSummary}</p>
            <p style={{ fontSize: '0.78rem' }}>{mappedBlockText}. Beat last week and the queue rolls forward automatically.</p>
            <p style={{ fontSize: '0.76rem', marginTop: '0.55rem', color: 'rgba(255,255,255,0.8)' }}>{activeSummary}</p>
          </div>
          <button
            className="btn btn-primary"
            style={{ whiteSpace: 'nowrap', padding: '0.85rem 1rem', boxShadow: '0 12px 32px rgba(249, 115, 22, 0.28)' }}
            onClick={handleStartWorkout}
          >
            Start workout
          </button>
        </div>

        <div className="dashboard-metrics" style={{ marginTop: '0.9rem' }}>
          <div
            className="card"
            style={{ marginBottom: 0, padding: '0.6rem 0.75rem', flex: 1, minWidth: '110px', background: 'rgba(9, 9, 11, 0.45)', textAlign: 'center', cursor: 'pointer' }}
            onClick={() => scrollToSection(thisWeekRef)}
          >
            <p style={{ fontSize: '0.7rem' }}>WEEK SUMMARY</p>
            <div className="dashboard-week-mini">
              {compactWeekSummary.map((day, idx) => (
                <span key={`${day.label}-${idx}`} className={`dashboard-week-day status-${day.status}`}>
                  {day.label}
                </span>
              ))}
            </div>
          </div>
          <div className="card" style={{ marginBottom: 0, padding: '0.6rem 0.75rem', flex: 1, minWidth: '110px', background: 'rgba(9, 9, 11, 0.45)', textAlign: 'center' }}>
            <p style={{ fontSize: '0.7rem' }}>LAST SESSION WEIGHT</p>
            <p style={{ color: 'var(--text-main)', fontWeight: 700, fontSize: '0.95rem' }}>{Math.round(insights.lastSessionVolume).toLocaleString()} kg</p>
            <p style={{ fontSize: '0.7rem', color: insights.sessionIncreased ? '#f97316' : 'var(--text-muted)' }}>{volumeTrendLabel}</p>
          </div>
          <div
            className="card"
            style={{ marginBottom: 0, padding: '0.6rem 0.75rem', flex: 1, minWidth: '110px', background: 'rgba(9, 9, 11, 0.45)', textAlign: 'center', cursor: 'pointer' }}
            onClick={() => scrollToSection(recentSessionsRef)}
          >
            <p style={{ fontSize: '0.7rem' }}>LAST SESSION DATE</p>
            <p style={{ color: 'var(--text-main)', fontWeight: 700, fontSize: '0.95rem' }}>{lastSessionDateLabel}</p>
            <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Tap to view recent</p>
          </div>
        </div>
      </div>

      <div className="stack-md">
      <div ref={workoutDaysRef} className="card" style={{ marginBottom: '0', padding: '0.9rem' }}>
        <div className="mb-4" style={{ marginBottom: '0.75rem', textAlign: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h3 style={{ marginBottom: '0.15rem' }}>Workout days</h3>
            <p style={{ fontSize: '0.75rem' }}>Tap a day to expand its exercises and log your session.</p>
          </div>
        </div>
        <div className="hide-scrollbar chip-scroll dashboard-day-strip" style={{ paddingBottom: '0.1rem', flex: 1, WebkitOverflowScrolling: 'touch' }}>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {dashboardData.days.map((day: any) => (
            <button
              key={day.id}
              className={selectedDay === day.dayNumber ? 'btn btn-primary' : 'btn btn-secondary'}
              onClick={() => selectDay(day.dayNumber)}
              style={{ minWidth: '110px', padding: '0.7rem 0.8rem', fontSize: '0.78rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '0.2rem' }}
            >
              <span>Day {day.dayNumber}</span>
              <span style={{ fontSize: '0.68rem', opacity: 0.85 }}>{day.exercises.length} exercise{day.exercises.length === 1 ? '' : 's'}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="dashboard-layout" style={{ alignItems: 'start' }}>
      <div className="dashboard-main-stack">
      <div className="card" style={{ marginBottom: 0, padding: '1rem' }}>
        <button
          type="button"
          onClick={() => setIsWorkoutLogExpanded(prev => !prev)}
          style={{
            width: '100%',
            border: 'none',
            background: 'transparent',
            color: 'inherit',
            padding: 0,
            cursor: 'pointer'
          }}
          aria-expanded={isWorkoutLogExpanded}
          aria-label={isWorkoutLogExpanded ? 'Collapse workout log tile' : 'Expand workout log tile'}
        >
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <p style={{ fontSize: '0.72rem', letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
              Day {activeDay.dayNumber}
            </p>
            <h3 style={{ marginBottom: '0.2rem' }}>{dashboardData.templateName}</h3>
            <p style={{ fontSize: '0.8rem', marginBottom: 0 }}>
              {activeDay.exercises.length} exercise{activeDay.exercises.length === 1 ? '' : 's'}
            </p>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.45rem' }}>
              {isWorkoutLogExpanded ? 'Tap to collapse' : 'Tap to expand'}
            </p>
          </div>
        </button>

        {isWorkoutLogExpanded && (
          <>
            <p style={{ fontSize: '0.8rem', marginBottom: '1rem', textAlign: 'center' }}>{activeSummary}</p>

      <div className="dashboard-exercise-list">
        {activeDay.exercises.length === 0 && (
          <div className="card text-center" style={{ borderStyle: 'dashed' }}>
            <h3>No exercises in Day {activeDay.dayNumber}</h3>
            <p>Add exercises to this day from your plan editor.</p>
          </div>
        )}

        {activeDay.exercises.length > 0 && (
          <button
            onClick={handleQuickFinishAll}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: '0.75rem', padding: '0.75rem 1rem',
              background: sameAsLastTimeSelected ? 'rgba(249,115,22,0.16)' : 'rgba(9,9,11,0.45)',
              border: `1px solid ${sameAsLastTimeSelected ? 'rgba(249,115,22,0.45)' : 'var(--border)'}`,
              borderRadius: '12px', cursor: 'pointer',
              color: sameAsLastTimeSelected ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem',
              width: '100%'
            }}
          >
            <span>{`${sameAsLastTimeSelected ? '✓' : '○'} Same as last time`}</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400 }}>
              {activeDay.exercises.length} exercise{activeDay.exercises.length === 1 ? '' : 's'} · {sameAsLastTimeSelected ? 'selected' : 'not selected'}
            </span>
          </button>
        )}

        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {activeDay.exercises.map((ex: any, idx: number) => {
          const logKey = getLogKey(activeDay.dayNumber, ex.id, idx)
          const componentKey = `${logKey}::${JSON.stringify(ex.setsData)}`
          return (
            <ExerciseLogger
              key={componentKey}
              logKey={logKey}
              exercise={ex}
              userId={session.user.id}
              sessionId={activeSessionId}
              sessionDayNumber={activeDay.dayNumber}
              onLogged={handleExerciseLogged}
              onSetsDataChange={handleSetsDraftChange}
              autoSelectAll={sameAsLastTimeSelected && loggedMap[logKey] === undefined}
              forceLogged={loggedMap[logKey] !== undefined}
              isOpen={expandedExerciseKey === logKey}
              onToggle={() => setExpandedExerciseKey(prev => prev === logKey ? null : logKey)}
            />
          )
        })}
      </div>

      {/* Finish Workout button */}
      {(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const loggedCount = activeDay.exercises.filter((ex: any, idx: number) => {
          const logKey = getLogKey(activeDay.dayNumber, ex.id, idx)
          return loggedMap[logKey] !== undefined
        }).length
        const total = activeDay.exercises.length
        return (
          <button
            className="btn btn-primary w-full"
            style={{ marginTop: '1.2rem', position: 'relative' }}
            onClick={() => setShowFinishModal(true)}
          >
            Finish Workout
            {loggedCount > 0 && (
              <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', opacity: 0.85 }}>({loggedCount}/{total} logged)</span>
            )}
          </button>
        )
      })()}
          </>
        )}
      </div>

      {/* Finish Workout Modal */}
      {showFinishModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.72)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          padding: '1rem'
        }} onClick={() => setShowFinishModal(false)}>
          <div
            style={{
              background: 'var(--surface)', borderRadius: '20px 20px 16px 16px',
              padding: '1.5rem', width: '100%', maxWidth: '480px',
              border: '1px solid var(--border)', maxHeight: '80vh', overflowY: 'auto'
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: '0.3rem' }}>Finish Workout?</h3>
            <p style={{ fontSize: '0.8rem', marginBottom: '1.1rem' }}>Review which exercises you completed. Only logged exercises count toward your session.</p>

            <div className="list-stack" style={{ marginBottom: '1.25rem' }}>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {activeDay.exercises.map((ex: any, idx: number) => {
                const logKey = getLogKey(activeDay.dayNumber, ex.id, idx)
                const logged = loggedMap[logKey]
                const isLogged = logged !== undefined
                const selectedByToggle = sameAsLastTimeSelected && !isLogged
                const total = ex.setsData?.length || 0
                return (
                  <div key={ex.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '0.6rem 0.75rem',
                    borderRadius: '10px',
                    border: `1px solid ${(isLogged || selectedByToggle) ? 'rgba(249,115,22,0.4)' : 'var(--border)'}`,
                    background: (isLogged || selectedByToggle) ? 'rgba(249,115,22,0.07)' : 'rgba(9,9,11,0.6)'
                  }}>
                    <div>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem' }}>{ex.name}</p>
                      <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {isLogged ? `${logged} of ${total} sets logged` : selectedByToggle ? `${total} of ${total} sets selected` : `0 of ${total} sets — not selected`}
                      </p>
                    </div>
                    <span style={{
                      fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.55rem',
                      borderRadius: '999px',
                      background: (isLogged || selectedByToggle) ? 'rgba(249,115,22,0.2)' : 'rgba(255,255,255,0.05)',
                      color: (isLogged || selectedByToggle) ? 'var(--primary)' : 'var(--text-muted)',
                      border: `1px solid ${(isLogged || selectedByToggle) ? 'rgba(249,115,22,0.35)' : 'var(--border)'}`,
                      whiteSpace: 'nowrap'
                    }}>
                      {isLogged ? '✓ Logged' : selectedByToggle ? 'Selected' : 'Skipped'}
                    </span>
                  </div>
                )
              })}
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.4rem', color: 'var(--text-muted)' }}>
                Body weight (kg) — optional
              </label>
              <input
                type="number"
                className="input-field"
                value={finishWeight}
                onChange={(e) => setFinishWeight(e.target.value)}
                placeholder={profileWeight !== null ? String(profileWeight) : 'e.g. 72.5'}
                style={{ marginBottom: 0 }}
              />
            </div>

            <div className="dashboard-modal-actions">
              <button
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => setShowFinishModal(false)}
              >
                Keep Going
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={handleConfirmFinish}
              >
                Confirm &amp; Finish
              </button>
            </div>
          </div>
        </div>
      )}
      </div>

      <div className="dashboard-side-stack">
        {pendingRequests.length > 0 && (
          <div className="card" style={{ marginBottom: 0, borderColor: 'rgba(249, 115, 22, 0.45)' }}>
            <h3 style={{ marginBottom: '0.75rem', color: 'var(--primary)' }}>Trainer Request</h3>
            <div className="flex flex-col gap-2">
              {pendingRequests.map((request) => (
                <div key={request.trainer_id} style={{ padding: '0.75rem', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                  <p style={{ color: 'var(--text-main)', fontWeight: 600, marginBottom: '0.2rem' }}>
                    {request.trainer?.full_name || `@${request.trainer?.username}` || request.trainer?.email || 'Trainer'}
                  </p>
                  <p style={{ fontSize: '0.75rem', marginBottom: '0.6rem' }}>
                    Wants to view your logs and assign plans.
                  </p>

                  <div className="flex gap-2">
                    <button
                      className="btn btn-primary"
                      onClick={() => handleTrainerDecision(request.trainer_id, 'approved')}
                      disabled={requestLoadingId === request.trainer_id}
                      style={{ padding: '0.45rem 0.8rem', fontSize: '0.75rem', flex: 1 }}
                    >
                      Approve
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleTrainerDecision(request.trainer_id, 'denied')}
                      disabled={requestLoadingId === request.trainer_id}
                      style={{ padding: '0.45rem 0.8rem', fontSize: '0.75rem', flex: 1 }}
                    >
                      Deny
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div ref={thisWeekRef} className="card" style={{ marginBottom: 0 }}>
          <h3 style={{ marginBottom: '0.8rem' }}>This Week</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {insights.weekSummary.map((day: { dayName: string, mapped: string, status: string }) => {
              const isDone = day.status === 'done'
              const isDoneLate = day.status === 'done-late'
              const isQueued = day.status === 'queued'
              const isMissed = day.status === 'missed'
              const isRest = day.mapped === 'Rest'
              const iconMap: Record<string, string> = { done: '✓', 'done-late': '↺', queued: '→', missed: '✗', rest: '·' }
              const icon = isRest ? iconMap.rest : iconMap[day.status] || '·'
              const iconColor = isDone ? '#22c55e' : isDoneLate ? '#38bdf8' : isMissed ? '#ef4444' : isQueued ? 'rgba(249,115,22,0.78)' : 'var(--text-muted)'
              const rowBg = isDone ? 'rgba(34,197,94,0.10)' : isDoneLate ? 'rgba(56,189,248,0.10)' : isMissed ? 'rgba(239,68,68,0.08)' : 'transparent'
              return (
                <div key={day.dayName} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.4rem 0.5rem', borderRadius: '6px', background: rowBg }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, width: '28px', color: iconColor, textAlign: 'center' }}>{icon}</span>
                  <span style={{ fontSize: '0.75rem', width: '70px', color: 'var(--text-muted)' }}>{day.dayName}</span>
                  <span style={{ fontSize: '0.78rem', color: isRest ? 'var(--text-muted)' : 'var(--text-main)', fontWeight: isRest ? 400 : 500 }}>
                    {isRest ? 'Rest' : day.mapped}
                  </span>
                  {isDone && <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: '#22c55e', fontWeight: 600 }}>Done</span>}
                  {isDoneLate && <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: '#38bdf8', fontWeight: 600 }}>Done late</span>}
                  {isMissed && <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: '#ef4444' }}>Missed</span>}
                  {isQueued && <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: 'rgba(249,115,22,0.7)' }}>Up next</span>}
                </div>
              )
            })}
          </div>
        </div>

        <div ref={recentSessionsRef} className="card" style={{ marginBottom: 0 }}>
          <h3 style={{ marginBottom: '0.8rem' }}>Recent Sessions</h3>
          <div className="flex flex-col gap-2">
            {insights.recentSessions.map((s: { id?: string, date: string, totalVolume: number, dayNumber?: number | null }, i: number) => (
              <div key={s.id || `${s.date}-${i}`} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.55rem 0.6rem',
                borderRadius: '8px',
                background: i === 0 ? 'rgba(249,115,22,0.08)' : 'var(--background)',
                border: `1px solid ${i === 0 ? 'rgba(249,115,22,0.3)' : 'var(--border)'}`
              }}>
                <div>
                  <p style={{ color: 'var(--text-main)', fontWeight: 600, marginBottom: '0.1rem', fontSize: '0.82rem' }}>
                    {new Date(s.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                  </p>
                  <p style={{ fontSize: '0.65rem', color: i === 0 ? 'var(--primary)' : 'var(--text-muted)', margin: 0 }}>
                    {i === 0 ? 'Last session' : (s.dayNumber ? `Day ${s.dayNumber}` : 'Workout')}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ color: 'var(--text-main)', fontWeight: 700, margin: 0, fontSize: '0.88rem' }}>{Math.round(s.totalVolume).toLocaleString()} kg</p>
                  <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', margin: 0 }}>total vol.</p>
                </div>
              </div>
            ))}
            {insights.recentSessions.length === 0 && (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No logged sessions yet.</p>
            )}
          </div>
        </div>
      </div>
      </div>
      </div>
    </main>
  )
}
