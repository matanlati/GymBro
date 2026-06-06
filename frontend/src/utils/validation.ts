const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim())
}

export function validateLoginForm(email: string, password: string): string | null {
  if (!email.trim() || !password) return 'Email and password are required'
  if (!isValidEmail(email)) return 'Please enter a valid email address'
  return null
}

export function validateRegisterForm(email: string, password: string, name: string): string | null {
  if (!email.trim() || !password || !name.trim()) return 'All fields are required'
  if (!isValidEmail(email)) return 'Please enter a valid email address'
  if (name.trim().length < 2) return 'Name must be at least 2 characters'
  if (password.length < 6) return 'Password must be at least 6 characters'
  if (password.length > 72) return 'Password must be less than 72 characters'
  return null
}
