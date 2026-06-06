import { isValidEmail, validateRegisterInput, validateLoginInput } from '../src/utils/validation'

describe('isValidEmail', () => {
  test.each([
    'user@example.com',
    'user.name+tag@sub.domain.org',
    'a@b.co',
  ])('returns true for valid email: %s', (email) => {
    expect(isValidEmail(email)).toBe(true)
  })

  test.each([
    'notanemail',
    'missing@',
    '@nodomain.com',
    'no spaces @example.com',
    '',
    'user@',
  ])('returns false for invalid email: %s', (email) => {
    expect(isValidEmail(email)).toBe(false)
  })
})

describe('validateRegisterInput', () => {
  const valid = { email: 'user@example.com', password: 'pass123', name: 'Alice' }

  test('returns null for valid inputs', () => {
    expect(validateRegisterInput(valid.email, valid.password, valid.name)).toBeNull()
  })

  test('returns error when email is missing', () => {
    expect(validateRegisterInput('', valid.password, valid.name)).not.toBeNull()
  })

  test('returns error when password is missing', () => {
    expect(validateRegisterInput(valid.email, '', valid.name)).not.toBeNull()
  })

  test('returns error when name is missing', () => {
    expect(validateRegisterInput(valid.email, valid.password, '')).not.toBeNull()
  })

  test('returns error for invalid email format', () => {
    expect(validateRegisterInput('notanemail', valid.password, valid.name)).toBe('invalid email address')
  })

  test('returns error when name is 1 character', () => {
    expect(validateRegisterInput(valid.email, valid.password, 'A')).toBe('name must be at least 2 characters')
  })

  test('returns null when name is exactly 2 characters', () => {
    expect(validateRegisterInput(valid.email, valid.password, 'Al')).toBeNull()
  })

  test('returns error when password is shorter than 6 characters', () => {
    expect(validateRegisterInput(valid.email, 'abc', valid.name)).toBe('password must be at least 6 characters')
  })

  test('returns null when password is exactly 6 characters', () => {
    expect(validateRegisterInput(valid.email, 'abcdef', valid.name)).toBeNull()
  })

  test('returns error when password exceeds 72 characters', () => {
    expect(validateRegisterInput(valid.email, 'a'.repeat(73), valid.name)).toBe('password must be less than 72 characters')
  })

  test('returns null when password is exactly 72 characters', () => {
    expect(validateRegisterInput(valid.email, 'a'.repeat(72), valid.name)).toBeNull()
  })
})

describe('validateLoginInput', () => {
  test('returns null for valid inputs', () => {
    expect(validateLoginInput('user@example.com', 'pass123')).toBeNull()
  })

  test('returns error when email is missing', () => {
    expect(validateLoginInput('', 'pass123')).not.toBeNull()
  })

  test('returns error when password is missing', () => {
    expect(validateLoginInput('user@example.com', '')).not.toBeNull()
  })

  test('returns error for invalid email format', () => {
    expect(validateLoginInput('bademail', 'pass123')).toBe('invalid email address')
  })

  test('returns error for email missing domain', () => {
    expect(validateLoginInput('user@', 'pass123')).toBe('invalid email address')
  })
})
