import ProgressDashboard from '../components/progress/ProgressDashboard'
import { traineeProgressDataSource } from '../api/progressDataSource'

export default function ProgressPage() {
  return <ProgressDashboard dataSource={traineeProgressDataSource} />
}
