import { useState } from 'react'

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
  age: '', gender: '', height: '', weight: '',
  fitnessGoal: '', trainingLevel: '', trainingDays: '',
  injuries: '', preferredWorkoutType: '', equipmentAvailable: '',
}

export default function Questionnaire({ onBack }) {
  const [formData, setFormData] = useState(initialForm)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handleChange(e) {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function selectValue(name, value) {
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/workout-plan/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const text = await response.text()
      let data
      try { data = JSON.parse(text) } catch { data = { error: text || 'Invalid server response' } }
      setResult(data)
    } catch (err) {
      setError(err.message || 'Failed to generate workout plan')
    } finally {
      setLoading(false)
    }
  }

  if (result && !result.error) {
    const totalExercises = result.weeklyPlan?.reduce((sum, d) => sum + (d.exercises?.length ?? 0), 0) ?? 0
    return (
      <div style={s.page}>
        <button style={s.backBtn} onClick={() => setResult(null)}>← Edit Answers</button>
        <div style={s.planHero}>
          <span style={s.kicker}>Generated Workout Plan</span>
          <h1 style={s.heroTitle}>Your {formData.trainingDays}-Day Training Plan</h1>
          {result.summary && <p style={s.heroSub}>{result.summary}</p>}
        </div>
        <div style={s.metrics}>
          <MetricCard label="Training Days" value={formData.trainingDays || '-'} />
          <MetricCard label="Total Exercises" value={String(totalExercises)} />
          <MetricCard label="Level" value={formData.trainingLevel || '-'} />
          <MetricCard label="Goal" value={(formData.fitnessGoal || '-').replace('_', ' ')} />
        </div>
        {Array.isArray(result.weeklyPlan) && result.weeklyPlan.length > 0 && (
          <div style={s.section}>
            <h3 style={s.sectionTitle}>Weekly Plan</h3>
            <div style={s.planGrid}>
              {result.weeklyPlan.map((day, i) => (
                <div style={s.planCard} key={i}>
                  <div style={s.planCardHeader}>
                    <span style={s.dayLabel}>{day.day || `Day ${i + 1}`}</span>
                    <strong style={s.dayFocus}>{day.focus}</strong>
                  </div>
                  <ul style={s.exerciseList}>
                    {day.exercises?.map((ex, j) => (
                      <li style={s.exerciseItem} key={j}>
                        <strong style={s.exName}>{ex.name}</strong>
                        <span style={s.exMeta}>{ex.sets} sets · {ex.reps} reps</span>
                        {ex.notes && <p style={s.exNotes}>{ex.notes}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
        {Array.isArray(result.safetyNotes) && result.safetyNotes.length > 0 && (
          <div style={s.section}>
            <h3 style={s.sectionTitle}>Safety Notes</h3>
            <ul style={s.notesList}>
              {result.safetyNotes.map((note, i) => <li key={i} style={s.noteItem}>{note}</li>)}
            </ul>
          </div>
        )}
        {result.progressionNotes && (
          <div style={s.section}>
            <h3 style={s.sectionTitle}>Progression</h3>
            <p style={s.progressionText}>{result.progressionNotes}</p>
          </div>
        )}
        <button style={s.backBtn} onClick={onBack}>← Back to Dashboard</button>
      </div>
    )
  }

  return (
    <div style={s.page}>
      <button style={s.backBtn} onClick={onBack}>← Back</button>
      <div style={s.header}>
        <h1 style={s.title}>Create Your Workout Plan</h1>
        <p style={s.subtitle}>Fill in your details and get a personalised plan</p>
      </div>
      <form onSubmit={handleSubmit} style={s.card}>
        <div style={s.formGrid}>
          <div>
            <label style={s.label}>Age</label>
            <input style={s.input} type="number" name="age" placeholder="28" value={formData.age} onChange={handleChange} required />
          </div>
          <div>
            <label style={s.label}>Gender</label>
            <select style={s.input} name="gender" value={formData.gender} onChange={handleChange} required>
              <option value="">Select</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label style={s.label}>Height (cm)</label>
            <input style={s.input} type="number" name="height" value={formData.height} onChange={handleChange} required />
          </div>
          <div>
            <label style={s.label}>Weight (kg)</label>
            <input style={s.input} type="number" name="weight" value={formData.weight} onChange={handleChange} required />
          </div>
          <div>
            <label style={s.label}>Fitness Goal</label>
            <select style={s.input} name="fitnessGoal" value={formData.fitnessGoal} onChange={handleChange} required>
              <option value="">Select</option>
              <option value="weight_loss">Weight Loss</option>
              <option value="muscle_gain">Muscle Gain</option>
              <option value="strength">Strength</option>
              <option value="endurance">Endurance</option>
            </select>
          </div>
          <div>
            <label style={s.label}>Training Days / Week</label>
            <input style={s.input} type="number" name="trainingDays" min="1" max="7" value={formData.trainingDays} onChange={handleChange} required />
          </div>
          <div style={s.fieldFull}>
            <label style={s.label}>Training Level</label>
            <div style={s.segments}>
              {levelOptions.map(o => (
                <button key={o.value} type="button"
                  style={{ ...s.segment, ...(formData.trainingLevel === o.value ? s.segmentActive : {}) }}
                  onClick={() => selectValue('trainingLevel', o.value)}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div style={s.fieldFull}>
            <label style={s.label}>Preferred Workout Type</label>
            <div style={s.segments}>
              {workoutTypes.map(o => (
                <button key={o.value} type="button"
                  style={{ ...s.segment, ...(formData.preferredWorkoutType === o.value ? s.segmentActive : {}) }}
                  onClick={() => selectValue('preferredWorkoutType', o.value)}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div style={s.fieldFull}>
            <label style={s.label}>Injuries or Limitations</label>
            <textarea style={{ ...s.input, height: 72 }} name="injuries" value={formData.injuries} onChange={handleChange} />
          </div>
          <div style={s.fieldFull}>
            <label style={s.label}>Equipment Available</label>
            <textarea style={{ ...s.input, height: 72 }} name="equipmentAvailable" value={formData.equipmentAvailable} onChange={handleChange} />
          </div>
        </div>
        {error && <p style={s.error}>{error}</p>}
        <button type="submit" disabled={loading} style={s.submitBtn}>
          {loading ? 'Generating plan...' : 'Generate My Plan'}
        </button>
      </form>
    </div>
  )
}

function MetricCard({ label, value }) {
  return (
    <div style={s.metricCard}>
      <span style={s.metricValue}>{value}</span>
      <span style={s.metricLabel}>{label}</span>
    </div>
  )
}

const s = {
  page: { maxWidth: 800, margin: '0 auto', padding: '32px 24px 48px', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', backgroundColor: '#F5F7FA', minHeight: '100vh' },
  backBtn: { background: 'none', border: 'none', color: '#6B7280', fontSize: 14, cursor: 'pointer', padding: '0 0 24px', display: 'block' },
  header: { marginBottom: 24 },
  title: { fontSize: 26, fontWeight: 700, color: '#111827', margin: '0 0 6px' },
  subtitle: { fontSize: 14, color: '#6B7280', margin: 0 },
  card: { backgroundColor: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: '28px 28px 24px' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px', marginBottom: 20 },
  fieldFull: { gridColumn: '1 / -1' },
  label: { display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 5 },
  input: { width: '100%', padding: '9px 12px', fontSize: 14, border: '1px solid #E5E7EB', borderRadius: 8, color: '#111827', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' },
  segments: { display: 'flex', gap: 8 },
  segment: { flex: 1, padding: '8px', fontSize: 13, fontWeight: 500, border: '1px solid #E5E7EB', borderRadius: 8, background: '#fff', color: '#374151', cursor: 'pointer' },
  segmentActive: { background: 'linear-gradient(to right, #F97316, #EF4444)', color: '#fff', border: '1px solid transparent' },
  error: { fontSize: 13, color: '#EF4444', backgroundColor: '#FEF2F2', padding: '10px 14px', borderRadius: 8, marginBottom: 16, borderLeft: '3px solid #EF4444' },
  submitBtn: { width: '100%', padding: '12px', fontSize: 15, fontWeight: 600, background: 'linear-gradient(to right, #F97316, #EF4444)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' },
  planHero: { marginBottom: 24 },
  kicker: { fontSize: 12, fontWeight: 600, color: '#F97316', textTransform: 'uppercase', letterSpacing: '0.05em' },
  heroTitle: { fontSize: 26, fontWeight: 700, color: '#111827', margin: '6px 0 8px' },
  heroSub: { fontSize: 14, color: '#6B7280', margin: 0 },
  metrics: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 },
  metricCard: { backgroundColor: '#fff', borderRadius: 10, border: '1px solid #E5E7EB', padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 },
  metricValue: { fontSize: 22, fontWeight: 700, color: '#111827', textTransform: 'capitalize' },
  metricLabel: { fontSize: 12, color: '#9CA3AF' },
  section: { marginBottom: 28 },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: '#111827', margin: '0 0 14px' },
  planGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 },
  planCard: { backgroundColor: '#fff', borderRadius: 10, border: '1px solid #E5E7EB', overflow: 'hidden' },
  planCardHeader: { padding: '12px 14px', background: 'linear-gradient(to right, #F97316, #EF4444)', display: 'flex', flexDirection: 'column', gap: 2 },
  dayLabel: { fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: 500 },
  dayFocus: { fontSize: 14, color: '#fff' },
  exerciseList: { listStyle: 'none', margin: 0, padding: '8px 14px 12px' },
  exerciseItem: { padding: '8px 0', borderBottom: '1px solid #F9FAFB' },
  exName: { display: 'block', fontSize: 13, color: '#111827', marginBottom: 2 },
  exMeta: { fontSize: 12, color: '#9CA3AF' },
  exNotes: { fontSize: 12, color: '#6B7280', margin: '4px 0 0' },
  notesList: { paddingLeft: 20, margin: 0 },
  noteItem: { fontSize: 14, color: '#374151', padding: '4px 0' },
  progressionText: { fontSize: 14, color: '#374151', lineHeight: 1.6, margin: 0 },
}
