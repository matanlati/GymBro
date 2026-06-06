process.env.JWT_SECRET = 'test-middleware-secret'

import { Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { authMiddleware } from '../src/middleware/auth'
import { AuthRequest } from '../src/types'

const SECRET = process.env.JWT_SECRET

const makeReq = (accessToken?: string): AuthRequest =>
  ({ cookies: accessToken ? { accessToken } : {} } as unknown as AuthRequest)

const makeRes = () =>
  ({
    sendStatus: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response)

const makeNext = () => jest.fn() as NextFunction

describe('authMiddleware', () => {
  test('no accessToken cookie returns 401 and does not call next', () => {
    const res = makeRes()
    const next = makeNext()

    authMiddleware(makeReq(), res, next)

    expect((res.sendStatus as jest.Mock).mock.calls[0][0]).toBe(401)
    expect(next).not.toHaveBeenCalled()
  })

  test('valid token calls next and sets req.user', () => {
    const token = jwt.sign({ userId: 'user123', email: 'a@b.com' }, SECRET, { expiresIn: '1h' })
    const req = makeReq(token)
    const res = makeRes()
    const next = makeNext()

    authMiddleware(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(req.user?.userId).toBe('user123')
    expect(req.user?.email).toBe('a@b.com')
  })

  test('req.user.userId is set correctly from token payload', () => {
    const expectedId = 'abc123xyz'
    const token = jwt.sign({ userId: expectedId, email: 'x@y.com' }, SECRET, { expiresIn: '1h' })
    const req = makeReq(token)
    const next = makeNext()

    authMiddleware(req, makeRes(), next)

    expect(req.user?.userId).toBe(expectedId)
  })

  test('tampered token returns 401 and does not call next', () => {
    const token = jwt.sign({ userId: 'user123', email: 'a@b.com' }, SECRET, { expiresIn: '1h' })
    const tampered = token.slice(0, -1) + 'X'
    const res = makeRes()
    const next = makeNext()

    authMiddleware(makeReq(tampered), res, next)

    expect((res.sendStatus as jest.Mock).mock.calls[0][0]).toBe(401)
    expect(next).not.toHaveBeenCalled()
  })

  test('token signed with wrong secret returns 401', () => {
    const token = jwt.sign({ userId: 'user123', email: 'a@b.com' }, 'wrong-secret', { expiresIn: '1h' })
    const res = makeRes()
    const next = makeNext()

    authMiddleware(makeReq(token), res, next)

    expect((res.sendStatus as jest.Mock).mock.calls[0][0]).toBe(401)
    expect(next).not.toHaveBeenCalled()
  })

  test('expired token returns 401', async () => {
    const token = jwt.sign({ userId: 'user123', email: 'a@b.com' }, SECRET, { expiresIn: '1ms' })
    await new Promise((r) => setTimeout(r, 10))
    const res = makeRes()
    const next = makeNext()

    authMiddleware(makeReq(token), res, next)

    expect((res.sendStatus as jest.Mock).mock.calls[0][0]).toBe(401)
    expect(next).not.toHaveBeenCalled()
  })
})
