import { useState } from 'react'

function Questionnaire({ onBack }) {
  const [formData, setFormData] = useState({
    age: '',
    gender: '',
    height: '',
    weight: '',
    fitnessGoal: '',
    trainingLevel: '',
    trainingDays: '',
    injuries: '',
    preferredWorkoutType: '',
    equipmentAvailable: ''
  })
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/api/workout-plan/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const text = await response.text()
      let data
      try {
        data = JSON.parse(text)
      } catch (parseError) {
        data = { error: text || 'Invalid server response' }
      }

      setResult(data)
    } catch (error) {
      setResult({ error: error.message || 'Failed to generate workout plan' })
    } finally {
      setLoading(false)
    }
  }

  const renderPlan = () => {
    if (!result) return null
    if (result.error) {
      return <div className="error-box">{result.error}</div>
    }

    const { summary, weeklyPlan, safetyNotes, progressionNotes } = result

    return (
      <div className="result">
        <div className="result-header">
          <h3>Workout Plan</h3>
          <p className="plan-summary">{summary}</p>
        </div>

        {Array.isArray(weeklyPlan) && weeklyPlan.length > 0 && (
          <div className="plan-section">
            <h4>Weekly Plan</h4>
            <div className="plan-grid">
              {weeklyPlan.map((day, index) => (
                <div className="plan-card" key={index}>
                  <div className="plan-card-header">
                    <span className="day-label">{day.day || `Day ${index + 1}`}</span>
                    <strong>{day.focus}</strong>
                  </div>
                  <ul className="exercise-list">
                    {Array.isArray(day.exercises) && day.exercises.map((exercise, exIndex) => (
                      <li key={exIndex} className="exercise-item">
                        <strong>{exercise.name}</strong>
                        <div className="exercise-meta">
                          <span>Sets: {exercise.sets}</span>
                          <span>Reps: {exercise.reps}</span>
                        </div>
                        {exercise.notes && <p>{exercise.notes}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {Array.isArray(safetyNotes) && safetyNotes.length > 0 && (
          <div className="plan-section">
            <h4>Safety Notes</h4>
            <ul className="notes-list">
              {safetyNotes.map((note, index) => (
                <li key={index}>{note}</li>
              ))}
            </ul>
          </div>
        )}

        {progressionNotes && (
          <div className="plan-section">
            <h4>Progression Notes</h4>
            <p>{progressionNotes}</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="questionnaire-page">
      <button className="back-button" onClick={onBack}>← Back</button>
      <div className="questionnaire-header">
        <h2>Fitness Questionnaire</h2>
        <p>Fill in the details below and get a personalized weekly workout plan.</p>
      </div>

      <form onSubmit={handleSubmit} className="form">
        <div className="form-row">
          <div>
            <label>Age</label>
            <input type="number" name="age" value={formData.age} onChange={handleChange} required />
          </div>

          <div>
            <label>Gender</label>
            <select name="gender" value={formData.gender} onChange={handleChange} required>
              <option value="">Select</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div>
            <label>Height (cm)</label>
            <input type="number" name="height" value={formData.height} onChange={handleChange} required />
          </div>

          <div>
            <label>Weight (kg)</label>
            <input type="number" name="weight" value={formData.weight} onChange={handleChange} required />
          </div>
        </div>

        <div className="form-row">
          <div>
            <label>Fitness Goal</label>
            <select name="fitnessGoal" value={formData.fitnessGoal} onChange={handleChange} required>
              <option value="">Select</option>
              <option value="weight_loss">Weight Loss</option>
              <option value="muscle_gain">Muscle Gain</option>
              <option value="strength">Strength</option>
              <option value="endurance">Endurance</option>
            </select>
          </div>

          <div>
            <label>Training Level</label>
            <select name="trainingLevel" value={formData.trainingLevel} onChange={handleChange} required>
              <option value="">Select</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div>
            <label>Available Training Days per Week</label>
            <input type="number" name="trainingDays" value={formData.trainingDays} onChange={handleChange} required />
          </div>

          <div>
            <label>Preferred Workout Type</label>
            <select name="preferredWorkoutType" value={formData.preferredWorkoutType} onChange={handleChange} required>
              <option value="">Select</option>
              <option value="strength">Strength Training</option>
              <option value="cardio">Cardio</option>
              <option value="mixed">Mixed</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div>
            <label>Injuries or Limitations</label>
            <textarea name="injuries" value={formData.injuries} onChange={handleChange}></textarea>
          </div>
        </div>

        <div className="form-row">
          <div>
            <label>Equipment Available</label>
            <textarea name="equipmentAvailable" value={formData.equipmentAvailable} onChange={handleChange}></textarea>
          </div>
        </div>

        <button type="submit" className="primary-button" disabled={loading}>
          {loading ? 'Generating...' : 'Generate Workout Plan'}
        </button>
      </form>

      {loading && <div className="loading">Generating workout plan...</div>}
      {renderPlan()}
    </div>
  )
}

export default Questionnaire