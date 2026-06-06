import { Response } from 'express'
import { AuthRequest } from '../types'
import * as usersService from '../services/users.service'

export async function getMe(req: AuthRequest, res: Response) {
  try {
    const user = await usersService.getMe(req.user!.userId)
    return res.json(user)
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' })
    }
    throw err
  }
}

export async function updateMe(req: AuthRequest, res: Response) {
  try {
    const user = await usersService.updateMe(req.user!.userId, req.body)
    return res.json(user)
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' })
    }
    throw err
  }
}

export async function uploadPhoto(req: AuthRequest, res: Response) {
  if (!req.file) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'No image file provided' })
  }
  try {
    const user = await usersService.updatePhoto(req.user!.userId, req.file)
    return res.json(user)
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' })
    }
    throw err
  }
}
