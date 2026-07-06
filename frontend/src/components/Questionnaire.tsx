import { useState } from 'react'
import { AxiosError } from 'axios'
import { Alert, Button, Card, FormField, FormRow, Input, Select, Textarea } from '@gymbro/ui-kit'
import { generatePlan, type WorkoutPlan } from '../api/plans.api'

type StepInfo = {
  title: string
  eyebrow: string
}

const steps: StepInfo[] = [
  {
    title: 'Body Details',
    eyebrow: 'Help us understand your starting point',
  },
  {
    title: 'Training Preferences',
    eyebrow: 'Tell us how you want to train',
  },
  {
    title: 'Goals & Availability',
    eyebrow: 'Build the plan around your routine',
  },
]

type Option = { value: string; label: string }
type GoalOption = Option & { icon: IconName }

const goalOptions: GoalOption[] = [
  { value: 'weight_loss', label: 'Lose Fat', icon: 'target' },
  { value: 'muscle_gain', label: 'Build Muscle', icon: 'dumbbell' },
  { value: 'strength', label: 'Strength', icon: 'bolt' },
  { value: 'endurance', label: 'Endurance', icon: 'rings' },
  { value: 'general_fitness', label: 'General Fitness', icon: 'home' },
]

const levelOptions: Option[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
]

const workoutTypes: Option[] = [
  { value: 'strength', label: 'Strength Training' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'mixed', label: 'Mixed Training' },
]

const equipmentOptions = [
  'Gym',
  'Home',
  'Dumbbells',
  'Machines',
  'Bodyweight',
  'Barbell',
  'Kettlebells',
]

type IconName = 'target' | 'dumbbell' | 'bolt' | 'rings' | 'home' | 'brand'

function FormIcon({ name }: { name: IconName }) {
  const common = {
    width: '28',
    height: '28',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }

  switch (name) {
    case 'target':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="1" />
        </svg>
      )
    case 'dumbbell':
      return (
        <svg {...common}>
          <path d="m6 6 12 12" />
          <path d="m4 8 4-4" />
          <path d="m16 20 4-4" />
          <path d="m2 10 8-8" />
          <path d="m14 22 8-8" />
        </svg>
      )
    case 'bolt':
      return (
        <svg {...common}>
          <path d="M13 2 4 14h7l-1 8 9-12h-7Z" />
        </svg>
      )
    case 'rings':
      return (
        <svg {...common}>
          <circle cx="9" cy="12" r="5" />
          <circle cx="15" cy="12" r="5" />
        </svg>
      )
    case 'home':
      return (
        <svg {...common}>
          <path d="m3 10 9-7 9 7" />
          <path d="M5 10v10h14V10" />
          <path d="M10 20v-6h4v6" />
        </svg>
      )
    case 'brand':
      return (
        <svg {...common}>
          <path d="m6 6 12 12" />
          <path d="m4 8 4-4" />
          <path d="m16 20 4-4" />
          <path d="m2 10 8-8" />
          <path d="m14 22 8-8" />
        </svg>
      )
    default:
      return null
  }
}

type FormData = {
  age: string
  gender: string
  height: string
  weight: string
  fitnessGoal: string
  trainingLevel: string
  trainingDays: string
  injuries: string
  preferredWorkoutType: string
  equipmentAvailable: string[]
}

type View = 'form' | 'result'

function Questionnaire({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState(0)
  const [view, setView] = useState<View>('form')
  const [formData, setFormData] = useState<FormData>({
    age: '',
    gender: '',
    height: '',
    weight: '',
    fitnessGoal: '',
    trainingLevel: '',
    trainingDays: '',
    injuries: '',
    preferredWorkoutType: '',
    equipmentAvailable: [],
  })
  const [submitted, setSubmitted] = useState(false)
  const [result, setResult] = useState<WorkoutPlan | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
  }

  const selectValue = (name: keyof FormData, value: string) => {
    setFormData({ ...formData, [name]: value })
  }

  const toggleEquipment = (item: string) => {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    generateWorkoutPlan()
  }

  const buildPayload = () => ({
    ...formData,
    equipmentAvailable: formData.equipmentAvailable.length
      ? formData.equipmentAvailable.join(', ')
      : '',
  })

  const generateWorkoutPlan = async () => {
    setLoading(true)
    setSubmitted(false)
    setError('')
    setResult(null)

    try {
      const { data } = await generatePlan(buildPayload())
      setResult(data)
      setSubmitted(true)
      setView('result')
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string; error?: string }>
      setError(
        axiosErr.response?.data?.message ||
          axiosErr.response?.data?.error ||
          axiosErr.message ||
          'Failed to generate workout plan'
      )
    } finally {
      setLoading(false)
    }
  }

  const renderPlan = () => {
    if (!result) return null

    const dayCount = Array.isArray(result.weeklyPlan) ? result.weeklyPlan.length : 0
    const exerciseCount = Array.isArray(result.weeklyPlan)
      ? result.weeklyPlan.reduce(
          (total, day) =>
            total + (Array.isArray(day.exercises) ? day.exercises.length : 0),
          0
        )
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
          <Button variant="inverse" size="lg" className="plan-edit-button" onClick={editAnswers}>
            Edit Answers
          </Button>
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
                  <small>
                    {Array.isArray(day.exercises) ? day.exercises.length : 0} exercises
                  </small>
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
                        <span className="exercise-dose">
                          {exercise.sets} x {exercise.reps}
                        </span>
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
          <FormField label="Age">
            <Input
              type="number"
              name="age"
              placeholder="28"
              value={formData.age}
              onChange={handleChange}
              required
            />
          </FormField>

          <FormField label="Gender">
            <Select
              name="gender"
              placeholder="Select gender"
              options={[
                { value: 'male', label: 'Male' },
                { value: 'female', label: 'Female' },
                { value: 'other', label: 'Other' },
              ]}
              value={formData.gender}
              onValueChange={(value) => selectValue('gender', value)}
              required
            />
          </FormField>

          <FormRow>
            <FormField label="Weight (kg)">
              <Input
                type="number"
                name="weight"
                placeholder="75"
                value={formData.weight}
                onChange={handleChange}
                required
              />
            </FormField>
            <FormField label="Height (cm)">
              <Input
                type="number"
                name="height"
                placeholder="178"
                value={formData.height}
                onChange={handleChange}
                required
              />
            </FormField>
          </FormRow>

          <Alert variant="info">
            This information helps us create a more personalized workout plan for you
          </Alert>
        </>
      )
    }

    if (step === 1) {
      return (
        <>
          <FormField label="Training Level">
            <div className="segmented-options">
              {levelOptions.map((option) => (
                <button
                  className={
                    formData.trainingLevel === option.value
                      ? 'segment-option active'
                      : 'segment-option'
                  }
                  key={option.value}
                  type="button"
                  onClick={() => selectValue('trainingLevel', option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </FormField>

          <FormField label="Preferred Workout Type">
            <div className="segmented-options">
              {workoutTypes.map((option) => (
                <button
                  className={
                    formData.preferredWorkoutType === option.value
                      ? 'segment-option active'
                      : 'segment-option'
                  }
                  key={option.value}
                  type="button"
                  onClick={() => selectValue('preferredWorkoutType', option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </FormField>

          <FormField label="Injuries or Limitations">
            <Textarea
              name="injuries"
              placeholder="Tell us about pain, past injuries, mobility limits, or exercises to avoid"
              value={formData.injuries}
              onChange={handleChange}
            />
          </FormField>
        </>
      )
    }

    return (
      <>
        <FormField label="Primary Goal">
          <div className="goal-grid">
            {goalOptions.map((option) => (
              <button
                className={
                  formData.fitnessGoal === option.value
                    ? 'goal-card active'
                    : 'goal-card'
                }
                key={option.value}
                type="button"
                onClick={() => selectValue('fitnessGoal', option.value)}
              >
                <FormIcon name={option.icon} />
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </FormField>

        <FormField label="Workouts per week">
          <Select
            name="trainingDays"
            placeholder="Select frequency"
            options={[
              { value: '2', label: '2 days per week' },
              { value: '3', label: '3 days per week' },
              { value: '4', label: '4 days per week' },
              { value: '5', label: '5 days per week' },
              { value: '6', label: '6 days per week' },
            ]}
            value={formData.trainingDays}
            onValueChange={(value) => selectValue('trainingDays', value)}
            required
          />
        </FormField>

        <FormField label="Equipment Access">
          <div className="chip-group">
            {equipmentOptions.map((item) => (
              <button
                className={
                  formData.equipmentAvailable.includes(item)
                    ? 'equipment-chip active'
                    : 'equipment-chip'
                }
                key={item}
                type="button"
                onClick={() => toggleEquipment(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </FormField>
      </>
    )
  }

  if (view === 'result' && result) {
    return renderPlan()
  }

  return (
    <main className="questionnaire-page">
      <button
        className="questionnaire-back"
        type="button"
        onClick={step === 0 ? onBack : previousStep}
      >
        <span aria-hidden="true">←</span>
        Back
      </button>

      <div className="questionnaire-brand">
        <span>
          <FormIcon name="brand" />
        </span>
        <strong>GymBro</strong>
      </div>

      <div className="questionnaire-header">
        <h1>Create Your Workout Plan</h1>
        <p>
          Step {step + 1} of {steps.length}
        </p>
      </div>

      <div
        className="progress-steps"
        aria-label={`Step ${step + 1} of ${steps.length}`}
      >
        {steps.map((item, index) => (
          <span className={index <= step ? 'active' : ''} key={item.title} />
        ))}
      </div>

      <Card as="form" padding="none" className="questionnaire-card" onSubmit={handleSubmit}>
        <div className="questionnaire-card-header">
          <h2>{steps[step].title}</h2>
          <p>{steps[step].eyebrow}</p>
        </div>

        <div className="questionnaire-fields">{renderStep()}</div>

        <div className="questionnaire-actions">
          {step > 0 && (
            <Button size="lg" variant="secondary" className="secondary-action" onClick={previousStep}>
              Back
            </Button>
          )}
          {step < steps.length - 1 ? (
            <Button size="lg" className="primary-action" onClick={nextStep}>
              Continue
            </Button>
          ) : (
            <Button
              size="lg"
              type="submit"
              className="primary-action"
              loading={loading}
              loadingLabel="Creating Plan..."
            >
              Create My Plan
            </Button>
          )}
        </div>

        {error && (
          <Alert variant="error" style={{ marginTop: 22 }}>
            {error}
          </Alert>
        )}

        {submitted && (
          <Alert variant="success" style={{ marginTop: 22 }}>
            Your workout plan was generated successfully.
          </Alert>
        )}
      </Card>
    </main>
  )
}

export default Questionnaire
