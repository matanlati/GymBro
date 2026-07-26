import { PageHeader } from '@gymbro/ui-kit'
import CoachOverallProgress from '../components/progress/CoachOverallProgress'
import CoachTraineeProgress from '../components/progress/CoachTraineeProgress'

export default function CoachProgressPage() {
  return (
    <main className="progress-page coach-progress-page">
      <PageHeader
        title="Coach Progress"
        subtitle="Review your trainees' activity, achievements, goals, and progress"
      />
      <CoachOverallProgress />
      <CoachTraineeProgress />
    </main>
  )
}
