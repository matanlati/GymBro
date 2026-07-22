import { useEffect, useMemo, useState } from 'react'
import type { SelectOption } from '@gymbro/ui-kit'
import { Alert, Card, CardHeader, EmptyState, LoadingState } from '@gymbro/ui-kit'
import { CoachUser, listCoachTrainees } from '../../api/coach.api'
import { createCoachProgressDataSource } from '../../api/progressDataSource'
import ProgressSelect from './ProgressSelect'
import ProgressDashboard, { COACH_PROGRESS_PERMISSIONS } from './ProgressDashboard'

export default function CoachTraineeProgress() {
  const [trainees, setTrainees] = useState<CoachUser[]>([])
  const [selectedTraineeId, setSelectedTraineeId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    listCoachTrainees()
      .then(({ data }) => {
        if (!active) return
        setTrainees(data)
        setSelectedTraineeId(current =>
          data.some(trainee => trainee._id === current) ? current : data[0]?._id ?? ''
        )
      })
      .catch(() => {
        if (active) setError('Could not load your assigned trainees. Please try again.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const options: SelectOption[] = trainees.map(trainee => ({
    value: trainee._id,
    label: trainee.name,
  }))
  const selectedTrainee = trainees.find(trainee => trainee._id === selectedTraineeId)
  const dataSource = useMemo(
    () => selectedTraineeId ? createCoachProgressDataSource(selectedTraineeId) : null,
    [selectedTraineeId]
  )

  return (
    <section className="coach-selected-trainee-progress" aria-labelledby="trainee-progress-title">
      <Card className="coach-trainee-progress-heading">
        <CardHeader
          title="Trainee Progress"
          eyebrow={selectedTrainee ? selectedTrainee.email : 'Weekly activity and progress details'}
          trailing={options.length > 0 ? (
            <ProgressSelect
              className="progress-control-select coach-trainee-select"
              options={options}
              value={selectedTraineeId}
              onValueChange={setSelectedTraineeId}
              ariaLabel="Select trainee"
            />
          ) : undefined}
          id="trainee-progress-title"
        />

        {error && <Alert variant="error">{error}</Alert>}
        {loading && <LoadingState label="Loading assigned trainees..." />}
        {!loading && !error && trainees.length === 0 && (
          <EmptyState>Assign a trainee to start reviewing their progress.</EmptyState>
        )}
      </Card>

      {!loading && !error && dataSource && (
        <ProgressDashboard
          key={selectedTraineeId}
          dataSource={dataSource}
          embedded
          showSummaryStats={false}
          permissions={COACH_PROGRESS_PERMISSIONS}
        />
      )}
    </section>
  )
}
