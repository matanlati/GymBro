import { useNavigate } from 'react-router-dom'
import VideoUpload from '../components/VideoUpload'

export default function AiCoachPage() {
  const navigate = useNavigate()
  return <VideoUpload onBack={() => navigate('/home')} />
}
