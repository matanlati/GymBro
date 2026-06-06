import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import VideoUpload from '../components/VideoUpload'
import Questionnaire from '../components/Questionnaire'

type View = 'main' | 'video' | 'questionnaire'

export default function HomePage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [view, setView] = useState<View>('main')

  function handleLogout() {
    logout()
    navigate('/login')
  }

  if (view === 'video') return <VideoUpload onBack={() => setView('main')} />
  if (view === 'questionnaire') return <Questionnaire onBack={() => setView('main')} />

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>GymBro</h1>
        <div style={styles.headerRight}>
          {user && <span style={styles.userName}>Hi, {user.name}</span>}
          <button onClick={handleLogout} style={styles.logoutBtn}>Log out</button>
        </div>
      </div>

      <div style={styles.body}>
        <h2 style={styles.heading}>AI Fitness Assistant</h2>
        <div style={styles.cards}>
          <button style={styles.card} onClick={() => setView('video')}>
            <span style={styles.cardIcon}>🎥</span>
            <span style={styles.cardTitle}>Upload Workout Video</span>
            <span style={styles.cardDesc}>Get AI-powered form analysis</span>
          </button>
          <button style={styles.card} onClick={() => setView('questionnaire')}>
            <span style={styles.cardIcon}>📋</span>
            <span style={styles.cardTitle}>Fitness Questionnaire</span>
            <span style={styles.cardDesc}>Generate a personalized workout plan</span>
          </button>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#F5F7FA',
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  },
  header: {
    backgroundColor: '#FFFFFF',
    borderBottom: '1px solid #E5E7EB',
    padding: '16px 32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    margin: 0,
    fontSize: 22,
    fontWeight: 700,
    background: 'linear-gradient(to right, #F97316, #EF4444)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  userName: {
    fontSize: 14,
    color: '#374151',
  },
  logoutBtn: {
    fontSize: 13,
    color: '#6B7280',
    background: 'none',
    border: '1px solid #E5E7EB',
    borderRadius: 6,
    padding: '6px 14px',
    cursor: 'pointer',
  },
  body: {
    maxWidth: 640,
    margin: '0 auto',
    padding: '64px 24px',
    textAlign: 'center',
  },
  heading: {
    fontSize: 26,
    fontWeight: 700,
    color: '#111827',
    marginBottom: 40,
  },
  cards: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderRadius: 12,
    padding: '32px 24px',
    cursor: 'pointer',
    transition: 'box-shadow 0.15s',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  cardIcon: {
    fontSize: 36,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: 600,
    color: '#111827',
  },
  cardDesc: {
    fontSize: 14,
    color: '#6B7280',
  },
}
