import { useState, useEffect, useRef, FormEvent, ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Button, Card, FormField, Input, LoadingState, PageHeader, Select, Textarea } from '@gymbro/ui-kit'
import { useAuth } from '../context/AuthContext'
import { getMe, updateMe, uploadPhoto, UserProfile, UpdateProfileData } from '../api/users.api'
import {
  BodyMeasurement,
  createMeasurement,
  getSummary,
  listMeasurements,
  ProgressSummary,
} from '../api/progress.api'
import { AxiosError } from 'axios'
import { BarChart2, LogOut, Camera, Scale } from 'lucide-react'

// ── SVG Icons ─────────────────────────────────────────────────────────────────
function IconEmail() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M2 7l10 7 10-7" />
    </svg>
  )
}
function IconAge() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  )
}
function IconWeight() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="6" r="3" />
      <path d="M6 6H4a2 2 0 0 0-2 2l2 12h16l2-12a2 2 0 0 0-2-2h-2" />
    </svg>
  )
}
function IconHeight() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20V4M8 8l4-4 4 4M8 16l4 4 4-4" />
    </svg>
  )
}
function IconLevel() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      <path d="M17 3l3 3-3 3" />
    </svg>
  )
}
function IconGoal() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  )
}
function IconCalendar() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const photoInputRef = useRef<HTMLInputElement>(null)

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [summary, setSummary] = useState<ProgressSummary | null>(null)
  const [weightEntries, setWeightEntries] = useState<WeightMeasurement[]>([])
  const [weighInValue, setWeighInValue] = useState('')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<UpdateProfileData>({})
  const [saving, setSaving] = useState(false)
  const [savingWeight, setSavingWeight] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [error, setError] = useState('')
  const [weightError, setWeightError] = useState('')

  useEffect(() => {
    getMe().then(({ data }) => {
      setProfile(data)
      setForm({
        name: data.name, age: data.age, weightKg: data.weightKg,
        heightCm: data.heightCm, fitnessLevel: data.fitnessLevel,
        goals: data.goals, limitations: data.limitations,
      })
    }).catch(() => setError('Failed to load profile'))
    getSummary()
      .then(({ data }) => setSummary(data))
      .catch(() => setSummary(null))
    listMeasurements({ limit: 90 })
      .then(({ data }) => setWeightEntries(toWeightMeasurements(data)))
      .catch(() => setWeightEntries([]))
  }, [])

  function handleChange(e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = e.target
    setForm(prev => ({
      ...prev,
      [name]: ['age', 'weightKg', 'heightCm'].includes(name) ? (value ? Number(value) : undefined) : value,
    }))
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const { data } = await updateMe(form)
      setProfile(data)
      const { data: measurements } = await listMeasurements({ limit: 90 })
      setWeightEntries(toWeightMeasurements(measurements))
      setEditing(false)
    } catch (err) {
      const axiosErr = err as AxiosError<{ message: string }>
      setError(axiosErr.response?.data?.message || 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  async function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true)
    try {
      const { data } = await uploadPhoto(file)
      setProfile(data)
    } catch {
      setError('Failed to upload photo')
    } finally {
      setUploadingPhoto(false)
      if (photoInputRef.current) photoInputRef.current.value = ''
    }
  }

  async function handleWeighIn(e: FormEvent) {
    e.preventDefault()
    const weightKg = Number(weighInValue)
    if (!Number.isFinite(weightKg)) {
      setWeightError('Enter a valid weight')
      return
    }

    setSavingWeight(true)
    setWeightError('')
    try {
      const { data } = await createMeasurement({ weightKg })
      setWeightEntries(prev => mergeWeightMeasurement(prev, data))
      setProfile(prev => prev ? { ...prev, weightKg: data.weightKg } : prev)
      setForm(prev => ({ ...prev, weightKg: data.weightKg }))
      setWeighInValue('')
    } catch (err) {
      const axiosErr = err as AxiosError<{ message: string }>
      setWeightError(axiosErr.response?.data?.message || 'Failed to save weigh-in')
    } finally {
      setSavingWeight(false)
    }
  }

  function handleLogout() {
    logout()
    navigate('/login')
  }

  function getInitials(name: string) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  const formatGoal = (goal?: string) =>
    goal
      ? goal.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
      : '-'

  const formatLevel = (level?: string) =>
    level ? level.charAt(0).toUpperCase() + level.slice(1) : '-'

  const formatVolume = (kg: number) =>
    kg >= 1000 ? `${(kg / 1000).toFixed(1)}k kg` : `${Math.round(kg)} kg`

  const latestWeight = weightEntries.length > 0 ? weightEntries[weightEntries.length - 1].weightKg : profile?.weightKg

  const hasTrainingInfo = !!(
    profile?.age ||
    profile?.weightKg ||
    profile?.heightCm ||
    profile?.fitnessLevel ||
    profile?.goals ||
    profile?.limitations
  )

  if (!profile) {
    return (
      <div style={styles.page}>
        {error ? <Alert variant="error">{error}</Alert> : <LoadingState />}
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <PageHeader title="Profile" subtitle="Manage your account and preferences" />

      {/* Main profile card */}
      <Card padding="none" style={styles.card}>
        <div style={styles.banner} />

        <div style={styles.avatarWrapper}>
          <div style={styles.avatarContainer}>
            {profile.photo
              ? <img src={profile.photo} alt="Profile" style={styles.avatarImg} />
              : <div style={styles.avatar}>{getInitials(profile.name)}</div>
            }
          </div>
          <Button
            variant="outline"
            size="sm"
            leadingIcon={<Camera size={13} strokeWidth={1.8} />}
            loading={uploadingPhoto}
            loadingLabel="Uploading…"
            onClick={() => photoInputRef.current?.click()}
            style={{ minHeight: 28, padding: '4px 10px', fontSize: 12, marginBottom: 4 }}
          >
            Change photo
          </Button>
          <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
        </div>

        <div style={styles.identity}>
          <h2 style={styles.profileName}>{profile.name}</h2>
          <p style={styles.profileEmail}>{profile.email}</p>
        </div>

        {!editing ? (
          <>
            {!hasTrainingInfo && (
              <div style={styles.profilePrompt}>
                <strong>Add your info to receive the best results.</strong>
                <span>Create a workout plan or edit your profile so GymBro can personalize your training.</span>
                <div style={styles.profilePromptActions}>
                  <Button size="sm" onClick={() => navigate('/plans/new')}>Create Plan</Button>
                  <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>Add Info</Button>
                </div>
              </div>
            )}
            <div style={styles.sections}>
              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>Personal Information</h3>
                <InfoRow icon={<IconEmail />} label="Email" value={profile.email} />
                <InfoRow icon={<IconAge />} label="Age" value={profile.age ? `${profile.age} years` : '-'} />
                <InfoRow icon={<IconWeight />} label="Weight" value={profile.weightKg ? `${profile.weightKg} kg` : '-'} />
                <InfoRow icon={<IconHeight />} label="Height" value={profile.heightCm ? `${profile.heightCm} cm` : '-'} />
              </div>
              <div style={{ ...styles.section, borderRight: 'none' }}>
                <h3 style={styles.sectionTitle}>Fitness Profile</h3>
                <InfoRow icon={<IconLevel />} label="Fitness Level" value={formatLevel(profile.fitnessLevel)} />
                <InfoRow icon={<IconGoal />} label="Primary Goal" value={formatGoal(profile.goals)} />
                <InfoRow icon={<IconCalendar />} label="Member Since" value={new Date(profile.createdAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })} />
              </div>
            </div>
            <div style={styles.cardFooter}>
              <Button size="sm" onClick={() => setEditing(true)}>Edit Profile</Button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSave} style={styles.form}>
            <div style={styles.formGrid}>
              <FormField label="Full name">
                <Input name="name" type="text" value={form.name || ''} onChange={handleChange} />
              </FormField>
              <FormField label="Age">
                <Input name="age" type="number" value={form.age ?? ''} onChange={handleChange} />
              </FormField>
              <FormField label="Weight (kg)">
                <Input name="weightKg" type="number" min="20" max="400" step="0.1" value={form.weightKg ?? ''} onChange={handleChange} />
              </FormField>
              <FormField label="Height (cm)">
                <Input name="heightCm" type="number" value={form.heightCm ?? ''} onChange={handleChange} />
              </FormField>
              <FormField label="Fitness Level" style={styles.fieldFull}>
                <Select
                  name="fitnessLevel"
                  placeholder="Select"
                  options={[
                    { value: 'beginner', label: 'Beginner' },
                    { value: 'intermediate', label: 'Intermediate' },
                    { value: 'advanced', label: 'Advanced' },
                  ]}
                  value={form.fitnessLevel || ''}
                  onValueChange={(value) => setForm(prev => ({ ...prev, fitnessLevel: value }))}
                />
              </FormField>
              <FormField label="Goals" style={styles.fieldFull}>
                <Textarea name="goals" value={form.goals || ''} onChange={handleChange} style={{ minHeight: 72 }} />
              </FormField>
              <FormField label="Injuries / Limitations" style={styles.fieldFull}>
                <Textarea name="limitations" value={form.limitations || ''} onChange={handleChange} style={{ minHeight: 72 }} />
              </FormField>
            </div>
            {error && (
              <Alert variant="error" style={{ marginTop: 12 }}>
                {error}
              </Alert>
            )}
            <div style={styles.formActions}>
              <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
              <Button type="submit" size="sm" loading={saving} loadingLabel="Saving…">Save Changes</Button>
            </div>
          </form>
        )}
      </Card>

      {/* Bottom row: Weight + Quick Stats */}
      <div style={styles.bottomRow}>
        <Card padding="none" style={styles.card}>
          <div style={styles.cardHeader}>
            <Scale size={16} color="#6B7280" strokeWidth={1.8} />
            <span style={styles.cardTitle}>Weight Progress</span>
          </div>
          <form onSubmit={handleWeighIn} style={styles.weighInForm}>
            <div style={styles.weighInInputRow}>
              <Input
                type="number"
                min="20"
                max="400"
                step="0.1"
                placeholder="Weight in kg"
                value={weighInValue}
                onChange={(e) => setWeighInValue(e.target.value)}
              />
              <Button type="submit" size="sm" loading={savingWeight} loadingLabel="Saving...">Add</Button>
            </div>
            {weightError && <span style={styles.weightError}>{weightError}</span>}
          </form>
          <WeightChart entries={weightEntries} />
          <div style={styles.weightMeta}>
            <span>Latest</span>
            <strong>{latestWeight ? `${latestWeight} kg` : '-'}</strong>
          </div>
        </Card>

        <Card padding="none" style={styles.card}>
          <div style={styles.cardHeader}>
            <BarChart2 size={16} color="#6B7280" strokeWidth={1.8} />
            <span style={styles.cardTitle}>Quick Stats</span>
          </div>
          <StatRow label="Total Workouts" value={String(summary?.totalSessions ?? 0)} color="#F97316" bg="#FFF7ED" />
          <StatRow label="Current Streak" value={`${summary?.currentStreakDays ?? 0} days`} color="#22C55E" bg="#F0FDF4" />
          <StatRow label="Total Volume" value={formatVolume(summary?.totalVolumeKg ?? 0)} color="#EF4444" bg="#FEF2F2" />
          <StatRow label="Personal Records" value={String(summary?.personalRecords.length ?? 0)} color="#3B82F6" bg="#EFF6FF" />
        </Card>
      </div>

      {/* Log Out */}
      <button onClick={handleLogout} style={styles.logoutRow}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <LogOut size={16} color="#EF4444" strokeWidth={1.8} />
          Log Out
        </span>
        <span style={styles.logoutArrow}>→</span>
      </button>
    </div>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={styles.infoRow}>
      <span style={styles.infoIcon}>{icon}</span>
      <div style={styles.infoText}>
        <span style={styles.infoLabel}>{label}</span>
        <span style={styles.infoValue} title={value}>{value}</span>
      </div>
    </div>
  )
}

function StatRow({ label, value, color, bg }: { label: string; value: string; color: string; bg: string }) {
  return (
    <div style={{ ...styles.statRow, backgroundColor: bg }}>
      <span style={styles.statLabel}>{label}</span>
      <span style={{ ...styles.statValue, color }}>{value}</span>
    </div>
  )
}

type WeightMeasurement = BodyMeasurement & { weightKg: number }

const toWeightMeasurements = (measurements: BodyMeasurement[]): WeightMeasurement[] =>
  measurements
    .filter((measurement): measurement is WeightMeasurement => measurement.weightKg !== undefined)
    .sort((left, right) => (
      new Date(left.measuredAt).getTime() - new Date(right.measuredAt).getTime()
    ))

const mergeWeightMeasurement = (
  measurements: WeightMeasurement[],
  measurement: BodyMeasurement
): WeightMeasurement[] => measurement.weightKg === undefined
  ? measurements
  : toWeightMeasurements([...measurements, measurement])

function WeightChart({ entries }: { entries: WeightMeasurement[] }) {
  const width = 320
  const height = 130
  const plotLeft = 44
  const plotRight = 306
  const plotTop = 16
  const plotBottom = 98
  const values = entries.map(entry => entry.weightKg)

  if (entries.length < 2) {
    return (
      <div style={styles.chartEmpty}>
        <span>{entries.length === 1 ? 'Add another weigh-in to see your trend.' : 'No weigh-ins yet.'}</span>
      </div>
    )
  }

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = Math.max(max - min, 1)
  const points = values.map((value, index) => {
    const x = plotLeft + (index / (values.length - 1)) * (plotRight - plotLeft)
    const y = plotBottom - ((value - min) / range) * (plotBottom - plotTop)
    return { x, y, value, entry: entries[index] }
  })
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
  const firstDate = new Date(entries[0].measuredAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
  const lastDate = new Date(entries[entries.length - 1].measuredAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })

  return (
    <div style={styles.chartWrap}>
      <svg viewBox={`0 0 ${width} ${height}`} style={styles.chartSvg} role="img" aria-label="Weight progression chart">
        <line x1={plotLeft} y1={plotBottom} x2={plotRight} y2={plotBottom} stroke="#E5E7EB" strokeWidth="1" />
        <line x1={plotLeft} y1={plotTop} x2={plotLeft} y2={plotBottom} stroke="#E5E7EB" strokeWidth="1" />
        <text x="4" y={plotTop + 4} fill="#9CA3AF" fontSize="10">{max} kg</text>
        <text x="4" y={plotBottom + 4} fill="#9CA3AF" fontSize="10">{min} kg</text>
        <text x={plotLeft} y="122" fill="#9CA3AF" fontSize="10">{firstDate}</text>
        <text x={plotRight} y="122" fill="#9CA3AF" fontSize="10" textAnchor="end">{lastDate}</text>
        <path d={path} fill="none" stroke="#F97316" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {points.map(point => (
          <circle key={point.entry._id} cx={point.x} cy={point.y} r="4" fill="#FFFFFF" stroke="#F97316" strokeWidth="2">
            <title>{`${point.value} kg on ${new Date(point.entry.measuredAt).toLocaleDateString('en-GB')}`}</title>
          </circle>
        ))}
      </svg>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#F5F7FA',
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    padding: '32px 24px 48px',
    maxWidth: 800,
    margin: '0 auto',
  },

  card: {
    overflow: 'hidden',
    marginBottom: 16,
  },
  banner: { height: 80, background: 'linear-gradient(to right, #F97316, #EF4444)' },

  avatarWrapper: {
    marginTop: -48,
    paddingLeft: 24,
    marginBottom: 12,
    display: 'flex',
    alignItems: 'flex-end',
    gap: 14,
  },
  avatarContainer: {
    width: 96,
    height: 96,
    borderRadius: 14,
    overflow: 'hidden',
    border: '4px solid #fff',
    flexShrink: 0,
    boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
  },
  avatar: {
    width: '100%',
    height: '100%',
    background: '#F97316',
    color: '#fff',
    fontSize: 32,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },

  identity: { padding: '0 24px 16px', borderBottom: '1px solid #F3F4F6' },
  profileName: { fontSize: 18, fontWeight: 700, color: '#111827', margin: '0 0 2px' },
  profileEmail: { fontSize: 13, color: '#6B7280', margin: 0 },

  profilePrompt: {
    display: 'grid',
    gap: 8,
    margin: '18px 24px 0',
    padding: 16,
    border: '1px solid #FED7AA',
    borderRadius: 10,
    background: '#FFF7ED',
  },
  profilePromptActions: {
    display: 'flex',
    gap: 10,
    marginTop: 4,
  },

  sections: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 },
  section: { padding: '20px 24px', borderRight: '1px solid #F3F4F6' },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: '#111827', margin: '0 0 14px' },

  infoRow: { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '6px 0', minWidth: 0 },
  infoIcon: { marginTop: 2, flexShrink: 0 },
  infoText: { display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 },
  infoLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: 400 },
  infoValue: {
    fontSize: 13, fontWeight: 500, color: '#111827',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },

  cardFooter: { padding: '16px 24px', borderTop: '1px solid #F3F4F6' },

  form: { padding: '20px 24px' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' },
  fieldFull: { gridColumn: '1 / -1' },
  formActions: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 },

  bottomRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  cardHeader: { display: 'flex', alignItems: 'center', gap: 8, padding: '16px 20px', borderBottom: '1px solid #F3F4F6' },
  cardTitle: { fontSize: 14, fontWeight: 700, color: '#111827' },

  weighInForm: { padding: '14px 20px 8px', display: 'grid', gap: 8 },
  weighInInputRow: { display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center' },
  weightError: { fontSize: 12, color: '#DC2626' },
  chartWrap: { padding: '4px 20px 8px' },
  chartSvg: { display: 'block', width: '100%', height: 130 },
  chartEmpty: {
    margin: '10px 20px 8px',
    height: 130,
    border: '1px dashed #E5E7EB',
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#6B7280',
    fontSize: 12,
    textAlign: 'center',
    padding: 16,
    boxSizing: 'border-box',
  },
  weightMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 20px 14px',
    borderTop: '1px solid #F3F4F6',
    fontSize: 13,
    color: '#6B7280',
  },

  statRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '12px 20px', borderBottom: '1px solid #F9FAFB',
  },
  statLabel: { fontSize: 13, color: '#374151', fontWeight: 400 },
  statValue: { fontSize: 18, fontWeight: 700 },

  logoutRow: {
    width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '16px 20px', backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB',
    borderRadius: 12, cursor: 'pointer', fontSize: 14, fontWeight: 500, color: '#EF4444',
    boxSizing: 'border-box',
  },
  logoutArrow: { color: '#EF4444', fontSize: 16 },
}
