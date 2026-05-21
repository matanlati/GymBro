import { useState } from 'react'

const steps = [
  {
    title: 'Body Details',
    eyebrow: 'Help us understand your starting point'
  },
  {
    title: 'Training Preferences',
    eyebrow: 'Tell us how you want to train'
  },
  {
    title: 'Goals & Availability',
    eyebrow: 'Build the plan around your routine'
  }
]

const goalOptions = [
  { value: 'weight_loss', label: 'Lose Fat', icon: 'target' },
  { value: 'muscle_gain', label: 'Build Muscle', icon: 'dumbbell' },
  { value: 'strength', label: 'Strength', icon: 'bolt' },
  { value: 'endurance', label: 'Endurance', icon: 'rings' },
  { value: 'general_fitness', label: 'General Fitness', icon: 'home' }
]

const levelOptions = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' }
]

const workoutTypes = [
  { value: 'strength', label: 'Strength Training' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'mixed', label: 'Mixed Training' }
]

const equipmentOptions = ['Gym', 'Home', 'Dumbbells', 'Machines', 'Bodyweight', 'Barbell', 'Kettlebells']

function FormIcon({ name }) {
  const common = {
    width: '28',
    height: '28',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true'
  }

  switch (name) {
    case 'target':
      return <svg {...common}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></svg>
    case 'dumbbell':
      return <svg {...common}><path d="m6 6 12 12" /><path d="m4 8 4-4" /><path d="m16 20 4-4" /><path d="m2 10 8-8" /><path d="m14 22 8-8" /></svg>
    case 'bolt':
      return <svg {...common}><path d="M13 2 4 14h7l-1 8 9-12h-7Z" /></svg>
    case 'rings':
      return <svg {...common}><circle cx="9" cy="12" r="5" /><circle cx="15" cy="12" r="5" /></svg>
    case 'home':
      return <svg {...common}><path d="m3 10 9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></svg>
    case 'brand':
      return <svg {...common}><path d="m6 6 12 12" /><path d="m4 8 4-4" /><path d="m16 20 4-4" /><path d="m2 10 8-8" /><path d="m14 22 8-8" /></svg>
    default:
      return null
  }
}

function Questionnaire({ onBack }) {
  const [step, setStep] = useState(0)
  const [view, setView] = useState('form')
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
    equipmentAvailable: []
  })
  const [submitted, setSubmitted] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
  }

  const selectValue = (name, value) => {
    setFormData({ ...formData, [name]: value })
  }

  const toggleEquipment = (item) => {
    const selected = formData.equipmentAvailable.includes(item)
    const equipmentAvailable = selected
      ? formData.equipmentAvailable.filter((current) => current !== item)
      : [...formData.equipmentAvailable, item]

    setFormData({ ...formData, equipmentAvailable })
  }

  const nextStep = () => {
    setSubmitted(false)
    setStep((current) => Math.min(current + 1, steps.length - 1))
  }

  const previousStep = () => {
    setSubmitted(false)
    setStep((current) => Math.max(current - 1, 0))
  }

  const editAnswers = () => {
    setSubmitted(false)
    setError('')
    setView('form')
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    generateWorkoutPlan()
  }

  const buildPayload = () => ({
    ...formData,
    equipmentAvailable: formData.equipmentAvailable.length
      ? formData.equipmentAvailable.join(', ')
      : ''
  })

  const generateWorkoutPlan = async () => {
    setLoading(true)
    setSubmitted(false)
    setError('')
    setResult(null)

    try {
      const response = await fetch('/api/workout-plan/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload())
      })

      const text = await response.text()
      let data

      try {
        data = JSON.parse(text)
      } catch (parseError) {
        throw new Error(text || 'Invalid server response')
      }

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to generate workout plan')
      }

      setResult(data)
      setSubmitted(true)
      setView('result')
    } catch (requestError) {
      setError(requestError.message || 'Failed to generate workout plan')
    } finally {
      setLoading(false)
    }
  }

  const renderPlan = () => {
    if (!result) return null

    const dayCount = Array.isArray(result.weeklyPlan) ? result.weeklyPlan.length : 0
    const exerciseCount = Array.isArray(result.weeklyPlan)
      ? result.weeklyPlan.reduce((total, day) => total + (Array.isArray(day.exercises) ? day.exercises.length : 0), 0)
      : 0

    return (
      <main className="plan-page">
        <button className="questionnaire-back" type="button" onClick={onBack}>
          <span aria-hidden="true">←</span>
          Dashboard
        </button>

        <section className="plan-hero">
          <div>
            <span className="plan-kicker">Generated Workout Plan</span>
            <h1>Your {dayCount || formData.trainingDays || ''}-Day Training Plan</h1>
            {result.summary && <p>{result.summary}</p>}
          </div>
          <button className="secondary-action plan-edit-button" type="button" onClick={editAnswers}>
            Edit Answers
          </button>
        </section>

        <div className="plan-metrics" aria-label="Plan summary">
          <div>
            <span>{dayCount || '-'}</span>
            <p>Training Days</p>
          </div>
          <div>
            <span>{exerciseCount || '-'}</span>
            <p>Total Exercises</p>
          </div>
          <div>
            <span>{formData.trainingLevel || '-'}</span>
            <p>Level</p>
          </div>
          <div>
            <span>{formData.equipmentAvailable.length || '-'}</span>
            <p>Equipment Picks</p>
          </div>
        </div>

        {Array.isArray(result.weeklyPlan) && result.weeklyPlan.length > 0 && (
          <section className="generated-days">
            {result.weeklyPlan.map((day, index) => (
              <article className="generated-day-card" key={`${day.day}-${index}`}>
                <div className="generated-day-header">
                  <div>
                    <span>{day.day || `Day ${index + 1}`}</span>
                    <strong>{day.focus}</strong>
                  </div>
                  <small>{Array.isArray(day.exercises) ? day.exercises.length : 0} exercises</small>
                </div>

                {Array.isArray(day.exercises) && (
                  <ul className="generated-exercises">
                    {day.exercises.map((exercise, exerciseIndex) => (
                      <li key={`${exercise.name}-${exerciseIndex}`}>
                        <span className="exercise-number">{exerciseIndex + 1}</span>
                        <div>
                          <strong>{exercise.name}</strong>
                          {exercise.notes && <p>{exercise.notes}</p>}
                        </div>
                        <span className="exercise-dose">{exercise.sets} x {exercise.reps}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </section>
        )}

        <section className="plan-guidance-grid">
          {Array.isArray(result.safetyNotes) && result.safetyNotes.length > 0 && (
            <div className="generated-notes">
              <h3>Safety Notes</h3>
              <ul>
                {result.safetyNotes.map((note, index) => (
                  <li key={`${note}-${index}`}>{note}</li>
                ))}
              </ul>
            </div>
          )}

          {result.progressionNotes && (
            <div className="generated-notes">
              <h3>Progression</h3>
              <p>{result.progressionNotes}</p>
            </div>
          )}
        </section>
      </main>
    )
  }

  const renderStep = () => {
    if (step === 0) {
      return (
        <>
          <div className="form-field">
            <label htmlFor="age">Age</label>
            <input id="age" type="number" name="age" placeholder="28" value={formData.age} onChange={handleChange} required />
          </div>

          <div className="form-field">
            <label htmlFor="gender">Gender</label>
            <select id="gender" name="gender" value={formData.gender} onChange={handleChange} required>
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label htmlFor="weight">Weight (kg)</label>
              <input id="weight" type="number" name="weight" placeholder="75" value={formData.weight} onChange={handleChange} required />
            </div>
            <div className="form-field">
              <label htmlFor="height">Height (cm)</label>
              <input id="height" type="number" name="height" placeholder="178" value={formData.height} onChange={handleChange} required />
            </div>
          </div>

          <div className="info-strip">This information helps us create a more personalized workout plan for you</div>
        </>
      )
    }

    if (step === 1) {
      return (
        <>
          <div className="form-field">
            <label>Training Level</label>
            <div className="segmented-options">
              {levelOptions.map((option) => (
                <button
                  className={formData.trainingLevel === option.value ? 'segment-option active' : 'segment-option'}
                  key={option.value}
                  type="button"
                  onClick={() => selectValue('trainingLevel', option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-field">
            <label>Preferred Workout Type</label>
            <div className="segmented-options">
              {workoutTypes.map((option) => (
                <button
                  className={formData.preferredWorkoutType === option.value ? 'segment-option active' : 'segment-option'}
                  key={option.value}
                  type="button"
                  onClick={() => selectValue('preferredWorkoutType', option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="injuries">Injuries or Limitations</label>
            <textarea
              id="injuries"
              name="injuries"
              placeholder="Tell us about pain, past injuries, mobility limits, or exercises to avoid"
              value={formData.injuries}
              onChange={handleChange}
            />
          </div>
        </>
      )
    }

    return (
      <>
        <div className="form-field">
          <label>Primary Goal</label>
          <div className="goal-grid">
            {goalOptions.map((option) => (
              <button
                className={formData.fitnessGoal === option.value ? 'goal-card active' : 'goal-card'}
                key={option.value}
                type="button"
                onClick={() => selectValue('fitnessGoal', option.value)}
              >
                <FormIcon name={option.icon} />
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="trainingDays">Workouts per week</label>
          <select id="trainingDays" name="trainingDays" value={formData.trainingDays} onChange={handleChange} required>
            <option value="">Select frequency</option>
            <option value="2">2 days per week</option>
            <option value="3">3 days per week</option>
            <option value="4">4 days per week</option>
            <option value="5">5 days per week</option>
            <option value="6">6 days per week</option>
          </select>
        </div>

        <div className="form-field">
          <label>Equipment Access</label>
          <div className="chip-group">
            {equipmentOptions.map((item) => (
              <button
                className={formData.equipmentAvailable.includes(item) ? 'equipment-chip active' : 'equipment-chip'}
                key={item}
                type="button"
                onClick={() => toggleEquipment(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </>
    )
  }

  if (view === 'result' && result) {
    return renderPlan()
  }

  return (
    <main className="questionnaire-page">
      <button className="questionnaire-back" type="button" onClick={step === 0 ? onBack : previousStep}>
        <span aria-hidden="true">←</span>
        Back
      </button>

      <div className="questionnaire-brand">
        <span><FormIcon name="brand" /></span>
        <strong>GymBro</strong>
      </div>

      <div className="questionnaire-header">
        <h1>Create Your Workout Plan</h1>
        <p>Step {step + 1} of {steps.length}</p>
      </div>

      <div className="progress-steps" aria-label={`Step ${step + 1} of ${steps.length}`}>
        {steps.map((item, index) => (
          <span className={index <= step ? 'active' : ''} key={item.title} />
        ))}
      </div>

      <form className="questionnaire-card" onSubmit={handleSubmit}>
        <div className="questionnaire-card-header">
          <h2>{steps[step].title}</h2>
          <p>{steps[step].eyebrow}</p>
        </div>

        <div className="questionnaire-fields">
          {renderStep()}
        </div>

        <div className="questionnaire-actions">
          {step > 0 && (
            <button className="secondary-action" type="button" onClick={previousStep}>
              Back
            </button>
          )}
          {step < steps.length - 1 ? (
            <button className="primary-action" type="button" onClick={nextStep}>
              Continue
            </button>
          ) : (
            <button className="primary-action" type="submit" disabled={loading}>
              {loading ? 'Creating Plan...' : 'Create My Plan'}
            </button>
          )}
        </div>

        {error && <div className="error-strip">{error}</div>}

        {submitted && (
          <div className="success-strip">
            Your workout plan was generated successfully.
          </div>
        )}
      </form>
    </main>
  )
}

export default Questionnaire
