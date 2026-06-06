import { Response, NextFunction } from 'express'
import { verifyToken } from '../services/auth.service'
import { AuthRequest } from '../types'

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.accessToken
  if (!token) return res.sendStatus(401)

  try {
    req.user = verifyToken(token)
    next()
  } catch {
    return res.sendStatus(401)
  }
}
