import { Types } from 'mongoose'
import { WorkoutPost } from '../models/WorkoutPost.model'
import { WorkoutSession } from '../models/WorkoutSession.model'

export interface CreatePostPayload {
  sessionId: string
  workoutName: string
  title: string
  caption?: string
  postDate: string
  photoUrl?: string
}

export const listPosts = async () => {
  return WorkoutPost.find()
    .sort({ postDate: -1, createdAt: -1 })
    .populate('userId', 'name photo')
    .lean()
}

export const createPost = async (userId: string, payload: CreatePostPayload) => {
  if (!Types.ObjectId.isValid(payload.sessionId)) throw new Error('INVALID_SESSION')

  const workoutName = payload.workoutName?.trim()
  const title = payload.title?.trim()
  const caption = payload.caption?.trim() ?? ''
  const postDate = new Date(payload.postDate)

  if (!workoutName) throw new Error('INVALID_WORKOUT_NAME')
  if (!title) throw new Error('INVALID_POST_TITLE')
  if (Number.isNaN(postDate.getTime())) throw new Error('INVALID_POST_DATE')

  const session = await WorkoutSession.findOne({
    _id: payload.sessionId,
    userId,
    completedAt: { $ne: null },
  })
  if (!session) throw new Error('SESSION_NOT_FOUND')

  const post = await WorkoutPost.create({
    userId,
    sessionId: session._id,
    workoutName,
    title,
    caption,
    postDate,
    photoUrl: payload.photoUrl,
  })
  return post.populate('userId', 'name photo')
}
