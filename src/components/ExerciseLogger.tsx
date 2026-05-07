'use client'

import { useState } from 'react'
import { logExercise } from '@/lib/api'

interface Exercise {
  id: string
  name: string
  trackingType?: 'weight' | 'level'
  setsData: { setNumber: number, reps: number, weight: number }[]
  lastSession?: { reps: number | null, weight: number | null } | null
  muscleGroups?: { id: string, name: string }[]
}

export default function ExerciseLogger({
  exercise,
  userId,
  onLogged,
  onSetsDataChange,
  autoSelectAll,
  forceLogged,
  logKey,
  sessionId,
  sessionDayNumber,
}: {
  exercise: Exercise
  userId: string
  onLogged?: (exerciseId: string, completedCount: number) => void
  onSetsDataChange?: (exerciseId: string, setsData: { setNumber: number, reps: number, weight: number }[]) => void
  autoSelectAll?: boolean
  forceLogged?: boolean
  logKey?: string
  sessionId?: string
  sessionDayNumber?: number
}) {
  const [setsData, setSetsData] = useState(exercise.setsData.map(s => ({ ...s })))
  const [completedSets, setCompletedSets] = useState<boolean[]>(exercise.setsData.map(() => false))
  const [isLogged, setIsLogged] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  const effectiveLogged = isLogged || !!forceLogged
  const effectiveDone = effectiveLogged ? setsData.length : (autoSelectAll ? setsData.length : completedSets.filter(Boolean).length)
  const doneCount = effectiveDone
  const total = setsData.length
  const metricLabel = exercise.trackingType === 'level' ? 'Level' : 'Weight (kg)'
  const metricFormatter = (v: number | null | undefined) => exercise.trackingType === 'level' ? `L${v ?? '-'}` : `${v ?? '-'} kg`

  const toggleSet = (idx: number) => {
    if (isLogged) return
    setCompletedSets(prev => prev.map((v, i) => i === idx ? !v : v))
  }

  const completeAll = () => {
    setCompletedSets(setsData.map(() => true))
  }

  const handleLog = async () => {
    const toLog = autoSelectAll ? setsData : setsData.filter((_, i) => completedSets[i])
    if (toLog.length === 0) {
      alert('Mark at least one set as done before logging.')
      return
    }
    setLoading(true)
    try {
      await logExercise(userId, exercise.id, toLog, {
        sessionId: sessionId || null,
        sessionDayNumber: sessionDayNumber || null,
      })
      setIsLogged(true)
      onLogged?.(logKey || exercise.id, toLog.length)
    } catch (err) {
      console.error('Failed to log exercise', err)
      alert('Failed to log exercise')
    } finally {
      setLoading(false)
    }
  }

  const updateSet = (idx: number, field: string, value: number) => {
    const newData = [...setsData]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(newData[idx] as any)[field] = value
    setSetsData(newData)
    onSetsDataChange?.(logKey || exercise.id, newData)
  }

  return (
    <div className="card" style={{
      display: 'flex', flexDirection: 'column', gap: '0.9rem',
      borderColor: effectiveLogged ? 'rgba(249, 115, 22, 0.85)' : doneCount > 0 ? 'rgba(249, 115, 22, 0.4)' : 'rgba(63, 63, 70, 0.95)',
      background: 'linear-gradient(180deg, rgba(24,24,27,0.98), rgba(18,18,20,0.98))'
    }}>
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        style={{ background: 'none', border: 'none', color: 'inherit', textAlign: 'left', padding: 0, cursor: 'pointer' }}
      >
        <div className="flex justify-between items-center" style={{ gap: '0.75rem' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
              <h4 style={{ marginBottom: 0 }}>{exercise.name}</h4>
              {exercise.muscleGroups && exercise.muscleGroups.map(mg => (
                <span key={mg.id} style={{ fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.06em', background: 'var(--surface-hover)', padding: '0.1rem 0.4rem', borderRadius: '999px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {mg.name.toUpperCase()}
                </span>
              ))}
            </div>
            <p style={{ fontSize: '0.78rem', margin: 0 }}>
              Plan: {setsData.length} × {setsData[0]?.reps ?? '-'} @ {metricFormatter(setsData[0]?.weight)}
            </p>
            {exercise.lastSession && (
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
                Prev best: {exercise.lastSession.reps ?? '-'} reps @ {metricFormatter(exercise.lastSession.weight)}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem', flexShrink: 0 }}>
            <span style={{
              fontSize: '0.78rem', fontWeight: 700,
              color: effectiveLogged ? 'var(--primary)' : doneCount > 0 ? 'rgba(249,115,22,0.8)' : 'var(--text-main)'
            }}>
              {effectiveLogged ? `✓ ${total}/${total}` : `${doneCount}/${total}`}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{isOpen ? '−' : '+'}</span>
          </div>
        </div>
      </button>

      {isOpen && (
        <div className="flex flex-col gap-2" style={{ marginTop: '0.25rem' }}>
          {/* Complete All shortcut */}
          {!effectiveLogged && doneCount < total && (
            <button
              type="button"
              onClick={completeAll}
              style={{
                background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.3)',
                borderRadius: '8px', padding: '0.45rem 0.75rem', fontSize: '0.75rem',
                color: 'var(--primary)', cursor: 'pointer', fontWeight: 600, textAlign: 'left'
              }}
            >
              ✓ Mark all {total} sets as done
            </button>
          )}

          {setsData.map((s, idx) => {
            const done = autoSelectAll || completedSets[idx]
            return (
              <div key={idx} style={{
                display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.8rem',
                borderRadius: '14px', border: `1px solid ${done ? 'rgba(249,115,22,0.5)' : 'var(--border)'}`,
                background: done ? 'rgba(249,115,22,0.07)' : 'rgba(9, 9, 11, 0.72)',
                opacity: effectiveLogged && !done ? 0.5 : 1
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '44px minmax(0,1fr) minmax(0,1fr) 44px', gap: '0.6rem', alignItems: 'center', width: '100%' }}>
                  <span style={{
                    width: '36px', height: '36px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: '12px', background: done ? 'rgba(249,115,22,0.25)' : 'var(--surface-hover)',
                    fontWeight: 700, color: done ? 'var(--primary)' : 'inherit'
                  }}>{s.setNumber}</span>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: 0 }}>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Reps</span>
                    <input
                      type="number"
                      className="input-field"
                      style={{ padding: '0.55rem', marginBottom: 0, fontWeight: 700, width: '100%', minWidth: 0 }}
                      value={s.reps}
                      onChange={(e) => updateSet(idx, 'reps', Number(e.target.value))}
                      disabled={effectiveLogged || loading}
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: 0 }}>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{metricLabel}</span>
                    <input
                      type="number"
                      className="input-field"
                      style={{ padding: '0.55rem', marginBottom: 0, fontWeight: 700, width: '100%', minWidth: 0 }}
                      value={s.weight}
                      onChange={(e) => updateSet(idx, 'weight', Number(e.target.value))}
                      disabled={effectiveLogged || loading}
                    />
                  </label>
                  {/* Per-set complete toggle */}
                  <button
                    type="button"
                    onClick={() => toggleSet(idx)}
                    disabled={effectiveLogged || loading || !!autoSelectAll}
                    title={done ? 'Undo' : 'Mark set done'}
                    style={{
                      width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: '12px', border: `1px solid ${done ? 'rgba(249,115,22,0.6)' : 'var(--border)'}`,
                      background: done ? 'rgba(249,115,22,0.2)' : 'var(--surface-hover)',
                      cursor: (effectiveLogged || autoSelectAll) ? 'default' : 'pointer', fontSize: '1rem',
                      color: done ? 'var(--primary)' : 'var(--text-muted)', flexShrink: 0
                    }}
                  >
                    {done ? '✓' : '○'}
                  </button>
                </div>
              </div>
            )
          })}

          {setsData.length === 0 && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No sets defined.</span>}

          {/* Log button */}
          {!effectiveLogged ? (
            <button
              className="btn btn-primary"
              onClick={handleLog}
              disabled={loading || doneCount === 0}
              style={{ padding: '0.75rem 0.95rem', width: '100%', marginTop: '0.25rem', opacity: doneCount === 0 ? 0.45 : 1 }}
            >
              {loading ? 'Logging...' : doneCount === total ? 'Complete' : `Log ${doneCount} of ${total} sets`}
            </button>
          ) : (
            <div style={{ padding: '0.65rem', borderRadius: '10px', background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.35)', textAlign: 'center', fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600 }}>
              ✓ Logged {doneCount}/{total} sets
            </div>
          )}
        </div>
      )}
    </div>
  )
}
