import { useState, FormEvent } from 'react'
import { Link, useNavigate, Navigate } from 'react-router-dom'
import { GoogleLogin, CredentialResponse } from '@react-oauth/google'
import { useAuth } from '../context/AuthContext'
import { validateRegisterForm } from '../utils/validation'
import { AxiosError } from 'axios'

export default function RegisterPage() {
  const { register, googleLogin, user } = useAuth()
  const navigate = useNavigate()

  if (user) return <Navigate to="/home" replace />
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const validationErr = validateRegisterForm(email, password, name)
    if (validationErr) { setError(validationErr); return }
    setError('')
    setLoading(true)
    try {
      await register(email, password, name)
      navigate('/home')
    } catch (err) {
      const axiosErr = err as AxiosError<{ message: string }>
      setError(axiosErr.response?.data?.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleSuccess(credentialResponse: CredentialResponse) {
    if (!credentialResponse.credential) return
    setError('')
    setLoading(true)
    try {
      await googleLogin(credentialResponse.credential)
      navigate('/home')
    } catch {
      setError('Google login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.heading}>Create your account</h1>
        <p style={styles.subtitle}>Welcome! Please fill in the details to get started.</p>

        <div style={styles.googleWrapper}>
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => setError('Google login failed. Please try again.')}
            text="continue_with"
            shape="rectangular"
            width="100%"
          />
        </div>

        <div style={styles.divider}>
          <span style={styles.dividerLine} />
          <span style={styles.dividerText}>or</span>
          <span style={styles.dividerLine} />
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Full name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              required
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <div style={styles.passwordWrapper}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                style={{ ...styles.input, paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                style={styles.eyeBtn}
                aria-label="Toggle password visibility"
              >
                {showPassword ? '🙈' : '👁'}
              </button>
            </div>
            <span style={styles.hint}>Minimum 6 characters</span>
          </div>

          {error && <p style={styles.error}>{error}</p>}

          <button type="submit" disabled={loading} style={styles.submitBtn}>
            {loading ? 'Creating account…' : 'Continue →'}
          </button>
        </form>

        <div style={styles.footer}>
          <span style={styles.footerText}>Already have an account? </span>
          <Link to="/login" style={styles.footerLink}>Sign in</Link>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#F5F7FA',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    boxShadow: '0 2px 16px rgba(0,0,0,0.08)',
    padding: '40px 36px 0',
    width: '100%',
    maxWidth: 420,
  },
  heading: {
    fontSize: 26,
    fontWeight: 700,
    color: '#111827',
    margin: '0 0 8px',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    margin: '0 0 24px',
    textAlign: 'center',
  },
  googleWrapper: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: 20,
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: 500,
    color: '#374151',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    fontSize: 14,
    border: '1px solid #E5E7EB',
    borderRadius: 8,
    outline: 'none',
    color: '#111827',
    boxSizing: 'border-box',
  },
  passwordWrapper: {
    position: 'relative',
  },
  eyeBtn: {
    position: 'absolute',
    right: 10,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 16,
    padding: 4,
  },
  hint: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  error: {
    fontSize: 13,
    color: '#EF4444',
    margin: 0,
    padding: '8px 12px',
    backgroundColor: '#FEF2F2',
    borderRadius: 6,
  },
  submitBtn: {
    width: '100%',
    padding: '12px',
    fontSize: 15,
    fontWeight: 600,
    color: '#FFFFFF',
    background: 'linear-gradient(to right, #F97316, #EF4444)',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    marginTop: 4,
  },
  footer: {
    backgroundColor: '#F9FAFB',
    borderTop: '1px solid #E5E7EB',
    margin: '24px -36px 0',
    padding: '16px 36px',
    textAlign: 'center',
    borderRadius: '0 0 12px 12px',
  },
  footerText: {
    fontSize: 14,
    color: '#6B7280',
  },
  footerLink: {
    fontSize: 14,
    fontWeight: 600,
    color: '#F97316',
    textDecoration: 'none',
  },
}
