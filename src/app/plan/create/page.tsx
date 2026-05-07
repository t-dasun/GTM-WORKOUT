'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createWorkoutTemplate, getCurrentSession, getExercises, getUserProfile, getWorkoutTemplateForEdit, updateUserSchedule, updateWorkoutTemplate } from '@/lib/api'

export default function PlanCreator() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const templateId = searchParams.get('templateId')
  const isEditMode = Boolean(templateId)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [session, setSession] = useState<any>(null)
  const [userRole, setUserRole] = useState<'athlete' | 'trainer'>('athlete')
  
  const [name, setName] = useState('')
  const [level, setLevel] = useState('Beginner')
  
  // Array of days, each has an array of exercises
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [days, setDays] = useState<any[]>([{ id: 1, exercises: [] }])
  
  const [scheduleMapping, setScheduleMapping] = useState<Record<string, string>>({
    Monday: 'Day 1',
    Tuesday: 'Rest',
    Wednesday: 'Rest',
    Thursday: 'Rest',
    Friday: 'Rest',
    Saturday: 'Rest',
    Sunday: 'Rest'
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [availableExercises, setAvailableExercises] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingGlobalTemplate, setEditingGlobalTemplate] = useState(false)

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
          setUserRole('trainer')
        }
        
        const ex = await getExercises(sess.user.id)
        setAvailableExercises(ex || [])

        if (templateId) {
          const template = await getWorkoutTemplateForEdit(templateId, sess.user.id)
          setName(template.name)
          setLevel(template.level || 'Beginner')
          setDays(template.days.length > 0 ? template.days : [{ id: 1, exercises: [] }])
          setEditingGlobalTemplate(Boolean(template.isGlobal))
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [router, templateId])

  const addDay = () => {
    setDays([...days, { id: days.length + 1, exercises: [] }])
  }

  const addExercise = (dayIdx: number) => {
    const defaultExercise = availableExercises[0]
    const defaultTrackingType = defaultExercise?.trackingType || 'weight'
    const newDays = [...days]
    newDays[dayIdx].exercises.push({
      exerciseId: defaultExercise?.id || '',
      setsData: [{ setNumber: 1, reps: 10, weight: defaultTrackingType === 'level' ? 1 : 0 }]
    })
    setDays(newDays)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateExercise = (dayIdx: number, exIdx: number, field: string, value: any) => {
    const newDays = [...days]
    newDays[dayIdx].exercises[exIdx][field] = value
    setDays(newDays)
  }

  const removeExercise = (dayIdx: number, exIdx: number) => {
    const newDays = [...days]
    newDays[dayIdx].exercises.splice(exIdx, 1)
    setDays(newDays)
  }

  const addSetToExercise = (dayIdx: number, exIdx: number) => {
    const newDays = [...days]
    const ex = newDays[dayIdx].exercises[exIdx]
    const trackingType = availableExercises.find(a => a.id === ex.exerciseId)?.trackingType || 'weight'
    ex.setsData.push({ setNumber: ex.setsData.length + 1, reps: 10, weight: trackingType === 'level' ? 1 : 0 })
    setDays(newDays)
  }

  const removeSetFromExercise = (dayIdx: number, exIdx: number, setIdx: number) => {
    const newDays = [...days]
    const ex = newDays[dayIdx].exercises[exIdx]
    ex.setsData.splice(setIdx, 1)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ex.setsData.forEach((s: any, idx: number) => s.setNumber = idx + 1)
    setDays(newDays)
  }

  const updateSet = (dayIdx: number, exIdx: number, setIdx: number, field: string, value: number) => {
    const newDays = [...days]
    newDays[dayIdx].exercises[exIdx].setsData[setIdx][field] = value
    setDays(newDays)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name) return alert('Please enter a plan name')
    
    setSaving(true)
    try {
      if (isEditMode && templateId) {
        if (editingGlobalTemplate && userRole === 'trainer') {
          await createWorkoutTemplate(session.user.id, name, level, days)
        } else {
          await updateWorkoutTemplate(session.user.id, templateId, name, level, days)
        }
        router.push('/trainer')
        return
      }

      const template = await createWorkoutTemplate(session.user.id, name, level, days)

      if (userRole === 'trainer') {
        router.push('/trainer')
        return
      }

      await updateUserSchedule(session.user.id, template.id, scheduleMapping)
      router.push('/dashboard')
    } catch (err) {
      console.error(err)
      alert('Failed to save plan')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <main className="container text-center mt-4">Loading...</main>

  const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

  return (
    <main className="container" style={{ marginTop: '2rem', paddingBottom: '4rem' }}>
      <h2>{isEditMode ? 'Edit Workout Plan' : 'Create Workout Plan'}</h2>
      <p className="text-muted mb-4">
        {isEditMode
          ? (editingGlobalTemplate ? 'Customize this shared template and save it to your own trainer library.' : 'Update your template structure and exercises.')
          : 'Build your template and assign it to your schedule.'}
      </p>
      
      <form onSubmit={handleSave}>
        <div className="card">
          <h3>1. Template Details</h3>
          <div className="input-group mt-4">
            <label className="input-label">Plan Name</label>
            <input className="input-field" value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. 3-Day PPL" />
          </div>
          <div className="input-group">
            <label className="input-label">Level</label>
            <select className="input-field" value={level} onChange={e => setLevel(e.target.value)}>
              <option>Beginner</option>
              <option>Intermediate</option>
              <option>Advanced</option>
            </select>
          </div>
        </div>

        <div className="card mt-4">
          <div className="flex justify-between items-center mb-4">
            <h3>2. Workout Days</h3>
            <button type="button" className="btn btn-secondary" onClick={addDay} style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}>+ Add Day</button>
          </div>
          
          {days.map((day, dIdx) => (
            <div key={dIdx} style={{ backgroundColor: 'var(--background)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', border: '1px solid var(--border)' }}>
              <div className="flex justify-between items-center mb-4">
                <h4 style={{ margin: 0 }}>Day {day.id}</h4>
                <button type="button" className="btn btn-primary" onClick={() => addExercise(dIdx)} style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}>+ Add Exercise</button>
              </div>
              
              <div className="flex flex-col gap-4">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {day.exercises.map((ex: any, eIdx: number) => {
                  const selectedExercise = availableExercises.find(a => a.id === ex.exerciseId)
                  const trackingType = selectedExercise?.trackingType || 'weight'
                  const metricLabel = trackingType === 'level' ? 'Level' : 'Weight (kg)'
                  return (
                  <div key={eIdx} className="flex flex-col gap-2" style={{ padding: '0.75rem', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)' }}>
                    <div className="flex justify-between mb-2">
                      <select className="input-field" style={{ flex: 1, padding: '0.5rem', marginBottom: 0 }} value={ex.exerciseId} onChange={e => updateExercise(dIdx, eIdx, 'exerciseId', e.target.value)}>
                        {availableExercises.map(a => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </select>
                      <button type="button" onClick={() => removeExercise(dIdx, eIdx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0 0.5rem' }}>X</button>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2 text-muted" style={{ fontSize: '0.75rem', padding: '0 0.25rem' }}>
                        <span style={{ width: '40px' }}>Set</span>
                        <span style={{ flex: 1 }}>Reps</span>
                        <span style={{ flex: 1 }}>{metricLabel}</span>
                        <span style={{ width: '30px' }}></span>
                      </div>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {ex.setsData.map((s: any, sIdx: number) => (
                        <div key={sIdx} className="flex gap-2 items-center">
                          <span style={{ width: '40px', fontWeight: 500, textAlign: 'center' }}>{s.setNumber}</span>
                          <input type="number" className="input-field" style={{ flex: 1, padding: '0.5rem', marginBottom: 0 }} value={s.reps} onChange={e => updateSet(dIdx, eIdx, sIdx, 'reps', Number(e.target.value))} />
                          <input type="number" step={trackingType === 'level' ? 1 : 0.5} min={trackingType === 'level' ? 1 : 0} className="input-field" style={{ flex: 1, padding: '0.5rem', marginBottom: 0 }} value={s.weight} onChange={e => updateSet(dIdx, eIdx, sIdx, 'weight', Number(e.target.value))} />
                          <button type="button" onClick={() => removeSetFromExercise(dIdx, eIdx, sIdx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', width: '30px' }}>×</button>
                        </div>
                      ))}
                    </div>
                    <button type="button" onClick={() => addSetToExercise(dIdx, eIdx)} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', alignSelf: 'flex-start', marginTop: '0.5rem' }}>+ Add Set</button>
                  </div>
                  )
                })}
                {day.exercises.length === 0 && <p className="text-muted text-center" style={{ fontSize: '0.75rem' }}>No exercises added to this day.</p>}
              </div>
            </div>
          ))}
        </div>

        {!isEditMode && userRole !== 'trainer' && (
          <div className="card mt-4">
            <h3>3. Weekly Schedule</h3>
            <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>Map your days of the week to the workout days above.</p>
            <div className="flex flex-col gap-2">
              {weekDays.map(wd => (
                <div key={wd} className="flex justify-between items-center" style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontWeight: 500 }}>{wd}</span>
                  <select className="input-field" style={{ padding: '0.5rem', width: '150px', marginBottom: 0 }} value={scheduleMapping[wd]} onChange={e => setScheduleMapping({...scheduleMapping, [wd]: e.target.value})}>
                    <option value="Rest">Rest</option>
                    {days.map(d => (
                      <option key={d.id} value={`Day ${d.id}`}>Day {d.id}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        <button type="submit" className="btn btn-primary w-full mt-4" disabled={saving}>
          {saving ? 'Saving...' : (isEditMode ? (editingGlobalTemplate ? 'Save As My Template' : 'Save Changes') : (userRole === 'trainer' ? 'Save Template' : 'Save & Apply to Dashboard'))}
        </button>
      </form>
    </main>
  )
}
