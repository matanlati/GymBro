import { Response } from 'express'
import { AuthRequest } from '../types'
import * as postsService from '../services/posts.service'

const handleError = (res: Response, err: unknown) => {
  const message = err instanceof Error ? err.message : 'Failed to process post request'
  switch (message) {
    case 'INVALID_SESSION':
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'sessionId is invalid' })
    case 'INVALID_POST':
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'postId is invalid' })
    case 'POST_NOT_FOUND':
      return res.status(404).json({ error: 'POST_NOT_FOUND', message: 'Post not found' })
    case 'INVALID_COMMENT':
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'comment is required' })
    case 'CANNOT_LIKE_OWN_POST':
      return res.status(403).json({ error: 'CANNOT_LIKE_OWN_POST', message: 'You can only like other posts' })
    case 'SESSION_NOT_FOUND':
      return res.status(404).json({ error: 'SESSION_NOT_FOUND', message: 'Choose one of your completed workouts' })
    case 'INVALID_WORKOUT_NAME':
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'workoutName is required' })
    case 'INVALID_POST_TITLE':
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'title is required' })
    case 'INVALID_POST_DATE':
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'postDate must be a valid date' })
    case 'INVALID_FEED_SCOPE':
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'scope must be all or trainees' })
    case 'COACH_ONLY':
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Only coaches can filter by trainees' })
    case 'USER_NOT_FOUND':
      return res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User not found' })
    default:
      console.error('Posts controller error:', err)
      return res.status(500).json({ error: 'INTERNAL_ERROR', message })
  }
}

export const listPosts = async (req: AuthRequest, res: Response) => {
  try {
    const requestedScope = req.query.scope ?? 'all'
    if (requestedScope !== 'all' && requestedScope !== 'trainees') throw new Error('INVALID_FEED_SCOPE')
    const posts = await postsService.listPosts(req.user!.userId, requestedScope)
    return res.json(posts)
  } catch (err) {
    return handleError(res, err)
  }
}

export const createPost = async (req: AuthRequest, res: Response) => {
  try {
    const file = req.file as Express.Multer.File | undefined
    const photoUrl = file ? `/uploads/feed/${file.filename}` : undefined
    const post = await postsService.createPost(req.user!.userId, { ...req.body, photoUrl })
    return res.status(201).json(post)
  } catch (err) {
    return handleError(res, err)
  }
}

export const toggleLike = async (req: AuthRequest, res: Response) => {
  try {
    const post = await postsService.toggleLike(req.user!.userId, req.params.id)
    return res.json(post)
  } catch (err) {
    return handleError(res, err)
  }
}

export const addComment = async (req: AuthRequest, res: Response) => {
  try {
    const post = await postsService.addComment(req.user!.userId, req.params.id, req.body?.text)
    return res.status(201).json(post)
  } catch (err) {
    return handleError(res, err)
  }
}
