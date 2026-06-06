const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(String(email).trim())
}

export function validateRegisterInput(email: string, password: string, name: string): string | null {
  if (!email?.trim() || !password || !name?.trim()) return 'email, password, and name are required'
  if (!isValidEmail(email)) return 'invalid email address'
  if (name.trim().length < 2) return 'name must be at least 2 characters'
  if (password.length < 6) return 'password must be at least 6 characters'
  if (password.length > 72) return 'password must be less than 72 characters'
  return null
}

export function validateLoginInput(email: string, password: string): string | null {
  if (!email?.trim() || !password) return 'email and password are required'
  if (!isValidEmail(email)) return 'invalid email address'
  return null
}
