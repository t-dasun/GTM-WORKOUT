'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteTrainerTemplate, getCurrentSession, getTrainerTemplates, getUserProfile } from '@/lib/api'

type TemplateRow = {
  id: string
  name: string
  level?: string | null
  trainer_id?: string | null
}

export default function TrainerTemplatesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [trainerId, setTrainerId] = useState<string | null>(null)
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const sess = await getCurrentSession()
        if (!sess) {
          router.push('/auth')
          return
        }

        const profile = await getUserProfile(sess.user.id)
        if (profile.data?.role !== 'trainer') {
          router.push('/dashboard')
          return
        }

        setTrainerId(sess.user.id)
        const templateData = await getTrainerTemplates(sess.user.id)
        setTemplates(templateData || [])
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [router])

  const ownedTemplates = templates.filter(template => template.trainer_id === trainerId)
  const sharedTemplates = templates.filter(template => !template.trainer_id)

  const handleDeleteTemplate = async (templateId: string) => {
    if (!trainerId) return
    if (!confirm('Delete this schedule?')) return
    setDeletingTemplateId(templateId)
    try {
      await deleteTrainerTemplate(trainerId, templateId)
      const templateData = await getTrainerTemplates(trainerId)
      setTemplates(templateData || [])
    } catch (err) {
      console.error(err)
      alert('Failed to delete schedule')
    } finally {
      setDeletingTemplateId(null)
    }
  }

  if (loading) return <main className="container page-shell trainer-page text-center mt-4">Loading schedules...</main>

  return (
    <main className="container page-shell trainer-page" style={{ paddingBottom: '4rem' }}>
      <div className="page-header page-header--split">
        <div>
          <span className="page-eyebrow">Trainer schedules</span>
          <h1 className="page-title">Existing Schedules</h1>
          <p className="page-subtitle">Your saved schedules and shared sample schedules live here. Open one to edit, customize, or create a new routine.</p>
        </div>
        <div className="trainer-inline-actions">
          <Link href="/trainer" className="btn btn-secondary" style={{ textDecoration: 'none' }}>
            Back to Clients
          </Link>
          <Link href="/plan/create" className="btn btn-primary" style={{ textDecoration: 'none' }}>
            + Create New Schedule
          </Link>
        </div>
      </div>

      <div className="trainer-layout">
        <div className="trainer-stack">
          <div className="card" style={{ marginTop: 0 }}>
            <div className="flex justify-between items-center mb-4" style={{ gap: '0.75rem', flexWrap: 'wrap' }}>
              <h3>My Saved Schedules</h3>
              <span className="badge">{ownedTemplates.length}</span>
            </div>

            <div className="flex flex-col gap-2">
              {ownedTemplates.map(template => (
                <div key={template.id} className="trainer-list-row" style={{ padding: '0.75rem', backgroundColor: 'var(--background)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{template.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{template.level || 'Custom level'}</div>
                  </div>
                  <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                    <Link
                      href={`/plan/create?templateId=${template.id}`}
                      className="btn btn-secondary"
                      style={{ textDecoration: 'none', padding: '0.35rem 0.8rem', fontSize: '0.75rem' }}
                    >
                      Edit
                    </Link>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '0.35rem 0.8rem', fontSize: '0.75rem', color: '#ef4444', borderColor: '#ef4444' }}
                      disabled={deletingTemplateId === template.id}
                      onClick={() => handleDeleteTemplate(template.id)}
                    >
                      {deletingTemplateId === template.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
              {ownedTemplates.length === 0 && (
                <p className="text-muted text-center" style={{ fontSize: '0.85rem' }}>No saved schedules yet.</p>
              )}
            </div>
          </div>
        </div>

        <div className="trainer-stack">
          <div className="card" style={{ marginTop: 0 }}>
            <div className="flex justify-between items-center mb-4" style={{ gap: '0.75rem', flexWrap: 'wrap' }}>
              <h3>Sample Schedules</h3>
              <span className="badge">{sharedTemplates.length}</span>
            </div>

            <div className="flex flex-col gap-2">
              {sharedTemplates.map(template => (
                <div key={template.id} className="trainer-list-row" style={{ padding: '0.75rem', backgroundColor: 'var(--background)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{template.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{template.level || 'Shared'}</div>
                  </div>
                  <div className="flex gap-2 items-center" style={{ flexWrap: 'wrap' }}>
                    <Link
                      href={`/plan/create?templateId=${template.id}`}
                      className="btn btn-secondary"
                      style={{ textDecoration: 'none', padding: '0.35rem 0.8rem', fontSize: '0.75rem' }}
                    >
                      Customize
                    </Link>
                    <span style={{ fontSize: '0.75rem', color: '#10b981', border: '1px solid #10b981', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>Sample</span>
                  </div>
                </div>
              ))}
              {sharedTemplates.length === 0 && (
                <p className="text-muted text-center" style={{ fontSize: '0.85rem' }}>No sample schedules available.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
