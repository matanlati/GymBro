import { ReactNode } from 'react'

interface StatCardProps {
  label: string
  value: string
  accent?: string
  icon?: ReactNode
}

// Compact metric tile used across the Progress dashboard.
export default function StatCard({ label, value, accent = '#F97316', icon }: StatCardProps) {
  return (
    <div className="progress-stat-card">
      {icon && (
        <span className="progress-stat-icon" style={{ color: accent }}>
          {icon}
        </span>
      )}
      <span className="progress-stat-value">{value}</span>
      <span className="progress-stat-label">{label}</span>
    </div>
  )
}
