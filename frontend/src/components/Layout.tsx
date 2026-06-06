import { ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import '../App.css'

type IconName = 'home' | 'dumbbell' | 'spark' | 'chart' | 'user'

function Icon({ name }: { name: IconName }) {
  const common = {
    width: '18', height: '18', viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: '2',
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  }
  switch (name) {
    case 'home':     return <svg {...common}><path d="m3 10 9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></svg>
    case 'dumbbell': return <svg {...common}><path d="m6 6 12 12" /><path d="m4 8 4-4" /><path d="m16 20 4-4" /><path d="m2 10 8-8" /><path d="m14 22 8-8" /></svg>
    case 'spark':    return <svg {...common}><path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z" /><path d="m19 3 .8 2.2L22 6l-2.2.8L19 9l-.8-2.2L16 6l2.2-.8Z" /></svg>
    case 'chart':    return <svg {...common}><path d="M4 19V5" /><path d="M4 19h16" /><path d="m7 15 4-4 3 3 5-7" /></svg>
    case 'user':     return <svg {...common}><path d="M20 21a8 8 0 0 0-16 0" /><circle cx="12" cy="7" r="4" /></svg>
  }
}

const navItems: { id: string; label: string; icon: IconName; path: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'home',     path: '/home' },
  { id: 'workouts',  label: 'Workouts',  icon: 'dumbbell', path: '/home' },
  { id: 'ai',        label: 'AI Coach',  icon: 'spark',    path: '/home' },
  { id: 'progress',  label: 'Progress',  icon: 'chart',    path: '/home' },
  { id: 'profile',   label: 'Profile',   icon: 'user',     path: '/profile' },
]

export default function Layout({ children }: { children: ReactNode }) {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const activeId = location.pathname === '/profile' ? 'profile' : 'dashboard'

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" type="button" onClick={() => navigate('/home')}>
          <span className="brand-mark">
            <Icon name="dumbbell" />
          </span>
          <span>GymBro</span>
        </button>

        <nav className="nav-tabs" aria-label="Primary navigation">
          {navItems.map(item => (
            <button
              key={item.id}
              className={activeId === item.id ? 'nav-tab active' : 'nav-tab'}
              type="button"
              onClick={() => navigate(item.path)}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <button
          onClick={handleLogout}
          style={{ background: 'none', border: 'none', fontSize: 13, color: '#6B7280', cursor: 'pointer' }}
        >
          Log out
        </button>
      </header>

      {children}
    </div>
  )
}
