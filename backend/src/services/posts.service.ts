import { Types } from 'mongoose'
import { WorkoutPost } from '../models/WorkoutPost.model'
import { WorkoutSession } from '../models/WorkoutSession.model'
import { User } from '../models/User.model'

export interface CreatePostPayload {
  sessionId: string
  workoutName: string
  title: string
  caption?: string
  postDate: string
  photoUrl?: string
}

export const listPosts = async (userId: string, scope: 'all' | 'trainees' = 'all') => {
  let filter = {}

  if (scope === 'trainees') {
    const coach = await User.findById(userId).select('role')
    if (!coach) throw new Error('USER_NOT_FOUND')
    if (coach.role !== 'coach') throw new Error('COACH_ONLY')
    const traineeIds = await User.find({ coachId: coach._id, role: 'trainee' }).distinct('_id')
    filter = { userId: { $in: traineeIds } }
  }

  return WorkoutPost.find(filter)
    .sort({ postDate: -1, createdAt: -1 })
    .populate('userId', 'name photo')
    .populate('comments.userId', 'name photo')
    .lean()
}

const loadPost = async (postId: string) => {
  if (!Types.ObjectId.isValid(postId)) throw new Error('INVALID_POST')
  const post = await WorkoutPost.findById(postId)
  if (!post) throw new Error('POST_NOT_FOUND')
  return post
}

const populatePost = (post: Awaited<ReturnType<typeof loadPost>>) =>
  post.populate([
    { path: 'userId', select: 'name photo' },
    { path: 'comments.userId', select: 'name photo' },
  ])

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
  return populatePost(post)
}

export const toggleLike = async (userId: string, postId: string) => {
  const post = await loadPost(postId)
  const userObjectId = new Types.ObjectId(userId)
  if (post.userId.equals(userObjectId)) throw new Error('CANNOT_LIKE_OWN_POST')
  const liked = post.likedBy.some(id => id.equals(userObjectId))
  post.likedBy = liked
    ? post.likedBy.filter(id => !id.equals(userObjectId))
    : [...post.likedBy, userObjectId]
  await post.save()
  return populatePost(post)
}

export const addComment = async (userId: string, postId: string, text: string) => {
  const post = await loadPost(postId)
  const cleaned = text?.trim()
  if (!cleaned) throw new Error('INVALID_COMMENT')
  post.comments.push({ userId: new Types.ObjectId(userId), text: cleaned, createdAt: new Date() })
  await post.save()
  return populatePost(post)
}
