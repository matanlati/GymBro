import { useNavigate } from 'react-router-dom'
import Questionnaire from '../components/Questionnaire'

const NewPlanPage = () => {
  const navigate = useNavigate()
  return <Questionnaire onBack={() => navigate('/home')} />
}

export default NewPlanPage
