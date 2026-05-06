import { useState } from 'react'
import VideoUpload from './components/VideoUpload'
import Questionnaire from './components/Questionnaire'
import './App.css'

function App() {
  const [currentView, setCurrentView] = useState('main')

  const renderView = () => {
    switch (currentView) {
      case 'video':
        return <VideoUpload onBack={() => setCurrentView('main')} />
      case 'questionnaire':
        return <Questionnaire onBack={() => setCurrentView('main')} />
      default:
        return (
          <div className="main-page">
            <h1>AI Fitness Assistant - POC</h1>
            <button onClick={() => setCurrentView('video')}>Upload Workout Video</button>
            <button onClick={() => setCurrentView('questionnaire')}>Fill Fitness Questionnaire</button>
          </div>
        )
    }
  }

  return (
    <div className="app">
      {renderView()}
    </div>
  )
}

export default App