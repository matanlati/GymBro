import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Alert, Button, Card, EmptyState, FormField, Input, LoadingState, PageHeader } from '@gymbro/ui-kit'
import { AxiosError } from 'axios'
import { CoachInvite, CoachUser, listCoachInvites, listCoachTrainees, sendCoachInvite } from '../api/coach.api'
import { useAuth } from '../context/AuthContext'

const initials = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'T'

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export default function CoachTraineesPage() {
  const { user } = useAuth()
  const [trainees, setTrainees] = useState<CoachUser[]>([])
  const [invites, setInvites] = useState<CoachInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const pendingInvites = useMemo(
    () => invites.filter(invite => invite.status === 'pending'),
    [invites]
  )

  useEffect(() => {
    Promise.all([
      listCoachTrainees().then(({ data }) => setTrainees(data)),
      listCoachInvites().then(({ data }) => setInvites(data)),
    ]).finally(() => setLoading(false))
  }, [])

  if (user?.role !== 'coach') return <Navigate to="/home" replace />

  const openModal = () => {
    setEmail('')
    setError('')
    setModalOpen(true)
  }

  const closeModal = () => {
    if (saving) return
    setModalOpen(false)
    setError('')
  }

  const submitInvite = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const { data } = await sendCoachInvite(email)
      setInvites(current => [data, ...current.filter(invite => invite._id !== data._id)])
      setModalOpen(false)
      setEmail('')
    } catch (err) {
      const axiosErr = err as AxiosError<{ message: string }>
      setError(axiosErr.response?.data?.message || 'Could not send invite')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="coach-trainees-page">
      <PageHeader
        title="Trainees"
        subtitle="Manage trainee relationships and pending invitations"
        actions={<Button onClick={openModal}>Add Trainee</Button>}
      />

      {loading ? (
        <LoadingState label="Loading trainees..." />
      ) : (
        <div className="coach-trainees-grid">
          <Card className="coach-panel">
            <div className="coach-panel-head">
              <h2>Active Trainees</h2>
              <span>{trainees.length}</span>
            </div>
            {trainees.length === 0 ? (
              <EmptyState>No trainees yet. Invite a trainee by email to get started.</EmptyState>
            ) : (
              <div className="coach-list">
                {trainees.map(trainee => (
                  <article className="coach-list-item" key={trainee._id}>
                    <span className="coach-avatar">{initials(trainee.name)}</span>
                    <div>
                      <strong>{trainee.name}</strong>
                      <small>{trainee.email}</small>
                      {trainee.fitnessLevel ? <small>{trainee.fitnessLevel}</small> : null}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </Card>

          <Card className="coach-panel">
            <div className="coach-panel-head">
              <h2>Pending Invites</h2>
              <span>{pendingInvites.length}</span>
            </div>
            {pendingInvites.length === 0 ? (
              <EmptyState>No pending invitations.</EmptyState>
            ) : (
              <div className="coach-list">
                {pendingInvites.map(invite => (
                  <article className="coach-list-item" key={invite._id}>
                    <span className="coach-avatar">{initials(invite.traineeId?.name ?? invite.traineeEmail)}</span>
                    <div>
                      <strong>{invite.traineeId?.name ?? invite.traineeEmail}</strong>
                      <small>{invite.traineeEmail}</small>
                      <small>Sent {formatDate(invite.createdAt)}</small>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {modalOpen ? (
        <div className="coach-modal-backdrop" role="presentation" onClick={closeModal}>
          <section className="coach-modal" role="dialog" aria-modal="true" aria-label="Add trainee" onClick={event => event.stopPropagation()}>
            <div className="coach-modal-head">
              <div>
                <h2>Add Trainee</h2>
                <p>Send an invite to an existing trainee account.</p>
              </div>
              <button type="button" aria-label="Close add trainee modal" onClick={closeModal}>x</button>
            </div>

            <form className="coach-invite-form" onSubmit={submitInvite}>
              <FormField label="Trainee email">
                <Input
                  type="email"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  placeholder="trainee@example.com"
                  required
                />
              </FormField>
              {error ? <Alert variant="error">{error}</Alert> : null}
              <div className="coach-modal-actions">
                <Button variant="secondary" onClick={closeModal}>Cancel</Button>
                <Button type="submit" loading={saving} loadingLabel="Sending...">Send Invite</Button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  )
}
