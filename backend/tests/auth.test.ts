import { Request, Response } from 'express'

process.env.JWT_SECRET = 'test-secret'
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret'
process.env.GOOGLE_CLIENT_ID = 'test-client-id'

jest.mock('../src/models/User.model')
jest.mock('google-auth-library')

import { User } from '../src/models/User.model'
import { OAuth2Client } from 'google-auth-library'
import { register, login, logout, refreshToken, googleLogin } from '../src/controllers/auth.controller'
import { hashPassword, generateRefreshToken } from '../src/services/auth.service'

const MockUser = User as jest.Mocked<typeof User>
const MockOAuth2Client = OAuth2Client as jest.MockedClass<typeof OAuth2Client>

const makeReq = (body: Record<string, unknown> = {}, cookies: Record<string, string> = {}): Request =>
  ({ body, cookies } as unknown as Request)

const makeRes = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    sendStatus: jest.fn().mockReturnThis(),
    cookie: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis(),
  } as unknown as jest.Mocked<Response>
  return res
}

const fakeUser = { _id: 'id1', email: 'user@example.com', name: 'Alice' }

beforeEach(() => jest.clearAllMocks())

// ── Register ──────────────────────────────────────────────────────────────────

describe('Auth — Register', () => {
  test('valid registration returns 201 and sets auth cookies', async () => {
    MockUser.findOne = jest.fn().mockResolvedValue(null)
    MockUser.create = jest.fn().mockResolvedValue(fakeUser)

    const res = makeRes()
    await register(makeReq({ email: 'user@example.com', password: 'password123', name: 'Alice' }), res)

    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.cookie).toHaveBeenCalledWith('accessToken', expect.any(String), expect.any(Object))
    expect(res.cookie).toHaveBeenCalledWith('refreshToken', expect.any(String), expect.any(Object))
    expect(res.json).toHaveBeenCalledWith({ user: expect.objectContaining({ email: 'user@example.com' }) })
  })

  test('missing email returns 400', async () => {
    const res = makeRes()
    await register(makeReq({ password: 'pass123', name: 'Alice' }), res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.cookie).not.toHaveBeenCalled()
  })

  test('missing password returns 400', async () => {
    const res = makeRes()
    await register(makeReq({ email: 'a@b.com', name: 'Alice' }), res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  test('missing name returns 400', async () => {
    const res = makeRes()
    await register(makeReq({ email: 'a@b.com', password: 'pass123' }), res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  test('invalid email format returns 400', async () => {
    const res = makeRes()
    await register(makeReq({ email: 'notanemail', password: 'pass123', name: 'Alice' }), res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'VALIDATION_ERROR', message: 'invalid email address' }))
  })

  test('email missing @ returns 400', async () => {
    const res = makeRes()
    await register(makeReq({ email: 'userexample.com', password: 'pass123', name: 'Alice' }), res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  test('name shorter than 2 characters returns 400', async () => {
    const res = makeRes()
    await register(makeReq({ email: 'a@b.com', password: 'pass123', name: 'A' }), res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'name must be at least 2 characters' }))
  })

  test('password shorter than 6 characters returns 400', async () => {
    const res = makeRes()
    await register(makeReq({ email: 'a@b.com', password: 'abc', name: 'Alice' }), res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'password must be at least 6 characters' }))
  })

  test('password longer than 72 characters returns 400', async () => {
    const res = makeRes()
    await register(makeReq({ email: 'a@b.com', password: 'a'.repeat(73), name: 'Alice' }), res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'password must be less than 72 characters' }))
  })

  test('duplicate email returns 400 with EMAIL_TAKEN error', async () => {
    MockUser.findOne = jest.fn().mockResolvedValue(fakeUser)

    const res = makeRes()
    await register(makeReq({ email: 'user@example.com', password: 'password123', name: 'Alice' }), res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'EMAIL_TAKEN' }))
  })

  test('response body does not expose passwordHash', async () => {
    MockUser.findOne = jest.fn().mockResolvedValue(null)
    MockUser.create = jest.fn().mockResolvedValue(fakeUser)

    const res = makeRes()
    await register(makeReq({ email: 'user@example.com', password: 'password123', name: 'Alice' }), res)

    const body = (res.json as jest.Mock).mock.calls[0][0]
    expect(body.user.passwordHash).toBeUndefined()
  })

  test('accessToken cookie is HttpOnly', async () => {
    MockUser.findOne = jest.fn().mockResolvedValue(null)
    MockUser.create = jest.fn().mockResolvedValue(fakeUser)

    const res = makeRes()
    await register(makeReq({ email: 'user@example.com', password: 'password123', name: 'Alice' }), res)

    const accessCall = (res.cookie as jest.Mock).mock.calls.find(([name]: [string]) => name === 'accessToken')
    expect(accessCall[2]).toMatchObject({ httpOnly: true })
  })
})

// ── Login ─────────────────────────────────────────────────────────────────────

describe('Auth — Login', () => {
  test('valid credentials set auth cookies and return user', async () => {
    const passwordHash = await hashPassword('password123')
    MockUser.findOne = jest.fn().mockResolvedValue({ ...fakeUser, passwordHash })

    const res = makeRes()
    await login(makeReq({ email: 'user@example.com', password: 'password123' }), res)

    expect(res.cookie).toHaveBeenCalledWith('accessToken', expect.any(String), expect.any(Object))
    expect(res.cookie).toHaveBeenCalledWith('refreshToken', expect.any(String), expect.any(Object))
    expect(res.json).toHaveBeenCalledWith({ user: expect.objectContaining({ email: 'user@example.com' }) })
  })

  test('missing email returns 400', async () => {
    const res = makeRes()
    await login(makeReq({ password: 'pass123' }), res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.cookie).not.toHaveBeenCalled()
  })

  test('missing password returns 400', async () => {
    const res = makeRes()
    await login(makeReq({ email: 'user@example.com' }), res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  test('invalid email format returns 400', async () => {
    const res = makeRes()
    await login(makeReq({ email: 'bademail', password: 'pass123' }), res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'VALIDATION_ERROR', message: 'invalid email address' }))
  })

  test('email missing domain returns 400', async () => {
    const res = makeRes()
    await login(makeReq({ email: 'user@', password: 'pass123' }), res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  test('wrong password returns 403', async () => {
    const passwordHash = await hashPassword('correct')
    MockUser.findOne = jest.fn().mockResolvedValue({ ...fakeUser, passwordHash })

    const res = makeRes()
    await login(makeReq({ email: 'user@example.com', password: 'wrong' }), res)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.cookie).not.toHaveBeenCalled()
  })

  test('non-existent email returns 403', async () => {
    MockUser.findOne = jest.fn().mockResolvedValue(null)

    const res = makeRes()
    await login(makeReq({ email: 'nobody@example.com', password: 'pass' }), res)

    expect(res.status).toHaveBeenCalledWith(403)
  })

  test('login response does not expose passwordHash', async () => {
    const passwordHash = await hashPassword('password123')
    MockUser.findOne = jest.fn().mockResolvedValue({ ...fakeUser, passwordHash })

    const res = makeRes()
    await login(makeReq({ email: 'user@example.com', password: 'password123' }), res)

    const body = (res.json as jest.Mock).mock.calls[0][0]
    expect(body.user.passwordHash).toBeUndefined()
  })
})

// ── Logout ────────────────────────────────────────────────────────────────────

describe('Auth — Logout', () => {
  test('logout clears cookies and returns 200', async () => {
    const res = makeRes()
    await logout(makeReq(), res)

    expect(res.clearCookie).toHaveBeenCalledWith('accessToken')
    expect(res.clearCookie).toHaveBeenCalledWith('refreshToken')
    expect(res.sendStatus).toHaveBeenCalledWith(200)
  })
})

// ── Refresh Token ─────────────────────────────────────────────────────────────

describe('Auth — Refresh Token', () => {
  test('valid refresh token rotates both cookies and returns 200', async () => {
    MockUser.findById = jest.fn().mockResolvedValue(fakeUser)
    const token = generateRefreshToken(fakeUser._id)

    const res = makeRes()
    await refreshToken(makeReq({}, { refreshToken: token }), res)

    expect(res.cookie).toHaveBeenCalledWith('accessToken', expect.any(String), expect.any(Object))
    expect(res.cookie).toHaveBeenCalledWith('refreshToken', expect.any(String), expect.any(Object))
    expect(res.sendStatus).toHaveBeenCalledWith(200)
  })

  test('missing refresh token cookie returns 401', async () => {
    const res = makeRes()
    await refreshToken(makeReq({}), res)

    expect(res.sendStatus).toHaveBeenCalledWith(401)
    expect(res.cookie).not.toHaveBeenCalled()
  })

  test('invalid refresh token returns 401', async () => {
    const res = makeRes()
    await refreshToken(makeReq({}, { refreshToken: 'bad.token.here' }), res)

    expect(res.sendStatus).toHaveBeenCalledWith(401)
    expect(res.cookie).not.toHaveBeenCalled()
  })
})

// ── Google Login ──────────────────────────────────────────────────────────────

describe('Auth — Google Login', () => {
  const googlePayload = { email: 'google@example.com', name: 'Google User', sub: 'sub123' }

  function mockGoogleClient(payload: typeof googlePayload | null) {
    const getPayload = jest.fn().mockReturnValue(payload)
    const verifyIdToken = jest.fn().mockResolvedValue({ getPayload })
    MockOAuth2Client.mockImplementation(() => ({ verifyIdToken }) as unknown as OAuth2Client)
  }

  test('missing credential returns 400', async () => {
    const res = makeRes()
    await googleLogin(makeReq({}), res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  test('new Google user is created, cookies set, user returned', async () => {
    mockGoogleClient(googlePayload)
    MockUser.findOne = jest.fn().mockResolvedValue(null)
    MockUser.create = jest.fn().mockResolvedValue({ _id: 'gid1', ...googlePayload })

    const res = makeRes()
    await googleLogin(makeReq({ credential: 'valid-cred' }), res)

    expect(MockUser.create).toHaveBeenCalledTimes(1)
    expect(res.cookie).toHaveBeenCalledWith('accessToken', expect.any(String), expect.any(Object))
    expect(res.json).toHaveBeenCalledWith({ user: expect.objectContaining({ email: googlePayload.email }) })
  })

  test('existing Google user returned without creating a new one', async () => {
    mockGoogleClient(googlePayload)
    MockUser.findOne = jest.fn().mockResolvedValue({ _id: 'gid2', ...googlePayload })

    const res = makeRes()
    await googleLogin(makeReq({ credential: 'valid-cred' }), res)

    expect(MockUser.create).not.toHaveBeenCalled()
    expect(res.cookie).toHaveBeenCalledWith('accessToken', expect.any(String), expect.any(Object))
  })

  test('invalid Google token returns 401', async () => {
    mockGoogleClient(null)

    const res = makeRes()
    await googleLogin(makeReq({ credential: 'bad-cred' }), res)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.cookie).not.toHaveBeenCalled()
  })
})
