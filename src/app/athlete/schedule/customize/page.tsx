'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getCurrentSession, getUserProfile, getUserSchedule, getExercises, addCustomExerciseToSchedule, deleteCustomization, saveScheduleDayCustomizations } from '@/lib/api'

interface Customization {
  id: string
  day_sequence_number: number
  exercise_id: string
  is_added: boolean
  custom_tracking_type: 'weight' | 'level' | null
  initial_weight: number | null
  order_in_day: number
  exercises: {
    id: string
    name: string
    tracking_type: 'weight' | 'level'
  }
}

interface ScheduleData {
  id: string
  template_id: string
  customizations?: Customization[]
  workout_templates: {
    name: string
    level?: string
    template_days: Array<{
      id: string
      day_sequence_number: number
      template_exercises: Array<{
        id: string
        exercise_id: string
        sets_data: Array<{ setNumber: number, reps: number, weight: number }>
        order_in_day: number
        exercises: {
          id: string
          name: string
          tracking_type: 'weight' | 'level'
        }
      }>
    }>
  }
}

interface DayExerciseRow {
  key: string
  dayNumber: number
  exerciseId: string
  exerciseName: string
  orderInDay: number
  isAdded: boolean
  customizationId?: string
  trackingType: 'weight' | 'level'
  initialWeight: number | null
}

interface Exercise {
  id: string
  name: string
  tracking_type: 'weight' | 'level'
  trackingType?: 'weight' | 'level'
  isGlobal?: boolean
  createdByUserId?: string
}

export default function CustomizeSchedulePage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string>('')
  const [schedule, setSchedule] = useState<ScheduleData | null>(null)
  const [customizations, setCustomizations] = useState<Record<number, Customization[]>>({})
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedDay, setSelectedDay] = useState<number>(1)
  const [addingExerciseDay, setAddingExerciseDay] = useState<number | null>(null)
  const [newExerciseId, setNewExerciseId] = useState('')
  const [newExerciseTrackingType, setNewExerciseTrackingType] = useState<'weight' | 'level'>('weight')
  const [newExerciseInitialWeight, setNewExerciseInitialWeight] = useState<number | string>('')
  const [dayDraftRowsByDay, setDayDraftRowsByDay] = useState<Record<number, DayExerciseRow[]>>({})
  const [dirtyDays, setDirtyDays] = useState<Record<number, boolean>>({})

  const getErrorMessage = (err: unknown) => {
    if (err instanceof Error) return err.message
    try {
      return JSON.stringify(err)
    } catch {
      return String(err)
    }
  }

  const isCustomizationTableMissingError = (message: string) => {
    const lower = message.toLowerCase()
    return lower.includes('user_schedule_customizations') && (
      lower.includes('does not exist') ||
      lower.includes('could not find') ||
      lower.includes('relation')
    )
  }

  const refreshCustomizations = async (uid: string) => {
    const refreshed = await getUserSchedule(uid)
    if (!refreshed?.customizations) {
      setCustomizations({})
      return
    }

    const byDay: Record<number, Customization[]> = {}
    refreshed.customizations.forEach((custom: Customization) => {
      if (!byDay[custom.day_sequence_number]) byDay[custom.day_sequence_number] = []
      byDay[custom.day_sequence_number].push(custom)
    })
    setCustomizations(byDay)
  }

  useEffect(() => {
    async function loadData() {
      try {
        const sess = await getCurrentSession()
        if (!sess) {
          router.push('/auth')
          return
        }
        setUserId(sess.user.id)

        const profile = await getUserProfile(sess.user.id)
        if (profile.data?.role === 'trainer') {
          router.push('/trainer')
          return
        }

        const [sched, exList] = await Promise.all([
          getUserSchedule(sess.user.id).catch(() => null),
          getExercises(sess.user.id)
        ])

        if (!sched) {
          router.push('/athlete/schedule')
          return
        }

        setSchedule(sched)
        setExercises((exList || []).map(ex => ({
          ...ex,
          tracking_type: ex.trackingType || 'weight'
        })))

        // Organize customizations by day
        const byDay: Record<number, Customization[]> = {}
        if (sched.customizations) {
          sched.customizations.forEach((custom: Customization) => {
            if (!byDay[custom.day_sequence_number]) {
              byDay[custom.day_sequence_number] = []
            }
            byDay[custom.day_sequence_number].push(custom)
          })
        }
        setCustomizations(byDay)
      } catch (err) {
        console.error(err)
        alert('Failed to load schedule')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [router])

  const handleAddExercise = async () => {
    if (!schedule || !newExerciseId || addingExerciseDay === null) {
      alert('Please select an exercise')
      return
    }

    setSaving(true)
    try {
      const sess = await getCurrentSession()
      if (!sess) return

      const initialWeight = newExerciseInitialWeight ? parseFloat(newExerciseInitialWeight as string) : undefined

      const result = await addCustomExerciseToSchedule(
        sess.user.id,
        schedule.id,
        addingExerciseDay,
        newExerciseId,
        newExerciseTrackingType,
        initialWeight
      )

      if (result) {
        // Update customizations immutably
        const updatedCustomizations = { ...customizations }
        if (!updatedCustomizations[addingExerciseDay]) {
          updatedCustomizations[addingExerciseDay] = []
        }

        const exercise = exercises.find(e => e.id === newExerciseId)
        if (exercise) {
          updatedCustomizations[addingExerciseDay].push({
            ...result,
            exercises: exercise
          })
          setCustomizations(updatedCustomizations)
        }
      }

      // Reset form
      setNewExerciseId('')
      setNewExerciseInitialWeight('')
      setNewExerciseTrackingType('weight')
      setAddingExerciseDay(null)
      setDayDraftRowsByDay(prev => {
        const next = { ...prev }
        delete next[addingExerciseDay]
        return next
      })
      setDirtyDays(prev => ({ ...prev, [addingExerciseDay]: false }))
    } catch (err) {
      console.error(err)
      alert('Failed to add exercise')
    } finally {
      setSaving(false)
    }
  }

  const setRowsForDay = (day: number, rows: DayExerciseRow[]) => {
    const normalized = rows.map((row, idx) => ({ ...row, dayNumber: day, orderInDay: idx + 1 }))
    setDayDraftRowsByDay(prev => ({ ...prev, [day]: normalized }))
    setDirtyDays(prev => ({ ...prev, [day]: true }))
  }

  const updateDraftTrackingType = (rowKey: string, newType: 'weight' | 'level') => {
    const currentRows = dayDraftRowsByDay[selectedDay] || dayRows
    const nextRows = currentRows.map(row => row.key === rowKey ? { ...row, trackingType: newType } : row)
    setRowsForDay(selectedDay, nextRows)
  }

  const updateDraftInitialWeight = (rowKey: string, rawValue: string) => {
    const currentRows = dayDraftRowsByDay[selectedDay] || dayRows
    const nextRows = currentRows.map(row => {
      if (row.key !== rowKey) return row
      if (rawValue === '') return { ...row, initialWeight: null }
      const parsed = Number(rawValue)
      if (Number.isNaN(parsed)) return row
      return { ...row, initialWeight: parsed }
    })
    setRowsForDay(selectedDay, nextRows)
  }

  const moveDraftRow = (index: number, direction: -1 | 1) => {
    const currentRows = [...(dayDraftRowsByDay[selectedDay] || dayRows)]
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= currentRows.length) return
    const [item] = currentRows.splice(index, 1)
    currentRows.splice(targetIndex, 0, item)
    setRowsForDay(selectedDay, currentRows)
  }

  const handleSaveDayChanges = async () => {
    if (!schedule) return

    setSaving(true)
    try {
      let activeUserId = userId
      if (!activeUserId) {
        const sess = await getCurrentSession()
        activeUserId = sess?.user?.id || ''
      }
      if (!activeUserId) throw new Error('User session not found')

      const rowsToSave = dayDraftRowsByDay[selectedDay] || dayRows

      await saveScheduleDayCustomizations(
        activeUserId,
        schedule.id,
        selectedDay,
        rowsToSave.map((row, index) => ({
          exerciseId: row.exerciseId,
          isAdded: row.isAdded,
          trackingType: row.trackingType,
          initialWeight: row.initialWeight,
          orderInDay: index + 1
        }))
      )

      await refreshCustomizations(activeUserId)
      setDayDraftRowsByDay(prev => {
        const next = { ...prev }
        delete next[selectedDay]
        return next
      })
      setDirtyDays(prev => ({ ...prev, [selectedDay]: false }))

      alert(`Day ${selectedDay} changes saved successfully!`)
    } catch (err) {
      console.error(err)
      const message = getErrorMessage(err)
      if (isCustomizationTableMissingError(message)) {
        alert('Customization table is not created yet. Please run DB migration for user_schedule_customizations first.')
      } else {
        alert('Failed to save day changes')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteCustomization = async (customizationId: string) => {
    if (!confirm('Remove this exercise from your schedule?')) return

    setSaving(true)
    try {
      await deleteCustomization(customizationId)

      // Update local state immutably
      const updatedCustomizations: Record<number, Customization[]> = {}
      Object.keys(customizations).forEach(dayStr => {
        const day = parseInt(dayStr)
        updatedCustomizations[day] = customizations[day].filter(custom => custom.id !== customizationId)
      })
      setCustomizations(updatedCustomizations)
      alert('Exercise removed!')
    } catch (err) {
      console.error(err)
      alert('Failed to remove exercise')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <main className="container page-shell customize-page text-center mt-4">Loading schedule...</main>

  const totalTemplateDays = schedule?.workout_templates?.template_days?.length || 0
  const dayNumbers = Array.from({ length: totalTemplateDays }, (_, i) => i + 1)

  const selectedTemplateDay = schedule?.workout_templates?.template_days?.find(d => d.day_sequence_number === selectedDay)
  const dayCustomizations = customizations[selectedDay] || []

  const overridesByExerciseId = new Map(
    dayCustomizations
      .filter(c => !c.is_added)
      .map(c => [c.exercise_id, c])
  )

  const baseRows: DayExerciseRow[] = (selectedTemplateDay?.template_exercises || [])
    .slice()
    .sort((a, b) => a.order_in_day - b.order_in_day)
    .map(te => {
      const override = overridesByExerciseId.get(te.exercise_id)
      return {
        key: `base-${te.id}`,
        dayNumber: selectedDay,
        exerciseId: te.exercise_id,
        exerciseName: te.exercises?.name || 'Exercise',
        orderInDay: te.order_in_day,
        isAdded: false,
        customizationId: override?.id,
        trackingType: (override?.custom_tracking_type || te.exercises?.tracking_type || 'weight') as 'weight' | 'level',
        initialWeight: override?.initial_weight ?? (te.sets_data?.[0]?.weight ?? null)
      }
    })

  const addedRows: DayExerciseRow[] = dayCustomizations
    .filter(c => c.is_added)
    .slice()
    .sort((a, b) => a.order_in_day - b.order_in_day)
    .map(c => ({
      key: `custom-${c.id}`,
      dayNumber: selectedDay,
      exerciseId: c.exercise_id,
      exerciseName: c.exercises?.name || 'Exercise',
      orderInDay: c.order_in_day,
      isAdded: true,
      customizationId: c.id,
      trackingType: (c.custom_tracking_type || c.exercises?.tracking_type || 'weight') as 'weight' | 'level',
      initialWeight: c.initial_weight ?? null
    }))

  const persistedDayRows = [...baseRows, ...addedRows].sort((a, b) => a.orderInDay - b.orderInDay)
  const dayRows = dayDraftRowsByDay[selectedDay] || persistedDayRows

  const metricLabel = (trackingType: 'weight' | 'level') =>
    trackingType === 'level' ? 'Level' : 'Weight (kg)'

  return (
    <main className="container customize-page page-shell" style={{ marginBottom: '2rem' }}>
      <Link href="/athlete/schedule" style={{ textDecoration: 'none', color: 'var(--primary)' }} className="mb-4 inline-block">
        ← Back to Schedule
      </Link>

      <div className="page-header">
        <span className="page-eyebrow">Schedule customization</span>
        <h1 className="page-title">{schedule?.workout_templates.name}</h1>
        <p className="page-subtitle">
          Customize your personal schedule. Any changes here only affect you, not your trainer&apos;s template or other athletes&apos; schedules.
        </p>
      </div>

      {/* Day Selector */}
      <div className="card mb-4" style={{ backgroundColor: 'var(--surface-hover)' }}>
        <h3 style={{ marginBottom: '1rem' }}>Select Day</h3>
        <div className="chip-scroll customize-day-strip" style={{ display: 'flex' }}>
          {dayNumbers.map(day => (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className="btn"
              style={{
                backgroundColor: selectedDay === day ? 'var(--primary)' : 'var(--surface)',
                color: selectedDay === day ? 'white' : 'var(--text)',
                border: '1px solid var(--border)',
                padding: '0.5rem'
              }}
            >
              Day {day}
            </button>
          ))}
        </div>
      </div>

      {/* Customizations for selected day */}
      <div className="card mb-4">
        <div className="customize-day-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', gap: '0.5rem', flexWrap: 'wrap' }}>
          <h3 style={{ marginBottom: 0 }}>Day {selectedDay} Customizations</h3>
          <button
            className="btn btn-primary"
            onClick={handleSaveDayChanges}
            disabled={saving || !dirtyDays[selectedDay]}
            style={{ padding: '0.5rem 1rem' }}
          >
            {saving ? 'Saving...' : 'Done'}
          </button>
        </div>
        <p className="text-muted" style={{ fontSize: '0.75rem', marginBottom: '1rem' }}>
          Change values and order, then click Done once to save all updates for this day.
        </p>

        {dayRows.length === 0 ? (
          <p className="text-muted">No exercises found for this day.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {dayRows.map((row, index) => (
              <div
                key={row.key}
                style={{
                  padding: '1rem',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  backgroundColor: row.isAdded ? 'var(--surface-hover)' : 'transparent'
                }}
              >
                <div className="customize-row-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <div>
                    <h4 style={{ margin: 0 }}>{row.exerciseName}</h4>
                    {row.isAdded && (
                      <p style={{ fontSize: '0.75rem', color: '#f59e0b', margin: '0.25rem 0 0 0' }}>Added by you</p>
                    )}
                  </div>
                  <div className="customize-row-actions" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      className="btn"
                      onClick={() => moveDraftRow(index, -1)}
                      disabled={saving || index === 0}
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                      title="Move up"
                    >
                      ↑
                    </button>
                    <button
                      className="btn"
                      onClick={() => moveDraftRow(index, 1)}
                      disabled={saving || index === dayRows.length - 1}
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                      title="Move down"
                    >
                      ↓
                    </button>
                    {row.isAdded && row.customizationId && (
                      <button
                        className="btn btn-danger"
                        onClick={() => handleDeleteCustomization(row.customizationId as string)}
                        disabled={saving}
                        style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>

                <div className="customize-fields-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                  {/* Tracking Type */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 500 }}>
                      Tracking Type
                    </label>
                    <select
                      className="input-field"
                      value={row.trackingType}
                      onChange={e => updateDraftTrackingType(row.key, (e.target.value as 'weight' | 'level'))}
                      disabled={saving}
                    >
                      <option value="weight">Weight (kg)</option>
                      <option value="level">Level</option>
                    </select>
                  </div>

                  {/* Initial Weight */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 500 }}>
                      Initial {metricLabel(row.trackingType)}
                    </label>
                    <input
                      type="number"
                      className="input-field"
                      placeholder="Optional"
                      value={row.initialWeight ?? ''}
                      onChange={e => {
                        updateDraftInitialWeight(row.key, e.target.value)
                      }}
                      disabled={saving}
                      step={row.trackingType === 'level' ? '1' : '0.5'}
                      min={row.trackingType === 'level' ? '1' : '0'}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Exercise */}
      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>Add Exercise to Day {addingExerciseDay || selectedDay}</h3>

        <div className="customize-add-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 500 }}>
              Exercise
            </label>
            <select
              className="input-field"
              value={newExerciseId}
              onChange={e => setNewExerciseId(e.target.value)}
              disabled={saving}
            >
              <option value="">Select exercise...</option>
              {exercises.map(ex => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 500 }}>
              Tracking Type
            </label>
            <select
              className="input-field"
              value={newExerciseTrackingType}
              onChange={e => setNewExerciseTrackingType(e.target.value as 'weight' | 'level')}
              disabled={saving}
            >
              <option value="weight">Weight (kg)</option>
              <option value="level">Level</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 500 }}>
              Initial {metricLabel(newExerciseTrackingType)}
            </label>
            <input
              type="number"
              className="input-field"
              placeholder="Optional"
              value={newExerciseInitialWeight}
              onChange={e => setNewExerciseInitialWeight(e.target.value)}
              disabled={saving}
              step={newExerciseTrackingType === 'level' ? '1' : '0.5'}
              min={newExerciseTrackingType === 'level' ? '1' : '0'}
            />
          </div>
        </div>

        <button
          className="btn btn-primary"
          onClick={handleAddExercise}
          disabled={saving || !newExerciseId}
          style={{ marginBottom: '1rem', width: '100%' }}
        >
          {saving ? 'Adding...' : 'Add Exercise'}
        </button>

        <div className="chip-scroll customize-day-strip" style={{ display: 'flex' }}>
          {dayNumbers.map(day => (
            <button
              key={day}
              onClick={() => setAddingExerciseDay(day)}
              className="btn"
              style={{
                backgroundColor: addingExerciseDay === day ? 'var(--primary)' : 'var(--surface)',
                color: addingExerciseDay === day ? 'white' : 'var(--text)',
                border: '1px solid var(--border)',
                padding: '0.5rem',
                fontSize: '0.75rem'
              }}
            >
              Day {day}
            </button>
          ))}
        </div>
        <p className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>
          Select which day to add the exercise to
        </p>
      </div>
    </main>
  )
}
