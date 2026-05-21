import { useState } from 'react'
import VideoUpload from './components/VideoUpload'
import Questionnaire from './components/Questionnaire'
import './App.css'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: 'home' },
  { id: 'workouts', label: 'Workouts', icon: 'dumbbell' },
  { id: 'ai', label: 'AI Coach', icon: 'spark' },
  { id: 'progress', label: 'Progress', icon: 'chart' },
  { id: 'profile', label: 'Profile', icon: 'user' }
]

const statCards = [
  { label: 'Workouts This Week', value: '3/5', icon: 'dumbbell', tone: 'orange' },
  { label: 'Current Streak', value: '12 days', icon: 'trend', tone: 'green' },
  { label: 'Total Workouts', value: '48', icon: 'target', tone: 'blue' },
  { label: 'Weight Progress', value: '+5 kg', icon: 'weight', tone: 'red' }
]

const progressDays = [
  { day: 'Mon', value: 84, active: true },
  { day: 'Tue', value: 48, active: false },
  { day: 'Wed', value: 86, active: true },
  { day: 'Thu', value: 84, active: true },
  { day: 'Fri', value: 50, active: false },
  { day: 'Sat', value: 48, active: false },
  { day: 'Sun', value: 49, active: false }
]

function Icon({ name }) {
  const common = {
    width: '18',
    height: '18',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true'
  }

  switch (name) {
    case 'home':
      return <svg {...common}><path d="m3 10 9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></svg>
    case 'dumbbell':
      return <svg {...common}><path d="m6 6 12 12" /><path d="m4 8 4-4" /><path d="m16 20 4-4" /><path d="m2 10 8-8" /><path d="m14 22 8-8" /></svg>
    case 'spark':
      return <svg {...common}><path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z" /><path d="m19 3 .8 2.2L22 6l-2.2.8L19 9l-.8-2.2L16 6l2.2-.8Z" /></svg>
    case 'chart':
      return <svg {...common}><path d="M4 19V5" /><path d="M4 19h16" /><path d="m7 15 4-4 3 3 5-7" /></svg>
    case 'user':
      return <svg {...common}><path d="M20 21a8 8 0 0 0-16 0" /><circle cx="12" cy="7" r="4" /></svg>
    case 'share':
      return <svg {...common}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 10.5 6.8-4" /><path d="m8.6 13.5 6.8 4" /></svg>
    case 'calendar':
      return <svg {...common}><path d="M8 2v4" /><path d="M16 2v4" /><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18" /></svg>
    case 'trend':
      return <svg {...common}><path d="m4 16 5-5 4 4 7-7" /><path d="M14 8h6v6" /></svg>
    case 'target':
      return <svg {...common}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></svg>
    case 'weight':
      return <svg {...common}><path d="M6.5 8a5.5 5.5 0 0 1 11 0" /><path d="M5 8h14l-2 13H7Z" /><path d="M10 12h4" /></svg>
    case 'trophy':
      return <svg {...common}><path d="M8 21h8" /><path d="M12 17v4" /><path d="M7 4h10v5a5 5 0 0 1-10 0Z" /><path d="M5 6H3a3 3 0 0 0 3 3h1" /><path d="M19 6h2a3 3 0 0 1-3 3h-1" /></svg>
    case 'check':
      return <svg {...common}><path d="m20 6-11 11-5-5" /></svg>
    default:
      return null
  }
}

function Dashboard({ setCurrentView }) {
  return (
    <main className="dashboard">
      <section className="dashboard-hero">
        <div>
          <h1>Welcome Back, Moshe!</h1>
          <p>Let's crush your fitness goals today</p>
        </div>
        <button className="share-button" type="button">
          <Icon name="share" />
          Share Workout
        </button>
      </section>

      <section className="stats-grid" aria-label="Workout stats">
        {statCards.map((card) => (
          <article className="stat-card" key={card.label}>
            <span className={`icon-tile ${card.tone}`}>
              <Icon name={card.icon} />
            </span>
            <p>{card.label}</p>
            <strong>{card.value}</strong>
          </article>
        ))}
      </section>

      <section className="dashboard-grid">
        <article className="panel workout-panel">
          <div className="panel-header">
            <h2>Today's Workout</h2>
            <Icon name="calendar" />
          </div>

          <div className="workout-card">
            <div>
              <h3>Upper Body Strength</h3>
              <p>5 exercises</p>
              <span>45 min</span>
            </div>
            <button type="button" onClick={() => setCurrentView('questionnaire')}>Start Workout</button>
          </div>

          <div className="week-progress">
            <h3>This Week's Progress</h3>
            <div className="bars">
              {progressDays.map((item) => (
                <div className="bar-item" key={item.day}>
                  <span
                    className={item.active ? 'bar active' : 'bar'}
                    style={{ height: `${item.value}px` }}
                  />
                  <small>{item.day}</small>
                </div>
              ))}
            </div>
          </div>
        </article>

        <aside className="side-column">
          <section className="panel achievements-panel">
            <h2>Recent Achievements</h2>
            <div className="achievement-row">
              <span className="icon-tile yellow"><Icon name="trophy" /></span>
              <div>
                <strong>New Personal Record</strong>
                <p>Bench Press: 80kg</p>
              </div>
            </div>
            <div className="achievement-row">
              <span className="icon-tile green"><Icon name="check" /></span>
              <div>
                <strong>Weekly Goal Achieved</strong>
                <p>Completed 5 workouts</p>
              </div>
            </div>
          </section>

          <section className="coach-panel">
            <h2>AI Coach Available</h2>
            <p>Upload your workout video for real-time form analysis and feedback</p>
            <button type="button" onClick={() => setCurrentView('video')}>Try AI Coach</button>
          </section>
        </aside>
      </section>
    </main>
  )
}

function PlaceholderView({ title, description, onBack }) {
  return (
    <main className="placeholder-view">
      <button className="back-button" type="button" onClick={onBack}>Back</button>
      <h1>{title}</h1>
      <p>{description}</p>
    </main>
  )
}

function App() {
  const [currentView, setCurrentView] = useState('dashboard')

  const renderView = () => {
    switch (currentView) {
      case 'video':
      case 'ai':
        return <VideoUpload onBack={() => setCurrentView('dashboard')} />
      case 'questionnaire':
      case 'workouts':
        return <Questionnaire onBack={() => setCurrentView('dashboard')} />
      case 'progress':
        return (
          <PlaceholderView
            title="Progress"
            description="Progress tracking will be added after the dashboard foundation is in place."
            onBack={() => setCurrentView('dashboard')}
          />
        )
      case 'profile':
        return (
          <PlaceholderView
            title="Profile"
            description="Profile settings will be connected in a later pass."
            onBack={() => setCurrentView('dashboard')}
          />
        )
      default:
        return <Dashboard setCurrentView={setCurrentView} />
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" type="button" onClick={() => setCurrentView('dashboard')}>
          <span className="brand-mark"><Icon name="dumbbell" /></span>
          <span>GymBro</span>
        </button>

        <nav className="nav-tabs" aria-label="Primary navigation">
          {navItems.map((item) => (
            <button
              className={
                currentView === item.id ||
                (item.id === 'workouts' && currentView === 'questionnaire') ||
                (item.id === 'ai' && currentView === 'video')
                  ? 'nav-tab active'
                  : 'nav-tab'
              }
              key={item.id}
              type="button"
              onClick={() => setCurrentView(item.id)}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </header>

      {renderView()}
    </div>
  )
}

export default App
