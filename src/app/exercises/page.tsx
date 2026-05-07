'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  createCustomExercise,
  createMuscleGroup,
  getCurrentSession,
  getExercises,
  getMuscleGroups,
  getUserProfile,
  updateExercise,
} from '@/lib/api'

type Exercise = { id: string; name: string; trackingType: 'weight' | 'level'; isGlobal: boolean; createdByUserId: string | null; muscleGroups: { id: string; name: string }[] }
type MuscleGroup = { id: string; name: string }

export default function ExercisesPage() {
  const router = useRouter()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [session, setSession] = useState<any>(null)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [muscleGroups, setMuscleGroups] = useState<MuscleGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterMuscle, setFilterMuscle] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<'athlete' | 'trainer'>('athlete')
  const [globalEditUnlocked, setGlobalEditUnlocked] = useState(false)
  const [passModal, setPassModal] = useState(false)
  const [trainerPass, setTrainerPass] = useState('')
  const [passError, setPassError] = useState('')

  // Exercise modal (create or edit)
  const [modal, setModal] = useState<null | 'create' | Exercise>(null)
  const [exName, setExName] = useState('')
  const [exTrackingType, setExTrackingType] = useState<'weight' | 'level'>('weight')
  const [selectedMGs, setSelectedMGs] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Muscle group modal
  const [mgModal, setMgModal] = useState(false)
  const [newMgName, setNewMgName] = useState('')
  const [savingMg, setSavingMg] = useState(false)
  const [mgError, setMgError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const sess = await getCurrentSession()
        if (!sess) { router.push('/auth'); return }
        setSession(sess)
        const profile = await getUserProfile(sess.user.id)
        if (profile.data?.role === 'trainer') {
          setUserRole('trainer')
        }
        const [exData, mgData] = await Promise.all([getExercises(sess.user.id), getMuscleGroups()])
        setExercises(exData || [])
        setMuscleGroups(mgData || [])
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router])

  const reload = async () => {
    if (!session) return
    const [exData, mgData] = await Promise.all([getExercises(session.user.id), getMuscleGroups()])
    setExercises(exData || [])
    setMuscleGroups(mgData || [])
  }

  const filtered = exercises.filter(ex => {
    const matchSearch = !search || ex.name.toLowerCase().includes(search.toLowerCase())
    const matchMuscle = !filterMuscle || ex.muscleGroups.some(mg => mg.id === filterMuscle)
    return matchSearch && matchMuscle
  })

  const openCreate = () => {
    setModal('create')
    setExName('')
    setExTrackingType('weight')
    setSelectedMGs([])
    setSaveError('')
  }

  const openEdit = (ex: Exercise) => {
    setModal(ex)
    setExName(ex.name)
    setExTrackingType(ex.trackingType || 'weight')
    setSelectedMGs(ex.muscleGroups.map(mg => mg.id))
    setSaveError('')
  }

  const closeModal = () => { setModal(null); setSaveError('') }

  const toggleMG = (id: string) =>
    setSelectedMGs(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const handleSaveExercise = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!exName.trim()) return
    setSaving(true)
    setSaveError('')
    try {
      if (modal === 'create') {
        await createCustomExercise(session.user.id, exName, selectedMGs, exTrackingType)
      } else if (modal !== null && typeof modal !== 'string') {
        await updateExercise(session.user.id, modal.id, exName, selectedMGs, exTrackingType, { allowGlobalEdit: globalEditUnlocked })
      }
      await reload()
      closeModal()
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save exercise')
    } finally {
      setSaving(false)
    }
  }

  const handleAddMuscleGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMgName.trim()) return
    setSavingMg(true)
    setMgError('')
    try {
      await createMuscleGroup(newMgName)
      await reload()
      setNewMgName('')
      setMgModal(false)
    } catch (err: unknown) {
      setMgError(err instanceof Error ? err.message : 'Failed to add muscle group')
    } finally {
      setSavingMg(false)
    }
  }

  const isEditing = modal && modal !== 'create'
  const canEdit = isEditing
    ? (((modal as Exercise).isGlobal && globalEditUnlocked && userRole === 'trainer') || (!(modal as Exercise).isGlobal && (modal as Exercise).createdByUserId === session?.user?.id))
    : true

  const handleUnlockGlobalEdit = () => {
    const expectedPass = process.env.NEXT_PUBLIC_TRAINER_EDIT_PASS || 'FORGE-TRAINER-PASS'
    if (trainerPass.trim() !== expectedPass) {
      setPassError('Invalid trainer pass.')
      return
    }

    setGlobalEditUnlocked(true)
    setPassModal(false)
    setPassError('')
    setTrainerPass('')
  }

  if (loading) return <main className="container" style={{ marginTop: '4rem', textAlign: 'center' }}>Loading exercises...</main>

  return (
    <main className="container" style={{ marginTop: '1.5rem', paddingBottom: '5rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '1rem' }}>
        <p style={{ fontSize: '0.7rem', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>DICTIONARY</p>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.25rem' }}>Exercises</h1>
        <p style={{ fontSize: '0.875rem' }}>Global, vetted list — add a custom variation if it&apos;s missing.</p>
      </div>

      {/* Search + actions */}
      <div className="flex gap-2" style={{ marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
          <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>🔍</span>
          <input
            className="input-field"
            style={{ paddingLeft: '2.2rem', marginBottom: 0, width: '100%' }}
            placeholder="Search exercises..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button className="btn btn-secondary" onClick={() => { setMgModal(true); setMgError(''); setNewMgName('') }} style={{ whiteSpace: 'nowrap' }}>
          + Muscle Group
        </button>
        <button className="btn btn-primary" onClick={openCreate} style={{ whiteSpace: 'nowrap' }}>
          + Custom Exercise
        </button>
        {userRole === 'trainer' && !globalEditUnlocked && (
          <button className="btn btn-secondary" onClick={() => { setPassModal(true); setPassError('') }} style={{ whiteSpace: 'nowrap' }}>
            Unlock Global Edit
          </button>
        )}
        {userRole === 'trainer' && globalEditUnlocked && (
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.55rem 0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(249,115,22,0.35)', color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 600 }}>
            Global edit unlocked
          </span>
        )}
      </div>

      {/* Muscle group filter chips */}
      <div className="hide-scrollbar" style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.5rem', marginBottom: '1.25rem', WebkitOverflowScrolling: 'touch' }}>
        <Chip label="All" active={filterMuscle === null} onClick={() => setFilterMuscle(null)} />
        {muscleGroups.map(mg => (
          <Chip key={mg.id} label={mg.name} active={filterMuscle === mg.id} onClick={() => setFilterMuscle(filterMuscle === mg.id ? null : mg.id)} />
        ))}
      </div>

      {/* Exercise grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem' }}>
        {filtered.map(ex => (
          <div key={ex.id} className="card" style={{ marginBottom: 0, padding: '1rem', cursor: 'pointer' }} onClick={() => openEdit(ex)}>
            <div className="flex justify-between items-start" style={{ marginBottom: '0.4rem' }}>
              <h4 style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: 0 }}>{ex.name}</h4>
              <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', flexShrink: 0, marginLeft: '0.5rem' }}>
                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', border: '1px solid var(--border)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                  {ex.trackingType === 'level' ? 'LEVEL' : 'WEIGHT'}
                </span>
                {!ex.isGlobal && (
                  <span style={{ fontSize: '0.6rem', color: '#a78bfa', border: '1px solid #a78bfa', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>Custom</span>
                )}
                {!ex.isGlobal && ex.createdByUserId === session?.user?.id && (
                  <span style={{ fontSize: '0.65rem', color: 'var(--primary)' }}>Edit</span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
              {ex.muscleGroups.map(mg => (
                <span key={mg.id} style={{ fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.06em', background: 'var(--surface-hover)', padding: '0.15rem 0.45rem', borderRadius: '4px', color: 'var(--text-muted)' }}>
                  {mg.name.toUpperCase()}
                </span>
              ))}
              {ex.muscleGroups.length === 0 && (
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>No muscle group tagged</span>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem', borderStyle: 'dashed' }}>
            <p>No exercises match your search.</p>
          </div>
        )}
      </div>

      {/* Exercise create/edit modal */}
      {modal !== null && (
        <BottomSheet onClose={closeModal} title={isEditing ? 'Edit Exercise' : 'Create Custom Exercise'}>
          {isEditing && (modal as Exercise).isGlobal && (
            <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'rgba(249,115,22,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(249,115,22,0.25)' }}>
              <p style={{ color: 'var(--primary)', fontSize: '0.8rem', margin: 0 }}>
                {globalEditUnlocked && userRole === 'trainer'
                  ? 'Trainer pass verified. You can edit this global exercise.'
                  : 'This is a global exercise. You can view its details but cannot edit it unless you unlock trainer global edit.'}
              </p>
            </div>
          )}
          <form onSubmit={handleSaveExercise} className="flex flex-col gap-4">
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Exercise Name</label>
              <input
                className="input-field"
                value={exName}
                onChange={e => setExName(e.target.value)}
                placeholder="e.g. Reverse Incline Bicep Curl"
                required
                disabled={!canEdit}
              />
            </div>

            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Tracking Type</label>
              <select className="input-field" value={exTrackingType} onChange={e => setExTrackingType(e.target.value as 'weight' | 'level')} disabled={!canEdit}>
                <option value="weight">Weight (kg)</option>
                <option value="level">Level</option>
              </select>
            </div>

            <div>
              <label className="input-label" style={{ display: 'block', marginBottom: '0.5rem' }}>
                Muscle Groups
                <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> (select all that apply)</span>
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {muscleGroups.map(mg => (
                  <button
                    type="button"
                    key={mg.id}
                    onClick={() => canEdit && toggleMG(mg.id)}
                    style={{
                      padding: '0.3rem 0.75rem',
                      borderRadius: '999px',
                      border: `1px solid ${selectedMGs.includes(mg.id) ? 'var(--primary)' : 'var(--border)'}`,
                      background: selectedMGs.includes(mg.id) ? 'rgba(249,115,22,0.15)' : 'var(--background)',
                      color: selectedMGs.includes(mg.id) ? 'var(--primary)' : 'var(--text-main)',
                      fontSize: '0.78rem',
                      cursor: canEdit ? 'pointer' : 'default',
                      fontWeight: selectedMGs.includes(mg.id) ? 600 : 400,
                      opacity: canEdit ? 1 : 0.6
                    }}
                  >
                    {mg.name}
                  </button>
                ))}
              </div>
            </div>

            {saveError && <p style={{ color: '#ef4444', fontSize: '0.8rem' }}>{saveError}</p>}

            {canEdit && (
              <button type="submit" className="btn btn-primary w-full" disabled={saving}>
                {saving ? 'Saving...' : (isEditing ? 'Save Changes' : 'Create Exercise')}
              </button>
            )}
          </form>
        </BottomSheet>
      )}

      {/* Muscle group add modal */}
      {mgModal && (
        <BottomSheet onClose={() => setMgModal(false)} title="Add Muscle Group">
          <p style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
            Add a new muscle group to the global list. It will be available to everyone when tagging exercises.
          </p>
          <form onSubmit={handleAddMuscleGroup} className="flex flex-col gap-4">
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Muscle Group Name</label>
              <input
                className="input-field"
                value={newMgName}
                onChange={e => setNewMgName(e.target.value)}
                placeholder="e.g. Inner Chest"
                required
              />
            </div>
            {mgError && <p style={{ color: '#ef4444', fontSize: '0.8rem' }}>{mgError}</p>}
            <button type="submit" className="btn btn-primary w-full" disabled={savingMg}>
              {savingMg ? 'Adding...' : 'Add Muscle Group'}
            </button>
          </form>
        </BottomSheet>
      )}

      {passModal && (
        <BottomSheet onClose={() => setPassModal(false)} title="Unlock Global Exercise Editing">
          <p style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
            Trainers with the special pass can update existing global exercises and fix bad tags.
          </p>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Trainer pass</label>
            <input
              className="input-field"
              type="password"
              value={trainerPass}
              onChange={(e) => setTrainerPass(e.target.value)}
              placeholder="Enter special pass"
            />
          </div>
          {passError && <p style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '0.75rem' }}>{passError}</p>}
          <button className="btn btn-primary w-full" style={{ marginTop: '1rem' }} onClick={handleUnlockGlobalEdit}>
            Unlock
          </button>
        </BottomSheet>
      )}
    </main>
  )
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '0.3rem 0.85rem',
        borderRadius: '999px',
        border: '1px solid var(--border)',
        fontSize: '0.78rem',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        background: active ? 'var(--primary)' : 'var(--surface)',
        color: active ? 'white' : 'var(--text-main)',
        fontWeight: active ? 600 : 400,
        transition: 'all 0.15s',
        flexShrink: 0
      }}
    >
      {label}
    </button>
  )
}

function BottomSheet({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--surface)',
        borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
        padding: '1.5rem',
        width: '100%',
        maxWidth: '600px',
        maxHeight: '88vh',
        overflowY: 'auto',
        borderTop: '1px solid var(--border)'
      }}>
        <div className="flex justify-between items-center" style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ marginBottom: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.25rem', cursor: 'pointer' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}
