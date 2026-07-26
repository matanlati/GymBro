import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { OAuth2Client } from 'google-auth-library'
import { User } from '../models/User.model'

const ACCESS_SECRET = () => process.env.JWT_SECRET as string
const REFRESH_SECRET = () => process.env.REFRESH_TOKEN_SECRET as string
type UserRole = 'trainee' | 'coach'

export function generateAccessToken(userId: string, email: string): string {
  return jwt.sign({ userId, email }, ACCESS_SECRET(), { expiresIn: '15m' } as jwt.SignOptions)
}

export function generateRefreshToken(userId: string): string {
  return jwt.sign({ userId }, REFRESH_SECRET(), { expiresIn: '7d' } as jwt.SignOptions)
}

export function verifyToken(token: string): { userId: string; email: string } {
  return jwt.verify(token, ACCESS_SECRET()) as { userId: string; email: string }
}

export function verifyRefreshToken(token: string): { userId: string } {
  return jwt.verify(token, REFRESH_SECRET()) as { userId: string }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

function tokenPair(userId: string, email: string) {
  return {
    accessToken: generateAccessToken(userId, email),
    refreshToken: generateRefreshToken(userId),
  }
}

function authUser(user: { _id: unknown; email: string; name: string; role?: UserRole; coachId?: unknown }) {
  return { _id: user._id, email: user.email, name: user.name, role: user.role ?? 'trainee', coachId: user.coachId }
}

export async function registerUser(email: string, password: string, name: string, role: UserRole = 'trainee') {
  const existing = await User.findOne({ email: email.toLowerCase() })
  if (existing) throw new Error('EMAIL_TAKEN')

  const passwordHash = await hashPassword(password)
  const user = await User.create({ email, passwordHash, name, role })
  return { ...tokenPair(user._id.toString(), user.email), user: authUser(user) }
}

export async function loginUser(email: string, password: string) {
  const user = await User.findOne({ email: email.toLowerCase() })
  if (!user) throw new Error('INVALID_CREDENTIALS')

  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) throw new Error('INVALID_CREDENTIALS')

  return { ...tokenPair(user._id.toString(), user.email), user: authUser(user) }
}

export async function refreshTokens(refreshToken: string) {
  const { userId } = verifyRefreshToken(refreshToken)
  const user = await User.findById(userId)
  if (!user) throw new Error('USER_NOT_FOUND')
  return tokenPair(user._id.toString(), user.email)
}

export async function googleAuth(credential: string) {
  const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
  const ticket = await client.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID })

  const payload = ticket.getPayload()
  if (!payload?.email) throw new Error('INVALID_GOOGLE_TOKEN')

  const { email, name, sub } = payload
  let user = await User.findOne({ email: email.toLowerCase() })
  if (!user) {
    const passwordHash = await hashPassword(sub + process.env.JWT_SECRET)
    user = await User.create({ email, passwordHash, name: name || email.split('@')[0], role: 'trainee' })
  }

  return { ...tokenPair(user._id.toString(), user.email), user: authUser(user) }
}
