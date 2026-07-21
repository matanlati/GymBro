import client from './client'

export interface CoachUser {
  _id: string
  name: string
  email: string
  photo?: string
  role: 'trainee' | 'coach'
  coachId?: string
  age?: number
  weightKg?: number
  heightCm?: number
  fitnessLevel?: string
  goals?: string
  createdAt?: string
}

export interface CoachInvite {
  _id: string
  coachId: CoachUser
  traineeId: CoachUser
  traineeEmail: string
  status: 'pending' | 'accepted' | 'declined'
  createdAt: string
  acceptedAt?: string
}

export function sendCoachInvite(email: string) {
  return client.post<CoachInvite>('/coach/invites', { email })
}

export function listCoachInvites() {
  return client.get<CoachInvite[]>('/coach/invites')
}

export function listCoachTrainees() {
  return client.get<CoachUser[]>('/coach/trainees')
}

export function removeCoachTrainee(traineeId: string) {
  return client.delete(`/coach/trainees/${traineeId}`)
}

export interface CoachTraineeNotes {
  notes: string
  updatedAt: string | null
}

export function getCoachTraineeNotes(traineeId: string) {
  return client.get<CoachTraineeNotes>(`/coach/trainees/${traineeId}/notes`)
}

export function saveCoachTraineeNotes(traineeId: string, notes: string) {
  return client.put<CoachTraineeNotes>(`/coach/trainees/${traineeId}/notes`, { notes })
}

export function listMyCoachInvites() {
  return client.get<CoachInvite[]>('/coach/my-invites')
}

export function acceptCoachInvite(inviteId: string) {
  return client.post<CoachInvite>(`/coach/invites/${inviteId}/accept`)
}
