import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Alert, Button, Card, EmptyState, LoadingState, PageHeader } from '@gymbro/ui-kit'
import { addComment, createPost, listPosts, toggleLike, WorkoutPost } from '../api/posts.api'
import { listSessions, Session } from '../api/sessions.api'
import { getActivePlan, WorkoutPlan } from '../api/plans.api'
import { useAuth } from '../context/AuthContext'

const dateInputValue = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

const formatPostDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

const formatSessionDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

const initials = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'G'

const sessionName = (session: Session, plan: WorkoutPlan | null) => {
  if (session.title) return session.title
  if (plan?._id === session.planId) return plan.weeklyPlan?.[session.dayIndex]?.focus ?? plan.title
  return session.exercises?.[0]?.name ? `${session.exercises[0].name} workout` : `Workout on ${formatSessionDate(session.scheduledDate)}`
}

const suggestedComments = [
  'Congrats on your PB!',
  'Amazing progress!',
  'Strong work!',
  'Keep it up!',
]

const SocialFeedPage = () => {
  const { user } = useAuth()
  const location = useLocation()
  const state = location.state as { openComposer?: boolean; sessionId?: string; caption?: string } | null
  const [posts, setPosts] = useState<WorkoutPost[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [plan, setPlan] = useState<WorkoutPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [composerOpen, setComposerOpen] = useState(state?.openComposer === true)
  const [sessionId, setSessionId] = useState(state?.sessionId ?? '')
  const [workoutName, setWorkoutName] = useState('')
  const [postTitle, setPostTitle] = useState('')
  const [caption, setCaption] = useState(state?.caption ?? '')
  const [photo, setPhoto] = useState<File | undefined>()
  const [error, setError] = useState('')
  const [posting, setPosting] = useState(false)
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})

  useEffect(() => {
    Promise.all([
      listPosts().then(({ data }) => setPosts(data)),
      listSessions().then(({ data }) => setSessions(data.filter(session => !!session.completedAt))),
      getActivePlan().then(({ data }) => setPlan(data)).catch(() => setPlan(null)),
    ]).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (composerOpen && !sessionId && sessions[0]) {
      setSessionId(sessions[0]._id)
    }
  }, [composerOpen, sessionId, sessions])

  const selectedSession = useMemo(
    () => sessions.find(session => session._id === sessionId) ?? null,
    [sessions, sessionId]
  )

  useEffect(() => {
    if (!selectedSession) return
    const name = sessionName(selectedSession, plan)
    setWorkoutName(name)
    setPostTitle(name)
  }, [selectedSession, plan])

  const openComposer = () => {
    setError('')
    setComposerOpen(true)
    if (!sessionId && sessions[0]) setSessionId(sessions[0]._id)
  }

  const closeComposer = () => {
    if (posting) return
    setComposerOpen(false)
    setError('')
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setPosting(true)
    setError('')
    try {
      const { data } = await createPost({
        sessionId,
        workoutName,
        title: postTitle,
        caption,
        postDate: dateInputValue(),
        photo,
      })
      setPosts(current => [data, ...current].sort((a, b) => +new Date(b.postDate) - +new Date(a.postDate)))
      setComposerOpen(false)
      setCaption('')
      setPostTitle('')
      setWorkoutName('')
      setSessionId('')
      setPhoto(undefined)
    } catch {
      setError('Could not publish this post. Check the fields and try again.')
    } finally {
      setPosting(false)
    }
  }

  const replacePost = (updated: WorkoutPost) => {
    setPosts(current => current.map(post => post._id === updated._id ? updated : post))
  }

  const handleLike = async (postId: string) => {
    const { data } = await toggleLike(postId)
    replacePost(data)
  }

  const submitComment = async (postId: string, text: string) => {
    const cleaned = text.trim()
    if (!cleaned) return
    const { data } = await addComment(postId, cleaned)
    replacePost(data)
    setCommentDrafts(current => ({ ...current, [postId]: '' }))
  }

  return (
    <main className="social-feed-page">
      <PageHeader
        title="Social Feed"
        subtitle="Share completed workouts and browse recent posts"
        actions={<Button onClick={openComposer}>Add Post</Button>}
      />

      {loading ? (
        <LoadingState label="Loading feed..." />
      ) : posts.length === 0 ? (
        <EmptyState>No posts yet. Share a completed workout to start the feed.</EmptyState>
      ) : (
        <section className="feed-gallery" aria-label="Workout posts">
          {posts.map(post => {
            const isOwnPost = post.userId?._id === user?._id
            const likedByMe = post.likedBy?.includes(user?._id ?? '') ?? false

            return (
              <Card as="article" className="feed-post-card" key={post._id}>
                {post.photoUrl ? (
                  <img className="feed-post-photo" src={post.photoUrl} alt={post.workoutName} />
                ) : (
                  <div className="feed-post-visual">
                    <span>{post.workoutName}</span>
                  </div>
                )}
                <div className="feed-post-body">
                  <div className="feed-post-author">
                    <span className="feed-avatar">{initials(post.userId?.name ?? 'GymBro')}</span>
                    <div>
                      <strong>{post.userId?.name ?? 'GymBro User'}</strong>
                      <small>{formatPostDate(post.postDate)}</small>
                    </div>
                  </div>
                  <h2>{post.title}</h2>
                  {post.caption ? <p>{post.caption}</p> : null}
                  <div className="feed-post-social">
                    <button
                      type="button"
                      className={likedByMe ? 'liked' : ''}
                      disabled={isOwnPost}
                      aria-label={isOwnPost ? 'You cannot like your own post' : likedByMe ? 'Unlike post' : 'Like post'}
                      title={isOwnPost ? 'You can only like other posts' : undefined}
                      onClick={() => handleLike(post._id)}
                    >
                      <span aria-hidden="true">{likedByMe ? '❤️' : '🤍'}</span>
                      <strong>{post.likedBy?.length ?? 0}</strong>
                    </button>
                    <span>{post.comments?.length ?? 0} comments</span>
                  </div>
                  <div className="feed-suggestions">
                    {suggestedComments.map(text => (
                      <button type="button" key={text} onClick={() => submitComment(post._id, text)}>
                        {text}
                      </button>
                    ))}
                  </div>
                  <div className="feed-comments">
                    {(post.comments ?? []).slice(-3).map(comment => (
                      <div className="feed-comment" key={comment._id}>
                        <strong>{comment.userId?.name ?? 'GymBro User'}</strong>
                        <span>{comment.text}</span>
                      </div>
                    ))}
                  </div>
                  <form className="feed-comment-form" onSubmit={event => {
                    event.preventDefault()
                    submitComment(post._id, commentDrafts[post._id] ?? '')
                  }}>
                    <input
                      value={commentDrafts[post._id] ?? ''}
                      onChange={event => setCommentDrafts(current => ({ ...current, [post._id]: event.target.value }))}
                      placeholder="Add a comment..."
                    />
                    <button type="submit">Post</button>
                  </form>
                </div>
              </Card>
            )
          })}
        </section>
      )}

      {composerOpen ? (
        <div className="feed-modal-backdrop" role="presentation" onClick={closeComposer}>
          <section className="feed-composer-modal" role="dialog" aria-modal="true" aria-label="Add workout post" onClick={event => event.stopPropagation()}>
            <div className="feed-composer-head">
              <div>
                <h2>Add Post</h2>
                <p>Choose a completed workout and write your post.</p>
              </div>
              <button type="button" aria-label="Close post composer" onClick={closeComposer}>x</button>
            </div>

            {error ? <Alert variant="error">{error}</Alert> : null}
            {sessions.length === 0 ? (
              <EmptyState>Complete a workout before creating a post.</EmptyState>
            ) : (
              <form className="feed-composer-form" onSubmit={submit}>
                <label>
                  Completed workout
                  <select value={sessionId} onChange={event => setSessionId(event.target.value)} required>
                    <option value="" disabled>Select workout</option>
                    {sessions.map(session => (
                      <option value={session._id} key={session._id}>
                        {sessionName(session, plan)} - {formatSessionDate(session.scheduledDate)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Workout name
                  <input value={workoutName} onChange={event => setWorkoutName(event.target.value)} required />
                </label>
                <label>
                  Post name
                  <input value={postTitle} onChange={event => setPostTitle(event.target.value)} required />
                </label>
                <label>
                  Short caption
                  <textarea value={caption} onChange={event => setCaption(event.target.value)} maxLength={240} rows={3} />
                </label>
                <label>
                  Photo
                  <input
                    type="file"
                    accept="image/*"
                    onChange={event => setPhoto(event.target.files?.[0])}
                  />
                </label>
                <div className="feed-composer-actions">
                  <Button variant="secondary" onClick={closeComposer}>Cancel</Button>
                  <Button type="submit" loading={posting} loadingLabel="Posting...">Post</Button>
                </div>
              </form>
            )}
          </section>
        </div>
      ) : null}
    </main>
  )
}

export default SocialFeedPage
