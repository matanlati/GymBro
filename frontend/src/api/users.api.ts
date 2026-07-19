import client from './client'

export interface UserProfile {
  _id: string
  email: string
  name: string
  role: 'trainee' | 'coach'
  age?: number
  weightKg?: number
  heightCm?: number
  fitnessLevel?: 'beginner' | 'intermediate' | 'advanced'
  goals?: string
  limitations?: string
  photo?: string
  createdAt: string
}

export interface UpdateProfileData {
  name?: string
  age?: number
  weightKg?: number
  heightCm?: number
  fitnessLevel?: 'beginner' | 'intermediate' | 'advanced'
  goals?: string
  limitations?: string
}

export function getMe() {
  return client.get<UserProfile>('/users/me')
}

export function updateMe(data: UpdateProfileData) {
  return client.put<UserProfile>('/users/me', data)
}

export function uploadPhoto(file: File) {
  const form = new FormData()
  form.append('photo', file)
  return client.post<UserProfile>('/users/me/photo', form)
}
