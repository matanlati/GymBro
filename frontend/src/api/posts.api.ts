import client from './client'

export interface FeedAuthor {
  _id: string
  name: string
  photo?: string
}

export interface WorkoutComment {
  _id: string
  userId: FeedAuthor
  text: string
  createdAt: string
}

export interface WorkoutPost {
  _id: string
  userId: FeedAuthor
  sessionId: string
  workoutName: string
  title: string
  caption: string
  postDate: string
  photoUrl?: string
  likedBy: string[]
  comments: WorkoutComment[]
  createdAt: string
}

export interface CreateWorkoutPostPayload {
  sessionId: string
  workoutName: string
  title: string
  caption?: string
  postDate: string
  photo?: File
}

export const listPosts = () => client.get<WorkoutPost[]>('/posts')

export const createPost = (payload: CreateWorkoutPostPayload) => {
  const form = new FormData()
  form.append('sessionId', payload.sessionId)
  form.append('workoutName', payload.workoutName)
  form.append('title', payload.title)
  form.append('caption', payload.caption ?? '')
  form.append('postDate', payload.postDate)
  if (payload.photo) form.append('photo', payload.photo)
  return client.post<WorkoutPost>('/posts', form)
}

export const toggleLike = (postId: string) =>
  client.post<WorkoutPost>(`/posts/${postId}/like`)

export const addComment = (postId: string, text: string) =>
  client.post<WorkoutPost>(`/posts/${postId}/comments`, { text })
