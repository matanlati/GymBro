import { useState } from 'react'

function VideoUpload({ onBack }) {
  const [file, setFile] = useState(null)
  const [exerciseType, setExerciseType] = useState('squat')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const renderEvaluation = () => {
    if (!result) return null

    if (result.error) {
      return <p className="error">{result.error}</p>
    }

    if (!result.evaluation) {
      return <p>No evaluation was returned.</p>
    }

    return <pre>{JSON.stringify(result.evaluation, null, 2)}</pre>
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) return

    setLoading(true)
    const formData = new FormData()
    formData.append('video', file)
    formData.append('exerciseType', exerciseType)

    try {
      const response = await fetch('/api/video/analyze', {
        method: 'POST',
        body: formData
      })
      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult({ error: 'Failed to analyze video' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button onClick={onBack}>Back</button>
      <h2>Upload Workout Video</h2>
      <form onSubmit={handleSubmit} className="form">
        <label>
          Exercise type
          <select value={exerciseType} onChange={(e) => setExerciseType(e.target.value)} required>
            <option value="squat">Squat</option>
            <option value="deadlift">Deadlift</option>
            <option value="push-up">Push-up</option>
            <option value="lunge">Lunge</option>
            <option value="shoulder press">Shoulder press</option>
            <option value="biceps curl">Biceps curl</option>
          </select>
        </label>
        <input
          type="file"
          accept="video/*"
          onChange={(e) => setFile(e.target.files[0])}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Analyzing...' : 'Analyze Video'}
        </button>
      </form>
      {loading && <div className="loading">Analyzing video...</div>}
      {result && (
        <div className="result">
          <h3>Evaluation:</h3>
          {renderEvaluation()}
        </div>
      )}
    </div>
  )
}

export default VideoUpload
