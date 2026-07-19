export interface User {
  _id: string
  email: string
  name: string
  role: 'trainee' | 'coach'
}

export interface LoginData {
  email: string
  password: string
}

export interface RegisterData {
  email: string
  password: string
  name: string
  role?: 'trainee' | 'coach'
}

export interface AuthResponse {
  user: User
}
