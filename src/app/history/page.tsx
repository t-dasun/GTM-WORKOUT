'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { deleteAllWorkoutLogs, deleteWorkoutSession, getCurrentSession, getExerciseProgression, getLoggedExercises, getUserProfile, getWorkoutHistory } from '@/lib/api'

type RangeKey = 'week' | 'month' | '3months' | 'year' | 'all'
type ChartMetric = 'maxWeight' | 'avgWeight' | 'totalVolume' | 'setWeight'

type HistoryLog = {
  id: string
  exercise_id?: string
  sets_completed: number | null
  reps_completed: number | null
  weight_used: number | null
  timestamp: string
  exercises?: { id: string; name: string } | null
}

type HistorySession = {
  id: string
  date: string
  startedAt: string
  sessionDayNumber: number | null
  logs: HistoryLog[]
  totalVolume: number
  exerciseCount: number
}

type ProgressionDay = {
  date: string
  sets: { setNum: number; reps: number; weight: number }[]
  maxWeight: number
  totalVolume: number
  avgWeight: number
}

const RANGE_LABELS: Record<RangeKey, string> = {
  week: 'This Week',
  month: 'This Month',
  '3months': '3 Months',
  year: 'This Year',
  all: 'All Time',
}

function getRangeDates(range: RangeKey): { from?: string; to?: string } {
  const now = new Date()
  const toIso = (d: Date) => d.toISOString()
  if (range === 'all') return {}
  const from = new Date(now)
  if (range === 'week') from.setDate(now.getDate() - 7)
  else if (range === 'month') from.setMonth(now.getMonth() - 1)
  else if (range === '3months') from.setMonth(now.getMonth() - 3)
  else if (range === 'year') from.setFullYear(now.getFullYear() - 1)
  return { from: toIso(from), to: toIso(now) }
}

function fmtDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
function fmtDateFull(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function groupByWeek(sessions: HistorySession[]) {
  const weeks: Record<string, { weekLabel: string; sessions: typeof sessions; totalVolume: number }> = {}
  for (const s of sessions) {
    const d = new Date(s.date + 'T12:00:00')
    const day = d.getDay()
    const monday = new Date(d)
    monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
    const key = monday.toISOString().slice(0, 10)
    if (!weeks[key]) weeks[key] = { weekLabel: `Week of ${fmtDate(key)}`, sessions: [], totalVolume: 0 }
    weeks[key].sessions.push(s)
    weeks[key].totalVolume += s.totalVolume
  }
  return Object.values(weeks).sort((a, b) => (a.weekLabel < b.weekLabel ? 1 : -1))
}

function groupByMonth(sessions: HistorySession[]) {
  const months: Record<string, { label: string; sessions: typeof sessions; totalVolume: number }> = {}
  for (const s of sessions) {
    const d = new Date(s.date + 'T12:00:00')
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    if (!months[key]) months[key] = { label, sessions: [], totalVolume: 0 }
    months[key].sessions.push(s)
    months[key].totalVolume += s.totalVolume
  }
  return Object.values(months).sort((a, b) => (a.label < b.label ? 1 : -1))
}

export default function HistoryPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [range, setRange] = useState<RangeKey>('month')
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day')
  const [sessions, setSessions] = useState<HistorySession[]>([])
  const [exercises, setExercises] = useState<{ id: string; name: string }[]>([])
  const [selectedExercise, setSelectedExercise] = useState<string>('')
  const [chartMetric, setChartMetric] = useState<ChartMetric>('maxWeight')
  const [setIndex, setSetIndex] = useState<number>(1)
  const [progression, setProgression] = useState<ProgressionDay[]>([])
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [loadingChart, setLoadingChart] = useState(false)
  const [expandedDate, setExpandedDate] = useState<string | null>(null)
  const [deletingDate, setDeletingDate] = useState<string | null>(null)
  const [deletingAll, setDeletingAll] = useState(false)

  useEffect(() => {
    async function init() {
      const sess = await getCurrentSession()
      if (!sess) { router.push('/auth'); return }
      const prof = await getUserProfile(sess.user.id)
      if (prof.data?.role === 'trainer') { router.push('/trainer'); return }
      setUserId(sess.user.id)
      const exs = await getLoggedExercises(sess.user.id)
      setExercises(exs)
      if (exs.length > 0) setSelectedExercise(exs[0].id)
    }
    init()
  }, [router])

  const loadSessions = useCallback(async () => {
    if (!userId) return
    setLoadingSessions(true)
    try {
      const { from, to } = getRangeDates(range)
      const data = await getWorkoutHistory(userId, from, to) as HistorySession[]
      setSessions(data)
    } finally {
      setLoadingSessions(false)
    }
  }, [userId, range])

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadSessions()
    }, 0)
    return () => clearTimeout(timer)
  }, [loadSessions])

  useEffect(() => {
    if (!userId || !selectedExercise) return
    let cancelled = false
    async function load() {
      try {
        const data = await getExerciseProgression(userId!, selectedExercise) as ProgressionDay[]
        const { from } = getRangeDates(range)
        const filtered = from ? data.filter(d => d.date >= from.slice(0, 10)) : data
        if (!cancelled) setProgression(filtered)
      } finally {
        if (!cancelled) setLoadingChart(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [userId, selectedExercise, range])

  const refreshAfterDelete = useCallback(async () => {
    if (!userId) return
    const [exs] = await Promise.all([
      getLoggedExercises(userId),
      loadSessions(),
    ])
    setExercises(exs)
    if (exs.length === 0) {
      setSelectedExercise('')
      setProgression([])
      return
    }
    if (!selectedExercise || !exs.some(ex => ex.id === selectedExercise)) {
      setSelectedExercise(exs[0].id)
    }
  }, [loadSessions, selectedExercise, userId])

  const handleDeleteSession = async (sessionId: string, date: string) => {
    if (!userId) return
    if (!confirm(`Delete this workout session from ${fmtDateFull(date)}?`)) return
    setDeletingDate(sessionId)
    try {
      await deleteWorkoutSession(userId, sessionId, date)
      await refreshAfterDelete()
      if (expandedDate === sessionId) setExpandedDate(null)
    } catch (err) {
      console.error(err)
      alert('Failed to delete session')
    } finally {
      setDeletingDate(null)
    }
  }

  const handleDeleteAllLogs = async () => {
    if (!userId) return
    if (!confirm('Delete ALL workout logs? This cannot be undone.')) return
    setDeletingAll(true)
    try {
      await deleteAllWorkoutLogs(userId)
      await refreshAfterDelete()
      setExpandedDate(null)
    } catch (err) {
      console.error(err)
      alert('Failed to delete all logs')
    } finally {
      setDeletingAll(false)
    }
  }

  const totalVolumeInRange = sessions.reduce((a, s) => a + s.totalVolume, 0)
  const totalSessionsInRange = sessions.length

  // Build chart data
  const chartData = progression.map(day => {
    const base = {
      date: fmtDate(day.date),
      maxWeight: Math.round(day.maxWeight * 10) / 10,
      avgWeight: Math.round(day.avgWeight * 10) / 10,
      totalVolume: Math.round(day.totalVolume),
    }
    // Set-specific weight
    const setEntry = day.sets.find((s: { setNum: number }) => s.setNum === setIndex)
    return { ...base, setWeight: setEntry ? setEntry.weight : null }
  })

  const metricLabel: Record<ChartMetric, string> = {
    maxWeight: 'Max Weight (kg)',
    avgWeight: 'Avg Weight (kg)',
    totalVolume: 'Total Volume (kg)',
    setWeight: `Set ${setIndex} Weight (kg)`,
  }
  const selectedExerciseName = exercises.find(ex => ex.id === selectedExercise)?.name || 'Exercise'

  return (
    <main className="container page-shell history-page" style={{ paddingBottom: '5rem' }}>
      <div className="page-header history-header-row" style={{ marginBottom: '0.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <span className="page-eyebrow">Progress tracking</span>
          <h1 className="page-title">Workout History</h1>
          <p className="page-subtitle">Review logged sessions, exercise progression, and workload trends with controls that stay usable on smaller screens.</p>
        </div>
      </div>

      {/* Range filter */}
      <div className="hide-scrollbar" style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', marginBottom: '1.25rem', WebkitOverflowScrolling: 'touch' }}>
        {(Object.keys(RANGE_LABELS) as RangeKey[]).map(r => (
          <button
            key={r}
            onClick={() => setRange(r)}
            style={{
              padding: '0.4rem 0.85rem', borderRadius: '999px', border: `1px solid ${range === r ? 'var(--primary)' : 'var(--border)'}`,
              background: range === r ? 'rgba(249,115,22,0.15)' : 'var(--surface)', color: range === r ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: range === r ? 700 : 400, fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0
            }}
          >{RANGE_LABELS[r]}</button>
        ))}
      </div>

      {/* Summary stats */}
      <div className="history-summary-grid" style={{ marginBottom: '1.25rem' }}>
        {[
          { label: 'Sessions', value: totalSessionsInRange },
          { label: 'Total Volume', value: `${Math.round(totalVolumeInRange / 1000 * 10) / 10} t` },
          { label: 'Avg / Session', value: totalSessionsInRange > 0 ? `${Math.round(totalVolumeInRange / totalSessionsInRange).toLocaleString()} kg` : '—' },
        ].map(stat => (
          <div key={stat.label} className="card" style={{ marginBottom: 0, padding: '0.6rem 0.75rem', textAlign: 'center' }}>
            <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>{stat.label}</p>
            <p style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)', margin: '0.2rem 0 0 0' }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Progression chart */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <h3 style={{ marginBottom: '0.25rem' }}>Exercise Progression</h3>
        <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '0.7rem' }}>
          Tracking: <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{selectedExerciseName}</span>
        </p>

        <div className="history-exercise-selector hide-scrollbar" style={{ marginBottom: '0.75rem' }}>
          {exercises.length === 0 && (
            <span className="history-exercise-pill active">No exercises logged yet</span>
          )}
          {exercises.map((ex) => (
            <button
              key={ex.id}
              type="button"
              className={`history-exercise-pill${selectedExercise === ex.id ? ' active' : ''}`}
              onClick={() => setSelectedExercise(ex.id)}
            >
              {ex.name}
            </button>
          ))}
        </div>

        <div className="history-toolbar" style={{ marginBottom: '0.85rem' }}>
          <select
            className="input-field"
            style={{ flex: '1 1 180px', marginBottom: 0, fontSize: '0.82rem', padding: '0.45rem' }}
            value={selectedExercise}
            onChange={e => setSelectedExercise(e.target.value)}
          >
            {exercises.length === 0 && <option value="">No exercises logged yet</option>}
            {exercises.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
          </select>

          <select
            className="input-field"
            style={{ flex: '1 1 160px', marginBottom: 0, fontSize: '0.82rem', padding: '0.45rem' }}
            value={chartMetric}
            onChange={e => setChartMetric(e.target.value as ChartMetric)}
          >
            <option value="maxWeight">Max Weight</option>
            <option value="avgWeight">Avg Weight</option>
            <option value="totalVolume">Total Volume</option>
            <option value="setWeight">Specific Set Weight</option>
          </select>

          {chartMetric === 'setWeight' && (
            <select
              className="input-field"
              style={{ flex: '0 0 110px', marginBottom: 0, fontSize: '0.82rem', padding: '0.45rem' }}
              value={setIndex}
              onChange={e => setSetIndex(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>Set {n}</option>)}
            </select>
          )}
        </div>

        {loadingChart ? (
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>Loading...</p>
        ) : chartData.length === 0 ? (
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>No data for this exercise in the selected range.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#71717a' }} />
              <YAxis tick={{ fontSize: 10, fill: '#71717a' }} />
              <Tooltip
                contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px', fontSize: '0.78rem' }}
                labelStyle={{ color: '#f4f4f5', fontWeight: 600 }}
                itemStyle={{ color: '#f97316' }}
              />
              <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
              <Line
                type="monotone"
                dataKey={chartMetric}
                name={metricLabel[chartMetric]}
                stroke="#f97316"
                strokeWidth={2}
                dot={{ r: 3, fill: '#f97316' }}
                activeDot={{ r: 5 }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Session history */}
      <div className="card" style={{ marginBottom: 0 }}>
        <div className="flex justify-between items-center" style={{ marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 style={{ marginBottom: 0 }}>Sessions</h3>
          <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
            {(['day', 'week', 'month'] as const).map(g => (
              <button
                key={g}
                onClick={() => setGroupBy(g)}
                style={{
                  padding: '0.3rem 0.65rem', borderRadius: '999px', border: `1px solid ${groupBy === g ? 'var(--primary)' : 'var(--border)'}`,
                  background: groupBy === g ? 'rgba(249,115,22,0.15)' : 'transparent', color: groupBy === g ? 'var(--primary)' : 'var(--text-muted)',
                  fontWeight: groupBy === g ? 700 : 400, fontSize: '0.72rem', cursor: 'pointer', textTransform: 'capitalize'
                }}
              >{g}</button>
            ))}
            <button
              onClick={handleDeleteAllLogs}
              disabled={deletingAll || sessions.length === 0}
              style={{
                padding: '0.3rem 0.65rem', borderRadius: '999px', border: '1px solid rgba(239,68,68,0.35)',
                background: 'rgba(239,68,68,0.08)', color: '#ef4444',
                fontWeight: 600, fontSize: '0.72rem', cursor: deletingAll ? 'wait' : 'pointer',
                opacity: sessions.length === 0 ? 0.5 : 1
              }}
            >
              {deletingAll ? 'Deleting...' : 'Delete All Logs'}
            </button>
          </div>
        </div>

        {loadingSessions ? (
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>Loading sessions...</p>
        ) : sessions.length === 0 ? (
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>No sessions in this range yet.</p>
        ) : groupBy === 'day' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {sessions.map(s => (
              <div key={s.id}>
                <button
                  onClick={() => setExpandedDate(expandedDate === s.id ? null : s.id)}
                  style={{
                    width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '0.65rem 0.75rem', borderRadius: '10px',
                    border: `1px solid ${expandedDate === s.id ? 'rgba(249,115,22,0.4)' : 'var(--border)'}`,
                    background: expandedDate === s.id ? 'rgba(249,115,22,0.07)' : 'rgba(9,9,11,0.6)',
                    cursor: 'pointer', textAlign: 'left'
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-main)' }}>
                      {fmtDateFull(s.date)}{s.sessionDayNumber ? ` • Day ${s.sessionDayNumber}` : ''}
                    </p>
                    <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {s.exerciseCount} exercise{s.exerciseCount === 1 ? '' : 's'} · {Math.round(s.totalVolume).toLocaleString()} kg vol.
                    </p>
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{expandedDate === s.id ? '−' : '+'}</span>
                </button>

                {expandedDate === s.id && (
                  <div style={{ marginTop: '0.35rem', padding: '0.65rem 0.75rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--background)' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
                      <button
                        onClick={() => handleDeleteSession(s.id, s.date)}
                        disabled={deletingDate === s.id}
                        style={{
                          padding: '0.3rem 0.65rem', borderRadius: '999px', border: '1px solid rgba(239,68,68,0.35)',
                          background: 'rgba(239,68,68,0.08)', color: '#ef4444',
                          fontWeight: 600, fontSize: '0.7rem', cursor: deletingDate === s.id ? 'wait' : 'pointer'
                        }}
                      >
                        {deletingDate === s.id ? 'Deleting...' : 'Delete this session'}
                      </button>
                    </div>
                    {/* Group logs by exercise */}
                    {(() => {
                      const exMap: Record<string, { name: string; sets: HistoryLog[] }> = {}
                      for (const log of s.logs) {
                        const id = log.exercises?.id || log.exercise_id || 'unknown'
                        const name = log.exercises?.name || 'Exercise'
                        if (!exMap[id]) exMap[id] = { name, sets: [] }
                        exMap[id].sets.push(log)
                      }
                      return Object.values(exMap).map((ex, i) => (
                        <div key={i} style={{ marginBottom: '0.75rem' }}>
                          <p style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: '0.3rem', color: 'var(--text-main)' }}>{ex.name}</p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            {ex.sets.map((log, si) => (
                              <div key={si} style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)', padding: '0.2rem 0' }}>
                                <span style={{ width: '40px' }}>Set {log.sets_completed || si + 1}</span>
                                <span>{log.reps_completed} reps</span>
                                <span>@ {log.weight_used} kg</span>
                                <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>
                                  {(Number(log.reps_completed) * Number(log.weight_used)).toLocaleString()} kg vol
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    })()}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : groupBy === 'week' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {groupByWeek(sessions).map((week, wi) => (
              <div key={wi} style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
                <div style={{ padding: '0.65rem 0.75rem', background: 'rgba(9,9,11,0.8)', display: 'flex', justifyContent: 'space-between' }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem' }}>{week.weekLabel}</p>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>{week.sessions.length} session{week.sessions.length === 1 ? '' : 's'} · {Math.round(week.totalVolume).toLocaleString()} kg</p>
                </div>
                {week.sessions.map(s => (
                  <div key={s.id} style={{ padding: '0.5rem 0.75rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                    <span>{fmtDateFull(s.date)}{s.sessionDayNumber ? ` • Day ${s.sessionDayNumber}` : ''}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{Math.round(s.totalVolume).toLocaleString()} kg</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {groupByMonth(sessions).map((month, mi) => (
              <div key={mi} style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
                <div style={{ padding: '0.65rem 0.75rem', background: 'rgba(9,9,11,0.8)', display: 'flex', justifyContent: 'space-between' }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem' }}>{month.label}</p>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>{month.sessions.length} session{month.sessions.length === 1 ? '' : 's'} · {Math.round(month.totalVolume).toLocaleString()} kg</p>
                </div>
                {month.sessions.map(s => (
                  <div key={s.id} style={{ padding: '0.5rem 0.75rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                    <span>{fmtDateFull(s.date)}{s.sessionDayNumber ? ` • Day ${s.sessionDayNumber}` : ''}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{Math.round(s.totalVolume).toLocaleString()} kg</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
