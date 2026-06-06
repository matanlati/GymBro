import { useState, useEffect, useRef, FormEvent, ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getMe, updateMe, uploadPhoto, UserProfile, UpdateProfileData } from '../api/users.api'
import { AxiosError } from 'axios'

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
function IconSettings() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}
function IconChart() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  )
}
function IconLogout() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const photoInputRef = useRef<HTMLInputElement>(null)

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<UpdateProfileData>({})
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getMe().then(({ data }) => {
      setProfile(data)
      setForm({
        name: data.name, age: data.age, weightKg: data.weightKg,
        heightCm: data.heightCm, fitnessLevel: data.fitnessLevel,
        goals: data.goals, limitations: data.limitations,
      })
    }).catch(() => setError('Failed to load profile'))
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

  function handleLogout() {
    logout()
    navigate('/login')
  }

  function getInitials(name: string) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  if (!profile) {
    return <div style={styles.loading}>{error || 'Loading...'}</div>
  }

  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <h1 style={styles.pageTitle}>Profile</h1>
        <p style={styles.pageSubtitle}>Manage your account and preferences</p>
      </div>

      {/* Main profile card */}
      <div style={styles.card}>
        <div style={styles.banner} />

        <div style={styles.avatarWrapper}>
          <div style={styles.avatarContainer}>
            {profile.photo
              ? <img src={profile.photo} alt="Profile" style={styles.avatarImg} />
              : <div style={styles.avatar}>{getInitials(profile.name)}</div>
            }
          </div>
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            disabled={uploadingPhoto}
            style={styles.changePhotoBtn}
          >
            {uploadingPhoto ? 'Uploading…' : '📷 Change photo'}
          </button>
          <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
        </div>

        <div style={styles.identity}>
          <h2 style={styles.profileName}>{profile.name}</h2>
          <p style={styles.profileEmail}>{profile.email}</p>
        </div>

        {!editing ? (
          <>
            <div style={styles.sections}>
              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>Personal Information</h3>
                <InfoRow icon={<IconEmail />} label="Email" value={profile.email} />
                <InfoRow icon={<IconAge />} label="Age" value={profile.age ? `${profile.age} years` : '—'} />
                <InfoRow icon={<IconWeight />} label="Weight" value={profile.weightKg ? `${profile.weightKg} kg` : '—'} />
                <InfoRow icon={<IconHeight />} label="Height" value={profile.heightCm ? `${profile.heightCm} cm` : '—'} />
              </div>
              <div style={{ ...styles.section, borderRight: 'none' }}>
                <h3 style={styles.sectionTitle}>Fitness Profile</h3>
                <InfoRow icon={<IconLevel />} label="Fitness Level" value={profile.fitnessLevel ? profile.fitnessLevel.charAt(0).toUpperCase() + profile.fitnessLevel.slice(1) : '—'} />
                <InfoRow icon={<IconGoal />} label="Primary Goal" value={profile.goals || '—'} />
                <InfoRow icon={<IconCalendar />} label="Member Since" value={new Date(profile.createdAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })} />
              </div>
            </div>
            <div style={styles.cardFooter}>
              <button onClick={() => setEditing(true)} style={styles.editBtn}>Edit Profile</button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSave} style={styles.form}>
            <div style={styles.formGrid}>
              <Field label="Full name" name="name" type="text" value={form.name || ''} onChange={handleChange} />
              <Field label="Age" name="age" type="number" value={form.age ?? ''} onChange={handleChange} />
              <Field label="Weight (kg)" name="weightKg" type="number" value={form.weightKg ?? ''} onChange={handleChange} />
              <Field label="Height (cm)" name="heightCm" type="number" value={form.heightCm ?? ''} onChange={handleChange} />
              <div style={styles.fieldFull}>
                <label style={styles.label}>Fitness Level</label>
                <select name="fitnessLevel" value={form.fitnessLevel || ''} onChange={handleChange} style={styles.input}>
                  <option value="">Select</option>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
              <div style={styles.fieldFull}>
                <label style={styles.label}>Goals</label>
                <textarea name="goals" value={form.goals || ''} onChange={handleChange} style={{ ...styles.input, height: 72 }} />
              </div>
              <div style={styles.fieldFull}>
                <label style={styles.label}>Injuries / Limitations</label>
                <textarea name="limitations" value={form.limitations || ''} onChange={handleChange} style={{ ...styles.input, height: 72 }} />
              </div>
            </div>
            {error && <p style={styles.error}>{error}</p>}
            <div style={styles.formActions}>
              <button type="button" onClick={() => setEditing(false)} style={styles.cancelBtn}>Cancel</button>
              <button type="submit" disabled={saving} style={styles.saveBtn}>{saving ? 'Saving…' : 'Save Changes'}</button>
            </div>
          </form>
        )}
      </div>

      {/* Bottom row: Settings + Quick Stats */}
      <div style={styles.bottomRow}>
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <IconSettings />
            <span style={styles.cardTitle}>Settings</span>
          </div>
          <SettingsRow title="Notifications" desc="Manage workout reminders and updates" />
          <SettingsRow title="Privacy" desc="Control your data and visibility" />
          <SettingsRow title="Workout Preferences" desc="Customize your training plan" />
        </div>

        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <IconChart />
            <span style={styles.cardTitle}>Quick Stats</span>
          </div>
          <StatRow label="Total Workouts" value="—" color="#F97316" bg="#FFF7ED" />
          <StatRow label="Current Streak" value="—" color="#22C55E" bg="#F0FDF4" />
          <StatRow label="Personal Records" value="—" color="#3B82F6" bg="#EFF6FF" />
        </div>
      </div>

      {/* Log Out */}
      <button onClick={handleLogout} style={styles.logoutRow}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <IconLogout />
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

function SettingsRow({ title, desc }: { title: string; desc: string }) {
  return (
    <div style={styles.settingsRow}>
      <span style={styles.settingsTitle}>{title}</span>
      <span style={styles.settingsDesc}>{desc}</span>
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

function Field({ label, name, type, value, onChange }: {
  label: string; name: string; type: string
  value: string | number; onChange: (e: ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <div>
      <label style={styles.label}>{label}</label>
      <input type={type} name={name} value={value} onChange={onChange} style={styles.input} />
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
  loading: { padding: 48, textAlign: 'center', color: '#6B7280', fontFamily: 'system-ui' },
  pageHeader: { marginBottom: 24 },
  pageTitle: { fontSize: 26, fontWeight: 700, color: '#111827', margin: '0 0 4px' },
  pageSubtitle: { fontSize: 14, color: '#6B7280', margin: 0 },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    border: '1px solid #E5E7EB',
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
  changePhotoBtn: {
    fontSize: 12, fontWeight: 500, color: '#F97316',
    background: 'none', border: '1px solid #F97316',
    borderRadius: 6, padding: '4px 10px', cursor: 'pointer', marginBottom: 4,
  },

  identity: { padding: '0 24px 16px', borderBottom: '1px solid #F3F4F6' },
  profileName: { fontSize: 18, fontWeight: 700, color: '#111827', margin: '0 0 2px' },
  profileEmail: { fontSize: 13, color: '#6B7280', margin: 0 },

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
  editBtn: {
    padding: '8px 20px', fontSize: 14, fontWeight: 600,
    background: 'linear-gradient(to right, #F97316, #EF4444)',
    color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer',
  },

  form: { padding: '20px 24px' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' },
  fieldFull: { gridColumn: '1 / -1' },
  label: { display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 4 },
  input: {
    width: '100%', padding: '8px 10px', fontSize: 14,
    border: '1px solid #E5E7EB', borderRadius: 7, color: '#111827',
    boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' as const,
  },
  error: { fontSize: 13, color: '#EF4444', backgroundColor: '#FEF2F2', padding: '8px 12px', borderRadius: 6, margin: '12px 0 0' },
  formActions: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 },
  cancelBtn: {
    padding: '8px 18px', fontSize: 14, background: 'none',
    border: '1px solid #E5E7EB', borderRadius: 8, cursor: 'pointer', color: '#374151',
  },
  saveBtn: {
    padding: '8px 20px', fontSize: 14, fontWeight: 600,
    background: 'linear-gradient(to right, #F97316, #EF4444)',
    color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer',
  },

  bottomRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  cardHeader: { display: 'flex', alignItems: 'center', gap: 8, padding: '16px 20px', borderBottom: '1px solid #F3F4F6' },
  cardTitle: { fontSize: 14, fontWeight: 700, color: '#111827' },

  settingsRow: { padding: '12px 20px', borderBottom: '1px solid #F9FAFB', cursor: 'pointer' },
  settingsTitle: { display: 'block', fontSize: 13, fontWeight: 500, color: '#F97316', marginBottom: 2 },
  settingsDesc: { display: 'block', fontSize: 12, color: '#6B7280' },

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
