import client from './client'
import { AuthResponse, LoginData, RegisterData } from '../types'

export function login(data: LoginData) {
  return client.post<AuthResponse>('/auth/login', data)
}

export function register(data: RegisterData) {
  return client.post<AuthResponse>('/auth/register', data)
}

export function logout() {
  return client.post('/auth/logout')
}

export function refreshToken() {
  return client.post('/auth/refresh')
}

export function googleLogin(credential: string) {
  return client.post<AuthResponse>('/auth/google', { credential })
}
