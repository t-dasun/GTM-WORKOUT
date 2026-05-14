'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { findAthleteByUsername, getCurrentSession, getPendingClients, getScheduleHistoryForUsers, getTrainerClients, getTrainerTemplates, getUserProfile, removeTrainerClient, sendTrainerRequest, updateClientStatus, updateUserSchedule } from '@/lib/api'

export default function TrainerDashboard() {
  const router = useRouter()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [session, setSession] = useState<any>(null)
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [clients, setClients] = useState<any[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pendingClients, setPendingClients] = useState<any[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [templates, setTemplates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(null)
  const [searchUsername, setSearchUsername] = useState('')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [foundAthlete, setFoundAthlete] = useState<any>(null)
  const [searchError, setSearchError] = useState('')
  const [searching, setSearhing] = useState(false)
  const [sendingRequest, setSendingRequest] = useState(false)
  const [requestSent, setRequestSent] = useState(false)
  const [selectedTemplates, setSelectedTemplates] = useState<Record<string, string>>({})
  const [historyByClient, setHistoryByClient] = useState<Record<string, ScheduleHistoryRow[]>>({})
  const [removingClientId, setRemovingClientId] = useState<string | null>(null)
  const [clientSearch, setClientSearch] = useState('')
  const [sortMode, setSortMode] = useState<'recent' | 'name'>('recent')
  const [expandedClients, setExpandedClients] = useState<Record<string, boolean>>({})

  type ScheduleHistoryRow = {
    id: string
    user_id: string
    started_at: string
    ended_at: string | null
    workout_templates?: {
      name?: string
      level?: string | null
    } | {
      name?: string
      level?: string | null
    }[]
  }

  type ClientRow = {
    id: string
    email?: string
    full_name?: string
    username?: string
    linked_at?: string
    user_schedules?: { workout_templates?: { name?: string } }[]
  }

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
        if (profile.data?.role !== 'trainer') {
          router.push('/dashboard')
          return
        }

        const [clientData, pendingData, templateData] = await Promise.all([
          getTrainerClients(sess.user.id),
          getPendingClients(sess.user.id),
          getTrainerTemplates(sess.user.id)
        ])
        
        setClients(clientData || [])
        setPendingClients(pendingData || [])
        setTemplates(templateData || [])

        const clientIds = (clientData || []).map(c => c.id)
        const history = await getScheduleHistoryForUsers(clientIds)
        const grouped: Record<string, ScheduleHistoryRow[]> = {}
        history.forEach((row: ScheduleHistoryRow) => {
          if (!grouped[row.user_id]) grouped[row.user_id] = []
          grouped[row.user_id].push(row)
        })
        setHistoryByClient(grouped)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [router])

  const handleAssignTemplate = async (clientId: string, templateId: string) => {
    if (!templateId) return
    setAssigningId(clientId)
    try {
      // Create a default mapping mapping Day 1 to Monday, Day 2 to Tuesday etc.
      // This is simplified. The user can adjust it later.
      const defaultMapping = {
        Monday: 'Day 1',
        Tuesday: 'Day 2',
        Wednesday: 'Rest',
        Thursday: 'Day 3',
        Friday: 'Day 4',
        Saturday: 'Rest',
        Sunday: 'Rest'
      }
      await updateUserSchedule(clientId, templateId, defaultMapping, { assignedByTrainerId: session.user.id })
      
      // Refresh clients
      const [newClients, history] = await Promise.all([
        getTrainerClients(session.user.id),
        getScheduleHistoryForUsers(clients.map(c => c.id))
      ])
      setClients(newClients || [])
      const grouped: Record<string, ScheduleHistoryRow[]> = {}
      history.forEach((row: ScheduleHistoryRow) => {
        if (!grouped[row.user_id]) grouped[row.user_id] = []
        grouped[row.user_id].push(row)
      })
      setHistoryByClient(grouped)
      setSelectedTemplates(prev => ({ ...prev, [clientId]: '' }))
    } catch (err) {
      console.error(err)
      alert('Failed to assign schedule')
    } finally {
      setAssigningId(null)
    }
  }

  const visibleClients = [...clients]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((client: any) => {
      const query = clientSearch.trim().toLowerCase()
      if (!query) return true
      const byUsername = (client.username || '').toLowerCase().includes(query)
      const byName = (client.full_name || '').toLowerCase().includes(query)
      return byUsername || byName
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .sort((a: any, b: any) => {
      if (sortMode === 'name') {
        const an = (a.full_name || a.username || '').toLowerCase()
        const bn = (b.full_name || b.username || '').toLowerCase()
        return an.localeCompare(bn)
      }
      const ad = a.linked_at ? new Date(a.linked_at).getTime() : 0
      const bd = b.linked_at ? new Date(b.linked_at).getTime() : 0
      return bd - ad
    })

  const handleClientRequest = async (clientId: string, status: 'approved' | 'rejected') => {
    if (!session) return
    setUpdatingRequestId(clientId)

    try {
      await updateClientStatus(session.user.id, clientId, status)
      const [clientData, pendingData] = await Promise.all([
        getTrainerClients(session.user.id),
        getPendingClients(session.user.id)
      ])

      setClients(clientData || [])
      setPendingClients(pendingData || [])
    } catch (err) {
      console.error(err)
      alert(`Failed to ${status === 'approved' ? 'approve' : 'reject'} request`)
    } finally {
      setUpdatingRequestId(null)
    }
  }

  const handleRemoveClient = async (clientId: string) => {
    if (!session) return
    const confirmed = window.confirm('Remove this client from your list? They can reconnect later by request.')
    if (!confirmed) return

    setRemovingClientId(clientId)
    try {
      await removeTrainerClient(session.user.id, clientId)
      const [clientData, pendingData] = await Promise.all([
        getTrainerClients(session.user.id),
        getPendingClients(session.user.id)
      ])
      setClients(clientData || [])
      setPendingClients(pendingData || [])
      setHistoryByClient(prev => {
        const next = { ...prev }
        delete next[clientId]
        return next
      })
    } catch (err) {
      console.error(err)
      alert('Failed to remove client')
    } finally {
      setRemovingClientId(null)
    }
  }

  const handleSearchAthlete = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchUsername.trim()) return
    setSearhing(true)
    setSearchError('')
    setFoundAthlete(null)
    setRequestSent(false)

    try {
      const athlete = await findAthleteByUsername(searchUsername.trim())
      if (!athlete) {
        setSearchError('No athlete found with that username.')
      } else {
        setFoundAthlete(athlete)
      }
    } catch {
      setSearchError('Search failed. Please try again.')
    } finally {
      setSearhing(false)
    }
  }

  const handleSendRequest = async () => {
    if (!foundAthlete || !session) return
    setSendingRequest(true)

    try {
      await sendTrainerRequest(session.user.id, foundAthlete.id)
      setRequestSent(true)
      setSearchUsername('')
      setFoundAthlete(null)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send request'
      alert(message)
    } finally {
      setSendingRequest(false)
    }
  }

  if (loading) return <main className="container page-shell trainer-page text-center mt-4">Loading dashboard...</main>

  return (
    <main className="container page-shell trainer-page" style={{ paddingBottom: '4rem' }}>
      <div className="page-header">
        <span className="page-eyebrow">Trainer control</span>
        <h1 className="page-title">Trainer Dashboard</h1>
        <p className="page-subtitle">Manage client requests, assign plans, and maintain your schedule library from a touch-friendly layout that scales across phone, tablet, and desktop.</p>
      </div>

      <div className="trainer-layout">
      <div className="trainer-stack">
      
      <div className="card hero-card" style={{ marginTop: '0' }}>
        <h3 style={{ marginBottom: '0.75rem' }}>Add Client by Username</h3>
        <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
          Search for an athlete by their exact username to send an access request. They will need to approve it.
        </p>

        <form onSubmit={handleSearchAthlete} className="trainer-inline-actions">
          <input
            className="input-field"
            style={{ flex: 1, marginBottom: 0 }}
            placeholder="Enter athlete username…"
            value={searchUsername}
            onChange={e => { setSearchUsername(e.target.value); setFoundAthlete(null); setSearchError(''); setRequestSent(false) }}
          />
          <button type="submit" className="btn btn-secondary" disabled={searching} style={{ whiteSpace: 'nowrap' }}>
            {searching ? 'Searching…' : 'Search'}
          </button>
        </form>

        {searchError && (
          <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#ef4444' }}>{searchError}</p>
        )}

        {foundAthlete && !requestSent && (
          <div className="trainer-list-row" style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', gap: '0.75rem' }}>
            <div>
              <p style={{ color: 'var(--text-main)', fontWeight: 600, marginBottom: '0.2rem' }}>{foundAthlete.full_name || foundAthlete.email}</p>
              <p style={{ fontSize: '0.75rem' }}>@{foundAthlete.username}</p>
            </div>
            <button
              className="btn btn-primary"
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}
              onClick={handleSendRequest}
              disabled={sendingRequest}
            >
              {sendingRequest ? 'Sending…' : 'Send Request'}
            </button>
          </div>
        )}

        {requestSent && (
          <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#10b981' }}>✓ Request sent! Waiting for athlete to approve.</p>
        )}
      </div>

      <div className="card" style={{ marginTop: '0' }}>
        <div className="flex justify-between items-center mb-4" style={{ gap: '0.75rem', flexWrap: 'wrap' }}>
          <h3>My Clients</h3>
          <div className="trainer-toolbar">
            <input
              className="input-field trainer-filter-control"
              style={{ marginBottom: 0, padding: '0.5rem 0.65rem' }}
              placeholder="Search @username"
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
            />
            <select
              className="input-field trainer-filter-control"
              style={{ marginBottom: 0, padding: '0.5rem 0.65rem' }}
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as 'recent' | 'name')}
            >
              <option value="recent">Most recent</option>
              <option value="name">Sort by name</option>
            </select>
          </div>
        </div>

        {pendingClients.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ marginBottom: '0.75rem' }}>Pending Requests</h4>
            <div className="flex flex-col gap-2">
              {pendingClients.map(client => (
                <div key={client.id} className="trainer-list-row" style={{ gap: '0.75rem', padding: '0.75rem', backgroundColor: 'var(--background)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 500 }}>{client.full_name || `@${client.username}` || client.email}</div>
                  <div className="flex gap-2">
                    <button
                      className="btn btn-primary"
                      style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}
                      disabled={updatingRequestId === client.id}
                      onClick={() => handleClientRequest(client.id, 'approved')}
                    >
                      Approve
                    </button>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', borderColor: '#ef4444', color: '#ef4444' }}
                      disabled={updatingRequestId === client.id}
                      onClick={() => handleClientRequest(client.id, 'rejected')}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="flex flex-col gap-3" style={{ maxHeight: '66vh', overflowY: 'auto', paddingRight: '0.2rem' }}>
          {visibleClients.map((client: ClientRow) => {
            const currentPlan = client.user_schedules?.[0]?.workout_templates?.name || 'No Plan Assigned'
            const isOpen = Boolean(expandedClients[client.id])
            return (
              <div key={client.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', padding: '0.8rem', backgroundColor: 'var(--background)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <button
                  type="button"
                  onClick={() => setExpandedClients(prev => ({ ...prev, [client.id]: !prev[client.id] }))}
                  style={{ background: 'none', border: 'none', textAlign: 'left', color: 'inherit', cursor: 'pointer', padding: 0 }}
                >
                  <div className="trainer-list-row">
                    <div>
                      <div style={{ fontWeight: 600 }}>{client.full_name || `@${client.username}` || client.email}</div>
                      <p style={{ fontSize: '0.74rem' }}>@{client.username || 'no-username'} • {currentPlan}</p>
                    </div>
                    <span style={{ color: 'var(--text-muted)' }}>{isOpen ? '−' : '+'}</span>
                  </div>
                </button>

                {isOpen && (
                  <>
                    <div style={{ marginTop: '0.5rem' }}>
                      <label className="text-muted" style={{ fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>Assign New Plan:</label>
                      <div className="trainer-inline-actions" style={{ flexWrap: 'wrap' }}>
                        <select 
                          className="input-field" 
                          style={{ flex: 1, minWidth: '220px', padding: '0.5rem', fontSize: '0.875rem', marginBottom: 0 }}
                          onChange={e => setSelectedTemplates(prev => ({ ...prev, [client.id]: e.target.value }))}
                          value={selectedTemplates[client.id] || ''}
                          disabled={assigningId === client.id}
                        >
                          <option value="" disabled>Select a Schedule...</option>
                          {templates.map(t => (
                            <option key={t.id} value={t.id}>{t.name} ({t.level})</option>
                          ))}
                        </select>
                        <button
                          className="btn btn-primary"
                          style={{ padding: '0.5rem 0.8rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                          disabled={assigningId === client.id || !selectedTemplates[client.id]}
                          onClick={() => handleAssignTemplate(client.id, selectedTemplates[client.id])}
                        >
                          {assigningId === client.id ? 'Assigning...' : 'Assign'}
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '0.5rem 0.8rem', fontSize: '0.75rem', whiteSpace: 'nowrap', color: '#ef4444', borderColor: '#ef4444' }}
                          disabled={removingClientId === client.id}
                          onClick={() => handleRemoveClient(client.id)}
                        >
                          {removingClientId === client.id ? 'Removing...' : 'Remove'}
                        </button>
                      </div>
                    </div>

                    <div style={{ marginTop: '0.35rem' }}>
                      <p style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>Schedule history</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        {(historyByClient[client.id] || []).slice(0, 4).map((h) => {
                          const start = new Date(h.started_at).toLocaleDateString()
                          const end = h.ended_at ? new Date(h.ended_at).toLocaleDateString() : 'Present'
                          const historyTemplate = Array.isArray(h.workout_templates) ? h.workout_templates[0] : h.workout_templates
                          return (
                            <div key={h.id} style={{ fontSize: '0.74rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0.4rem 0.55rem' }}>
                              <span style={{ color: 'var(--text-main)' }}>{historyTemplate?.name || 'Unknown Plan'}</span>
                              <span style={{ color: 'var(--text-muted)' }}> • {start} → {end}</span>
                            </div>
                          )
                        })}
                        {(historyByClient[client.id] || []).length === 0 && (
                          <p style={{ fontSize: '0.74rem' }}>No schedule history yet.</p>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )
          })}
          {visibleClients.length === 0 && (
            <p className="text-muted text-center" style={{ fontSize: '0.875rem' }}>No clients found. Try searching another username.</p>
          )}
        </div>
      </div>
      </div>
      </div>
    </main>
  )
}
