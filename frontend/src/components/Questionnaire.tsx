import { useState } from 'react'
import { generatePlan } from '../api/plans.api'
import { AxiosError } from 'axios'

const levelOptions = [
  { label: 'Beginner', value: 'beginner' },
  { label: 'Intermediate', value: 'intermediate' },
  { label: 'Advanced', value: 'advanced' },
]

const workoutTypes = [
  { label: 'Strength', value: 'strength' },
  { label: 'Cardio', value: 'cardio' },
  { label: 'Mixed', value: 'mixed' },
]

const initialForm = {
  age: '',
  gender: '',
  height: '',
  weight: '',
  fitnessGoal: '',
  trainingLevel: '',
  trainingDays: '',
  injuries: '',
  preferredWorkoutType: '',
  equipmentAvailable: '',
}

const Questionnaire = ({ onBack }: { onBack: () => void }) => {
  const [formData, setFormData] = useState(initialForm)
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const selectValue = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data } = await generatePlan(formData)
      setResult(data)
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string; error?: string }>
      setError(
        axiosErr.response?.data?.message ||
          axiosErr.message ||
          'Failed to generate workout plan'
      )
    } finally {
      setLoading(false)
    }
  }

  if (result && !result.error) {
    const totalExercises =
      result.weeklyPlan?.reduce(
        (sum: number, d: any) => sum + (d.exercises?.length ?? 0),
        0
      ) ?? 0

    return (
      <div style={s.page}>
        <button style={s.backBtn} onClick={() => setResult(null)}>
          ← Edit Answers
        </button>

        <div style={s.planHero}>
          <span style={s.kicker}>Generated Workout Plan</span>
          <h1 style={s.heroTitle}>
            Your {formData.trainingDays}-Day Training Plan
          </h1>
          {result.summary && <p style={s.heroSub}>{result.summary}</p>}
        </div>

        <div style={s.metrics}>
          <MetricCard label="Training Days" value={formData.trainingDays || '-'} />
          <MetricCard label="Total Exercises" value={String(totalExercises)} />
          <MetricCard label="Level" value={formData.trainingLevel || '-'} />
          <MetricCard
            label="Goal"
            value={(formData.fitnessGoal || '-').replace('_', ' ')}
          />
        </div>

        <button style={s.backBtn} onClick={onBack}>
          ← Back to Dashboard
        </button>
      </div>
    )
  }

  return (
    <div style={s.page}>
      <button style={s.backBtn} onClick={onBack}>
        ← Back
      </button>

      <div style={s.header}>
        <h1 style={s.title}>Create Your Workout Plan</h1>
        <p style={s.subtitle}>Fill in your details and get a personalised plan</p>
      </div>

      <form onSubmit={handleSubmit} style={s.card}>
        <div style={s.formGrid}>
          <input
            style={s.input}
            type="number"
            name="age"
            placeholder="Age"
            value={formData.age}
            onChange={handleChange}
            required
          />

          <select
            style={s.input}
            name="gender"
            value={formData.gender}
            onChange={handleChange}
            required
          >
            <option value="">Select gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>

          <input
            style={s.input}
            type="number"
            name="height"
            placeholder="Height (cm)"
            value={formData.height}
            onChange={handleChange}
            required
          />

          <input
            style={s.input}
            type="number"
            name="weight"
            placeholder="Weight (kg)"
            value={formData.weight}
            onChange={handleChange}
            required
          />

          <select
            style={s.input}
            name="fitnessGoal"
            value={formData.fitnessGoal}
            onChange={handleChange}
            required
          >
            <option value="">Fitness Goal</option>
            <option value="weight_loss">Weight Loss</option>
            <option value="muscle_gain">Muscle Gain</option>
            <option value="strength">Strength</option>
            <option value="endurance">Endurance</option>
          </select>

          <input
            style={s.input}
            type="number"
            name="trainingDays"
            min={1}
            max={7}
            placeholder="Training days per week"
            value={formData.trainingDays}
            onChange={handleChange}
            required
          />

          <div style={s.fieldFull}>
            <label style={s.label}>Training Level</label>
            <div style={s.segments}>
              {levelOptions.map(o => (
                <button
                  key={o.value}
                  type="button"
                  style={{
                    ...s.segment,
                    ...(formData.trainingLevel === o.value
                      ? s.segmentActive
                      : {}),
                  }}
                  onClick={() => selectValue('trainingLevel', o.value)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div style={s.fieldFull}>
            <label style={s.label}>Preferred Workout Type</label>
            <div style={s.segments}>
              {workoutTypes.map(o => (
                <button
                  key={o.value}
                  type="button"
                  style={{
                    ...s.segment,
                    ...(formData.preferredWorkoutType === o.value
                      ? s.segmentActive
                      : {}),
                  }}
                  onClick={() => selectValue('preferredWorkoutType', o.value)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <textarea
            style={{ ...s.input, height: 72 }}
            name="injuries"
            placeholder="Injuries or limitations"
            value={formData.injuries}
            onChange={handleChange}
          />

          <textarea
            style={{ ...s.input, height: 72 }}
            name="equipmentAvailable"
            placeholder="Equipment available"
            value={formData.equipmentAvailable}
            onChange={handleChange}
          />
        </div>

        {error && <p style={s.error}>{error}</p>}

        <button type="submit" disabled={loading} style={s.submitBtn}>
          {loading ? 'Generating plan...' : 'Generate My Plan'}
        </button>
      </form>
    </div>
  )
}

const MetricCard = ({ label, value }: { label: string; value: string }) => {
  return (
    <div style={s.metricCard}>
      <span style={s.metricValue}>{value}</span>
      <span style={s.metricLabel}>{label}</span>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 800,
    margin: '0 auto',
    padding: '32px 24px 48px',
    fontFamily: 'system-ui, sans-serif',
    backgroundColor: '#F5F7FA',
    minHeight: '100vh',
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: '#6B7280',
    fontSize: 14,
    cursor: 'pointer',
    padding: '0 0 24px',
  },
  header: { marginBottom: 24 },
  title: { fontSize: 26, fontWeight: 700 },
  subtitle: { fontSize: 14, color: '#6B7280' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    border: '1px solid #E5E7EB',
    padding: 24,
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 16,
  },
  fieldFull: { gridColumn: '1 / -1' },
  label: { fontSize: 13, fontWeight: 500, marginBottom: 6 },
  input: {
    width: '100%',
    padding: 10,
    border: '1px solid #E5E7EB',
    borderRadius: 8,
  },
  segments: { display: 'flex', gap: 8 },
  segment: {
    flex: 1,
    padding: 8,
    border: '1px solid #E5E7EB',
    borderRadius: 8,
    background: '#fff',
  },
  segmentActive: {
    background: '#EF4444',
    color: '#fff',
  },
  error: { color: 'red' },
  submitBtn: {
    width: '100%',
    padding: 12,
    marginTop: 16,
    background: '#EF4444',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
  },
  planHero: { marginBottom: 24 },
  kicker: { fontSize: 12, color: '#F97316' },
  heroTitle: { fontSize: 22, fontWeight: 700 },
  heroSub: { color: '#6B7280' },
  metrics: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 },
  metricCard: {
    background: '#fff',
    padding: 12,
    borderRadius: 10,
    textAlign: 'center',
  },
  metricValue: { fontSize: 18, fontWeight: 700 },
  metricLabel: { fontSize: 12, color: '#9CA3AF' },
}

export default Questionnaire;