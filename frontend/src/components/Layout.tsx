import { ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Button, Icon } from '@gymbro/ui-kit'
import type { IconName } from '@gymbro/ui-kit'
import { useAuth } from '../context/AuthContext'
import '../App.css'

const navItems: { id: string; label: string; icon: IconName; path: string }[] = [
  { id: '/home',      label: 'Dashboard', icon: 'home',     path: '/home' },
  { id: '/workouts',  label: 'Workouts',  icon: 'dumbbell', path: '/workouts' },
  { id: '/ai-coach',  label: 'AI Coach',  icon: 'spark',    path: '/ai-coach' },
  { id: '/feed',      label: 'Feed',      icon: 'share',    path: '/feed' },
  { id: '/progress',  label: 'Progress',  icon: 'chart',    path: '/progress' },
  { id: '/profile',   label: 'Profile',   icon: 'user',     path: '/profile' },
]

export default function Layout({ children }: { children: ReactNode }) {
  const { logout, user } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const visibleNavItems = user?.role === 'coach'
    ? [
        ...navItems.slice(0, 1),
        { id: '/coach/trainees', label: 'Trainees', icon: 'user' as IconName, path: '/coach/trainees' },
        ...navItems.slice(1).filter(item => item.id !== '/ai-coach'),
      ]
    : navItems

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" type="button" onClick={() => navigate('/home')}>
          <span className="brand-mark"><Icon name="dumbbell" /></span>
          <span>GymBro</span>
        </button>

        <nav className="nav-tabs" aria-label="Primary navigation">
          {visibleNavItems.map(item => (
            <button
              key={item.id}
              className={pathname === item.path ? 'nav-tab active' : 'nav-tab'}
              type="button"
              onClick={() => navigate(item.path)}
              title={item.label}
              aria-label={item.label}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <Button variant="ghost" size="sm" style={{ color: 'var(--gb-text-muted)', fontSize: 13 }} onClick={handleLogout}>
          Log out
        </Button>
      </header>

      {children}
    </div>
  )
}
