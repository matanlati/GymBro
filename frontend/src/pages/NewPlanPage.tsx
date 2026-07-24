import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Questionnaire from '../components/Questionnaire'
import { Alert, Button, LoadingState } from '@gymbro/ui-kit'
import { getMe } from '../api/users.api'

const NewPlanPage = () => {
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)
  const [coachManaged, setCoachManaged] = useState(false)

  useEffect(() => {
    getMe()
      .then(({ data }) => setCoachManaged(data.role === 'trainee' && Boolean(data.coachId)))
      .catch(() => setCoachManaged(false))
      .finally(() => setChecking(false))
  }, [])

  if (checking) return <main className="questionnaire-page"><LoadingState label="Checking plan access..." /></main>
  if (coachManaged) return (
    <main className="questionnaire-page coach-managed-plan-message">
      <Alert variant="info">Your coach manages your workout plan, so you cannot generate a separate plan while assigned to them.</Alert>
      <Button onClick={() => navigate('/workouts')}>Back to Workouts</Button>
    </main>
  )
  return <Questionnaire onBack={() => navigate('/home')} />
}

export default NewPlanPage
