import client from './client'

export interface WeightEntry {
  _id: string
  weightKg: number
  recordedAt: string
  createdAt: string
}

export function listWeights() {
  return client.get<WeightEntry[]>('/weights')
}

export function createWeight(weightKg: number) {
  return client.post<WeightEntry>('/weights', { weightKg })
}
