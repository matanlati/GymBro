import { Request, Response, CookieOptions } from 'express'
import * as authService from '../services/auth.service'
import { validateRegisterInput, validateLoginInput } from '../utils/validation'

const IS_PROD = process.env.NODE_ENV === 'production'

const accessCookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: IS_PROD,
  maxAge: 15 * 60 * 1000,
}

const refreshCookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: IS_PROD,
  maxAge: 7 * 24 * 60 * 60 * 1000,
}

function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie('accessToken', accessToken, accessCookieOptions)
  res.cookie('refreshToken', refreshToken, refreshCookieOptions)
}

function clearAuthCookies(res: Response) {
  res.clearCookie('accessToken')
  res.clearCookie('refreshToken')
}

function validationError(res: Response, message: string) {
  return res.status(400).json({ error: 'VALIDATION_ERROR', message })
}

export async function register(req: Request, res: Response) {
  const { email, password, name } = req.body
  const role = req.body.role === 'coach' ? 'coach' : req.body.role === 'trainee' || req.body.role === undefined ? 'trainee' : null
  const err = validateRegisterInput(email, password, name)
  if (err) return validationError(res, err)
  if (!role) return validationError(res, 'role must be trainee or coach')

  try {
    const { accessToken, refreshToken, user } = await authService.registerUser(email, password, name, role)
    setAuthCookies(res, accessToken, refreshToken)
    return res.status(201).json({ user })
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'EMAIL_TAKEN') {
      return res.status(400).json({ error: 'EMAIL_TAKEN', message: 'An account with this email already exists' })
    }
    throw err
  }
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body
  const err = validateLoginInput(email, password)
  if (err) return validationError(res, err)

  try {
    const { accessToken, refreshToken, user } = await authService.loginUser(email, password)
    setAuthCookies(res, accessToken, refreshToken)
    return res.json({ user })
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'INVALID_CREDENTIALS') {
      return res.status(403).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid email or password' })
    }
    throw err
  }
}

export async function logout(_req: Request, res: Response) {
  clearAuthCookies(res)
  return res.sendStatus(200)
}

export async function refreshToken(req: Request, res: Response) {
  const token = req.cookies?.refreshToken
  if (!token) return res.sendStatus(401)

  try {
    const { accessToken, refreshToken: newRefreshToken } = await authService.refreshTokens(token)
    setAuthCookies(res, accessToken, newRefreshToken)
    return res.sendStatus(200)
  } catch {
    return res.sendStatus(401)
  }
}

export async function googleLogin(req: Request, res: Response) {
  const { credential } = req.body
  if (!credential) return validationError(res, 'credential is required')

  try {
    const { accessToken, refreshToken, user } = await authService.googleAuth(credential)
    setAuthCookies(res, accessToken, refreshToken)
    return res.json({ user })
  } catch (err) {
    console.error('[Google Auth]', err)
    return res.status(401).json({ error: 'GOOGLE_AUTH_FAILED', message: 'Google authentication failed' })
  }
}
