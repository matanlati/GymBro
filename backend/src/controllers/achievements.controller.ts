import { Response } from 'express'
import { AuthRequest } from '../types'
import { AchievementCategory } from '../models/AchievementUnlock.model'
import { listAchievements as listAchievementHistory } from '../services/achievements.service'

export const listAchievements = async (req: AuthRequest, res: Response) => {
  try {
    const category = typeof req.query.category === 'string'
      ? req.query.category as AchievementCategory
      : undefined
    const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined
    const achievements = await listAchievementHistory(req.user!.userId, category, limit)
    return res.json(achievements)
  } catch (err) {
    if (err instanceof Error && err.message === 'INVALID_ACHIEVEMENT_FILTERS') {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid achievement filters',
      })
    }
    console.error('Achievements controller error:', err)
    return res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: err instanceof Error ? err.message : 'Failed to list achievements',
    })
  }
}
