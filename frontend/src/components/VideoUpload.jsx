import { useState } from 'react'

function VideoUpload({ onBack }) {
  const [file, setFile] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) return

    setLoading(true)
    const formData = new FormData()
    formData.append('video', file)

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
          <h3>Analysis Result:</h3>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}

export default VideoUpload