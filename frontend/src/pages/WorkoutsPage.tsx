import { useNavigate } from 'react-router-dom'
import Questionnaire from '../components/Questionnaire'

export default function WorkoutsPage() {
  const navigate = useNavigate()
  return <Questionnaire onBack={() => navigate('/home')} />
}
