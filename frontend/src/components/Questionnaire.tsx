import { useState, FormEvent, ChangeEvent } from 'react'
import client from '../api/client'

interface QuestionnaireData {
  age: string
  gender: string
  height: string
  weight: string
  fitnessGoal: string
  trainingLevel: string
  trainingDays: string
  injuries: string
  preferredWorkoutType: string
  equipmentAvailable: string
}

interface Exercise {
  name: string
  sets: string
  reps: string
  notes?: string
}

interface DayPlan {
  day: string
  focus: string
  exercises: Exercise[]
}

interface WorkoutPlan {
  summary: string
  weeklyPlan: DayPlan[]
  safetyNotes: string[]
  progressionNotes: string
  error?: string
}

interface Props {
  onBack: () => void
}

const initialForm: QuestionnaireData = {
  age: '', gender: '', height: '', weight: '',
  fitnessGoal: '', trainingLevel: '', trainingDays: '',
  injuries: '', preferredWorkoutType: '', equipmentAvailable: '',
}

export default function Questionnaire({ onBack }: Props) {
  const [formData, setFormData] = useState<QuestionnaireData>(initialForm)
  const [result, setResult] = useState<WorkoutPlan | null>(null)
  const [loading, setLoading] = useState(false)

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await client.post<WorkoutPlan>('/workout-plan/generate', formData)
      setResult(data)
    } catch (error) {
      setResult({ error: error instanceof Error ? error.message : 'Failed to generate workout plan' } as WorkoutPlan)
    } finally {
      setLoading(false)
    }
  }

  const renderPlan = () => {
    if (!result) return null
    if (result.error) return <div className="error-box">{result.error}</div>

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
              {weeklyPlan.map((day, i) => (
                <div className="plan-card" key={i}>
                  <div className="plan-card-header">
                    <span className="day-label">{day.day || `Day ${i + 1}`}</span>
                    <strong>{day.focus}</strong>
                  </div>
                  <ul className="exercise-list">
                    {day.exercises.map((ex, j) => (
                      <li key={j} className="exercise-item">
                        <strong>{ex.name}</strong>
                        <div className="exercise-meta">
                          <span>Sets: {ex.sets}</span>
                          <span>Reps: {ex.reps}</span>
                        </div>
                        {ex.notes && <p>{ex.notes}</p>}
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
              {safetyNotes.map((note, i) => <li key={i}>{note}</li>)}
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
            <textarea name="injuries" value={formData.injuries} onChange={handleChange} />
          </div>
        </div>

        <div className="form-row">
          <div>
            <label>Equipment Available</label>
            <textarea name="equipmentAvailable" value={formData.equipmentAvailable} onChange={handleChange} />
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
