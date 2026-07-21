import ProgressDashboard from '../components/progress/ProgressDashboard'
import { traineeProgressDataSource } from '../api/progressDataSource'
import { useAuth } from '../context/AuthContext'
import CoachProgressPage from './CoachProgressPage'

export default function ProgressPage() {
  const { user } = useAuth()

  if (user?.role === 'coach') return <CoachProgressPage />
  return <ProgressDashboard dataSource={traineeProgressDataSource} />
}
