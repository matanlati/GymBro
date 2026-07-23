import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, CardHeader, IconTile } from '@gymbro/ui-kit'
import type { IconTileTone } from '@gymbro/ui-kit'
import { useAuth } from '../context/AuthContext'
import { getActivePlan, WorkoutPlan } from '../api/plans.api'
import { getOrCreateToday, listSessions, scheduleSession, Session } from '../api/sessions.api'
import { getSummary, ProgressSummary } from '../api/progress.api'
import { acceptCoachInvite, clearCoachProgressLookout, CoachDashboardSummary, CoachDashboardTrainee, CoachInvite, CoachProgressLookout, CoachTodayWorkout, getCoachDashboardSummary, getCoachProgressLookout, listCoachTodayWorkouts, listMyCoachInvites, reviewCoachWorkout } from '../api/coach.api'

type IconName = 'home' | 'dumbbell' | 'spark' | 'chart' | 'user' | 'share' |
  'calendar' | 'trend' | 'target' | 'weight' | 'trophy' | 'check' | 'chevronLeft' | 'chevronRight' | 'x'

interface DashboardStatCard {
  label: string
  value: string
  icon: IconName
  tone: IconTileTone
  detailTitle?: string
  detailDescription?: string
  detailMode?: 'workouts' | 'not-started' | 'inactive' | 'pb'
  trainees?: CoachDashboardTrainee[]
}

function Icon({ name }: { name: IconName }) {
  const common = {
    width: '18', height: '18', viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: '2',
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  switch (name) {
    case 'home':     return <svg {...common}><path d="m3 10 9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></svg>
    case 'dumbbell': return <svg {...common}><path d="m6 6 12 12" /><path d="m4 8 4-4" /><path d="m16 20 4-4" /><path d="m2 10 8-8" /><path d="m14 22 8-8" /></svg>
    case 'spark':    return <svg {...common}><path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z" /><path d="m19 3 .8 2.2L22 6l-2.2.8L19 9l-.8-2.2L16 6l2.2-.8Z" /></svg>
    case 'chart':    return <svg {...common}><path d="M4 19V5" /><path d="M4 19h16" /><path d="m7 15 4-4 3 3 5-7" /></svg>
    case 'user':     return <svg {...common}><path d="M20 21a8 8 0 0 0-16 0" /><circle cx="12" cy="7" r="4" /></svg>
    case 'share':    return <svg {...common}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 10.5 6.8-4" /><path d="m8.6 13.5 6.8 4" /></svg>
    case 'calendar': return <svg {...common}><path d="M8 2v4" /><path d="M16 2v4" /><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18" /></svg>
    case 'trend':    return <svg {...common}><path d="m4 16 5-5 4 4 7-7" /><path d="M14 8h6v6" /></svg>
    case 'target':   return <svg {...common}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></svg>
    case 'weight':   return <svg {...common}><path d="M6.5 8a5.5 5.5 0 0 1 11 0" /><path d="M5 8h14l-2 13H7Z" /><path d="M10 12h4" /></svg>
    case 'trophy':   return <svg {...common}><path d="M8 21h8" /><path d="M12 17v4" /><path d="M7 4h10v5a5 5 0 0 1-10 0Z" /><path d="M5 6H3a3 3 0 0 0 3 3h1" /><path d="M19 6h2a3 3 0 0 1-3 3h-1" /></svg>
    case 'check':    return <svg {...common}><path d="m20 6-11 11-5-5" /></svg>
    case 'chevronLeft': return <svg {...common}><path d="m15 18-6-6 6-6" /></svg>
    case 'chevronRight': return <svg {...common}><path d="m9 18 6-6-6-6" /></svg>
    case 'x': return <svg {...common}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
    default:         return null
  }
}

const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const startOfWeek = (date: Date) => {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - start.getDay())
  return start
}

const sameDay = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate()

const isFutureDay = (date: Date) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const day = new Date(date)
  day.setHours(0, 0, 0, 0)
  return day > today
}

const completedThisWeek = (sessions: Session[]) => {
  const weekStart = startOfWeek(new Date())
  const nextWeek = new Date(weekStart)
  nextWeek.setDate(nextWeek.getDate() + 7)

  return sessions.filter(session => {
    if (!session.completedAt) return false
    const scheduled = new Date(session.scheduledDate)
    return scheduled >= weekStart && scheduled < nextWeek
  })
}

const volumeLabel = (value: number) => {
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k kg`
  return `${value} kg`
}

const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

const monthLabel = (date: Date) =>
  new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(date)

const buildCalendarCells = (month: Date) => {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells: Array<{ date: Date | null; key: string }> = []

  for (let i = 0; i < first.getDay(); i += 1) {
    cells.push({ date: null, key: `empty-start-${i}` })
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(month.getFullYear(), month.getMonth(), day)
    cells.push({ date, key: dateKey(date) })
  }

  while (cells.length % 7 !== 0) {
    cells.push({ date: null, key: `empty-end-${cells.length}` })
  }

  return cells
}

function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [activePlan, setActivePlan] = useState<WorkoutPlan | null>(null)
  const [summary, setSummary] = useState<ProgressSummary | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState(() => new Date())
  const [planningDate, setPlanningDate] = useState<Date | null>(null)
  const [selectedWorkout, setSelectedWorkout] = useState('')
  const [customWorkoutName, setCustomWorkoutName] = useState('')
  const [scheduleError, setScheduleError] = useState('')
  const [scheduling, setScheduling] = useState(false)
  const [coachInvites, setCoachInvites] = useState<CoachInvite[]>([])
  const [acceptingInviteId, setAcceptingInviteId] = useState('')
  const [coachSummary, setCoachSummary] = useState<CoachDashboardSummary | null>(null)
  const [selectedCoachStat, setSelectedCoachStat] = useState<DashboardStatCard | null>(null)
  const [coachTodayWorkouts, setCoachTodayWorkouts] = useState<CoachTodayWorkout[]>([])
  const [coachWorkoutsLoading, setCoachWorkoutsLoading] = useState(false)
  const [selectedCoachWorkout, setSelectedCoachWorkout] = useState<CoachTodayWorkout | null>(null)
  const [reviewingWorkout, setReviewingWorkout] = useState(false)
  const [progressLookout, setProgressLookout] = useState<CoachProgressLookout[]>([])
  const [selectedLookout, setSelectedLookout] = useState<CoachProgressLookout | null>(null)
  const [clearingLookoutKey, setClearingLookoutKey] = useState('')

  useEffect(() => {
    Promise.allSettled([getActivePlan(), getSummary(), listSessions()])
      .then(([planResult, summaryResult, sessionsResult]) => {
        setActivePlan(planResult.status === 'fulfilled' ? planResult.value.data : null)
        setSummary(summaryResult.status === 'fulfilled' ? summaryResult.value.data : null)
        setSessions(sessionsResult.status === 'fulfilled' ? sessionsResult.value.data : [])
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (user?.role !== 'coach') return
    setCoachWorkoutsLoading(true)
    Promise.allSettled([getCoachDashboardSummary(), listCoachTodayWorkouts(), getCoachProgressLookout()])
      .then(([summaryResult, workoutsResult, lookoutResult]) => {
        setCoachSummary(summaryResult.status === 'fulfilled' ? summaryResult.value.data : null)
        setCoachTodayWorkouts(workoutsResult.status === 'fulfilled' ? workoutsResult.value.data : [])
        setProgressLookout(lookoutResult.status === 'fulfilled' ? lookoutResult.value.data : [])
      })
      .finally(() => setCoachWorkoutsLoading(false))
  }, [user?.role])

  const markWorkoutReviewed = async () => {
    if (!selectedCoachWorkout) return
    setReviewingWorkout(true)
    try {
      const { data } = await reviewCoachWorkout(selectedCoachWorkout.sessionId)
      const update = (workout: CoachTodayWorkout) => workout.sessionId === data.sessionId
        ? { ...workout, reviewedAt: data.reviewedAt }
        : workout
      setCoachTodayWorkouts(current => current.map(update).sort((left, right) => {
        if (!!left.reviewedAt !== !!right.reviewedAt) return left.reviewedAt ? 1 : -1
        return +new Date(right.completedAt) - +new Date(left.completedAt)
      }))
      setSelectedCoachWorkout(current => current ? update(current) : current)
    } finally {
      setReviewingWorkout(false)
    }
  }

  const markLookoutHandled = async (workoutKey: string) => {
    if (!selectedLookout) return
    const traineeId = selectedLookout.trainee._id
    setClearingLookoutKey(workoutKey)
    try {
      await clearCoachProgressLookout(traineeId, workoutKey)
      setProgressLookout(current => current.flatMap(item => {
        if (item.trainee._id !== traineeId) return [item]
        const stalledWorkouts = item.stalledWorkouts.filter(workout => workout.workoutKey !== workoutKey)
        return stalledWorkouts.length ? [{ ...item, stalledWorkouts }] : []
      }))
      setSelectedLookout(current => {
        if (!current || current.trainee._id !== traineeId) return current
        const stalledWorkouts = current.stalledWorkouts.filter(workout => workout.workoutKey !== workoutKey)
        return stalledWorkouts.length ? { ...current, stalledWorkouts } : null
      })
    } finally {
      setClearingLookoutKey('')
    }
  }

  const openPbShoutout = (trainee: CoachDashboardTrainee) => {
    const pb = trainee.personalBests?.[0]
    const achievement = pb
      ? `${pb.exerciseName}: ${pb.value}${pb.metric === 'weight' ? ' kg' : ' reps'}`
      : 'a new personal best'
    setSelectedCoachStat(null)
    navigate('/feed', { state: {
      openComposer: true,
      shoutoutTraineeId: trainee._id,
      workoutName: 'Trainee Achievement',
      postTitle: `${trainee.name} hit a new PB!`,
      caption: `Huge congratulations to ${trainee.name} for achieving ${achievement} this week! Amazing work—keep it going!`,
    } })
  }

  useEffect(() => {
    if (user?.role !== 'trainee') return
    listMyCoachInvites()
      .then(({ data }) => setCoachInvites(data))
      .catch(() => setCoachInvites([]))
  }, [user?.role])

  const startWorkout = async () => {
    setStarting(true)
    try {
      const { data } = await getOrCreateToday()
      navigate(`/session/${data._id}`)
    } catch {
      navigate('/plans/new')
    } finally {
      setStarting(false)
    }
  }

  const weeklyCompleted = completedThisWeek(sessions)
  const activeWorkoutTypes = activePlan?.weeklyPlan
    ?.map((day, index) => ({ day, index }))
    .filter(item => !item.day.isArchived) ?? []
  const weeklyGoal = activeWorkoutTypes.length
  const completedDayIndexes = new Set(weeklyCompleted.map(session => session.dayIndex))
  const nextDayIndex = activeWorkoutTypes.find(item => !completedDayIndexes.has(item.index))?.index ?? -1
  const displayDayIndex = nextDayIndex >= 0 ? nextDayIndex : (activeWorkoutTypes[0]?.index ?? 0)
  const todayDay = activePlan?.weeklyPlan?.[displayDayIndex]
  const todayTitle = todayDay?.focus ?? activePlan?.title ?? 'Your Workout'
  const todayExerciseCount = todayDay?.exercises?.length ?? 0
  const welcomeName = user?.name ?? 'there'
  const welcomeMessage = user?.role === 'coach'
    ? `Welcome Coach ${welcomeName}`
    : `Welcome Back, ${welcomeName}!`
  const welcomeSubtitle = user?.role === 'coach'
    ? 'Keep your trainees moving forward and celebrate their progress.'
    : "Let's crush your fitness goals today"

  const traineeStatCards: DashboardStatCard[] = [
    {
      label: 'Workouts This Week',
      value: weeklyGoal ? `${weeklyCompleted.length}/${weeklyGoal}` : `${weeklyCompleted.length}`,
      icon: 'dumbbell',
      tone: 'orange',
    },
    {
      label: 'Current Streak',
      value: `${summary?.currentStreakDays ?? 0} days`,
      icon: 'trend',
      tone: 'green',
    },
    {
      label: 'Total Workouts',
      value: `${summary?.totalSessions ?? 0}`,
      icon: 'target',
      tone: 'blue',
    },
    {
      label: 'Total Volume',
      value: volumeLabel(summary?.totalVolumeKg ?? 0),
      icon: 'weight',
      tone: 'red',
    },
  ]

  const coachStatCards: DashboardStatCard[] = [
    {
      label: 'Trainee Workouts This Week',
      value: coachSummary ? `${coachSummary.totalWorkoutsThisWeek}` : '—',
      icon: 'dumbbell',
      tone: 'orange',
      detailTitle: 'Worked Out This Week',
      detailDescription: 'Trainees who completed at least one workout this week.',
      detailMode: 'workouts',
      trainees: coachSummary?.traineesWorkedOutThisWeek ?? [],
    },
    {
      label: 'Not Started This Week',
      value: coachSummary ? `${coachSummary.traineesNotStartedThisWeek}` : '—',
      icon: 'user',
      tone: 'blue',
      detailTitle: 'Not Started This Week',
      detailDescription: 'Trainees who have not completed a workout this week.',
      detailMode: 'not-started',
      trainees: coachSummary?.traineesNotStarted ?? [],
    },
    {
      label: `Inactive ${coachSummary?.inactivityDays ?? 7}+ Days`,
      value: coachSummary ? `${coachSummary.inactiveTrainees}` : '—',
      icon: 'calendar',
      tone: 'red',
      detailTitle: `Inactive ${coachSummary?.inactivityDays ?? 7}+ Days`,
      detailDescription: 'Trainees whose last completed workout was outside the activity window.',
      detailMode: 'inactive',
      trainees: coachSummary?.inactiveTraineeDetails ?? [],
    },
    {
      label: 'Trainees With a PB This Week',
      value: coachSummary ? `${coachSummary.traineesWithPbThisWeek}` : '—',
      icon: 'trophy',
      tone: 'green',
      detailTitle: 'Personal Bests This Week',
      detailDescription: 'Your trainees achieved a PB this week! Want to shout it out?',
      detailMode: 'pb',
      trainees: coachSummary?.traineesWithPb ?? [],
    },
  ]
  const statCards = user?.role === 'coach' ? coachStatCards : traineeStatCards

  const progressDays = dayLabels.map((day, index) => {
    const date = startOfWeek(new Date())
    date.setDate(date.getDate() + index)
    const daySessions = weeklyCompleted.filter(session => sameDay(new Date(session.scheduledDate), date))
    return {
      day,
      value: daySessions.length ? 84 : 48,
      active: daySessions.length > 0,
    }
  })

  const topRecord = summary?.personalRecords?.[0]
  const weeklyGoalAchieved = weeklyGoal > 0 && weeklyCompleted.length >= weeklyGoal

  const workoutNameFor = (session: Session) => {
    if (session.title) return session.title
    if (activePlan?._id === session.planId) {
      return activePlan.weeklyPlan?.[session.dayIndex]?.focus ?? activePlan.title
    }
    const firstExercise = session.exercises?.[0]?.name
    return firstExercise ? `${firstExercise} workout` : 'Workout'
  }

  const workoutsByDate = sessions.reduce<Record<string, { name: string; planned: boolean }[]>>((acc, session) => {
    const key = dateKey(new Date(session.scheduledDate))
    acc[key] = [...(acc[key] ?? []), { name: workoutNameFor(session), planned: !session.completedAt }]
    return acc
  }, {})
  const completedByDate = Object.fromEntries(
    Object.entries(workoutsByDate).map(([key, workouts]) => [
      key,
      workouts.filter(workout => !workout.planned).map(workout => workout.name),
    ])
  )
  const calendarCells = buildCalendarCells(calendarMonth)
  const selectedMonthWorkoutCount = Object.entries(workoutsByDate).filter(([key]) =>
    key.startsWith(`${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}`)
  ).reduce((total, [, workouts]) => total + workouts.length, 0)

  const moveCalendarMonth = (offset: number) => {
    setCalendarMonth(current => new Date(current.getFullYear(), current.getMonth() + offset, 1))
  }

  const openPlanningModal = (date: Date) => {
    if (!isFutureDay(date)) return
    setPlanningDate(date)
    setSelectedWorkout(activeWorkoutTypes.length ? String(activeWorkoutTypes[0].index) : 'other')
    setCustomWorkoutName('')
    setScheduleError('')
  }

  const closePlanningModal = () => {
    if (scheduling) return
    setPlanningDate(null)
    setScheduleError('')
  }

  const submitPlannedWorkout = async () => {
    if (!planningDate) return
    setScheduling(true)
    setScheduleError('')
    try {
      const payload = selectedWorkout === 'other'
        ? { scheduledDate: dateKey(planningDate), title: customWorkoutName.trim() }
        : { scheduledDate: dateKey(planningDate), dayIndex: Number(selectedWorkout) }
      if (selectedWorkout === 'other' && !payload.title) {
        setScheduleError('Add a workout name.')
        return
      }
      const { data } = await scheduleSession(payload)
      setSessions(current => [data, ...current])
      setPlanningDate(null)
      setCustomWorkoutName('')
    } catch {
      setScheduleError('Could not schedule this workout. Please try again.')
    } finally {
      setScheduling(false)
    }
  }

  const acceptInvite = async (inviteId: string) => {
    setAcceptingInviteId(inviteId)
    try {
      await acceptCoachInvite(inviteId)
      setCoachInvites(current => current.filter(invite => invite._id !== inviteId))
    } finally {
      setAcceptingInviteId('')
    }
  }

  return (
    <main className="dashboard">
      <section className="dashboard-hero">
        <div>
          <h1>{welcomeMessage}</h1>
          <p>{welcomeSubtitle}</p>
        </div>
        {user?.role !== 'coach' ? (
          <Button leadingIcon={<Icon name="share" />} onClick={() => navigate('/feed', { state: { openComposer: true } })}>
            Share Workout
          </Button>
        ) : null}
      </section>

      {user?.role === 'trainee' && coachInvites.length > 0 ? (
        <section className="coach-invite-strip" aria-label="Coach invitations">
          {coachInvites.map(invite => (
            <Card className="coach-invite-card" key={invite._id}>
              <div>
                <strong>{invite.coachId?.name ?? 'A coach'} invited you</strong>
                <p>Accept to connect this trainee account with your coach.</p>
              </div>
              <Button
                size="sm"
                loading={acceptingInviteId === invite._id}
                loadingLabel="Accepting..."
                onClick={() => acceptInvite(invite._id)}
              >
                Accept
              </Button>
            </Card>
          ))}
        </section>
      ) : null}

      <section className="stats-grid" aria-label="Workout stats">
        {statCards.map(card => (
          <Card
            as="article"
            padding="none"
            className={user?.role === 'coach' ? 'stat-card coach-stat-card' : 'stat-card'}
            key={card.label}
            role={user?.role === 'coach' ? 'button' : undefined}
            tabIndex={user?.role === 'coach' ? 0 : undefined}
            aria-label={user?.role === 'coach' ? `${card.label}: ${card.value}. View trainees.` : undefined}
            onClick={user?.role === 'coach' ? () => setSelectedCoachStat(card) : undefined}
            onKeyDown={user?.role === 'coach' ? event => {
              if (event.key === 'Enter' || event.key === ' ') setSelectedCoachStat(card)
            } : undefined}
          >
            <IconTile tone={card.tone}><Icon name={card.icon} /></IconTile>
            <p>{card.label}</p>
            <strong>{card.value}</strong>
            {user?.role === 'coach' ? <span className="coach-stat-hint">View trainees</span> : null}
          </Card>
        ))}
      </section>

      {selectedCoachStat ? (
        <div className="dashboard-stat-modal-backdrop" role="presentation" onClick={() => setSelectedCoachStat(null)}>
          <section
            className="dashboard-stat-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dashboard-stat-modal-title"
            onClick={event => event.stopPropagation()}
          >
            <div className="dashboard-stat-modal-head">
              <div>
                <h2 id="dashboard-stat-modal-title">{selectedCoachStat.detailTitle}</h2>
                <p>{selectedCoachStat.detailDescription}</p>
              </div>
              <button type="button" aria-label="Close trainee list" onClick={() => setSelectedCoachStat(null)}>
                <Icon name="x" />
              </button>
            </div>
            {(selectedCoachStat.trainees ?? []).length === 0 ? (
              <div className="dashboard-stat-empty">No trainees in this category.</div>
            ) : (
              <div className="dashboard-stat-trainee-list">
                {(selectedCoachStat.trainees ?? []).map(trainee => (
                  <div className="dashboard-stat-trainee" key={trainee._id}>
                    <span className="dashboard-stat-avatar">{trainee.name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase()}</span>
                    <div>
                      <strong>{trainee.name}</strong>
                      <small>{trainee.email}</small>
                    </div>
                    {selectedCoachStat.detailMode === 'workouts' ? (
                      <span>{trainee.workoutCountThisWeek} {trainee.workoutCountThisWeek === 1 ? 'workout' : 'workouts'}</span>
                    ) : selectedCoachStat.detailMode === 'inactive' ? (
                      <span>{trainee.lastActiveAt ? `Last active ${new Date(trainee.lastActiveAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'Never active'}</span>
                    ) : selectedCoachStat.detailMode === 'pb' ? (
                      <div className="dashboard-pb-actions">
                        <span className="dashboard-stat-pb">New PB</span>
                        <button
                          type="button"
                          onClick={() => openPbShoutout(trainee)}
                        >Share achievement</button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : null}

      <section className="dashboard-grid">
        <Card as="article" className="workout-panel">
          {user?.role === 'coach' ? (
            <>
              <CardHeader title="Workouts Completed Today" />
              {coachWorkoutsLoading ? (
                <div className="coach-workout-queue-empty">Loading completed workouts...</div>
              ) : coachTodayWorkouts.length === 0 ? (
                <div className="coach-workout-queue-empty">No trainees have completed a workout today yet.</div>
              ) : (
                <div className="coach-workout-queue">
                  {coachTodayWorkouts.map(workout => (
                    <div className={workout.reviewedAt ? 'coach-workout-row reviewed' : 'coach-workout-row'} key={workout.sessionId}>
                      <span className="coach-workout-avatar">
                        {workout.trainee.name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase()}
                      </span>
                      <div>
                        <strong>{workout.trainee.name}</strong>
                        <span>{workout.title}</span>
                        <small>
                          {new Date(workout.completedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          {' · '}{workout.durationMinutes} min
                        </small>
                      </div>
                      {workout.reviewedAt ? (
                        <button className="coach-workout-reviewed-button" type="button" onClick={() => setSelectedCoachWorkout(workout)}>
                          <Icon name="check" /> Reviewed
                        </button>
                      ) : (
                        <Button size="sm" onClick={() => setSelectedCoachWorkout(workout)}>Review</Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
          <>
          <CardHeader
            title="Today's Workout"
            trailing={
              <button
                className="calendar-icon-button"
                type="button"
                aria-label={calendarOpen ? 'Close workout calendar' : 'Open workout calendar'}
                aria-expanded={calendarOpen}
                onClick={() => setCalendarOpen(open => !open)}
              >
                <Icon name="calendar" />
              </button>
            }
          />
          {loading ? (
            <div className="workout-card"><div><h3>Loading...</h3></div></div>
          ) : activePlan ? (
            <div className="workout-card">
              <div>
                <h3>{todayTitle}</h3>
                <p>{todayExerciseCount} exercises</p>
                <span>{Math.max(todayExerciseCount * 8, 20)} min</span>
              </div>
              <Button variant="inverse" loading={starting} loadingLabel="Starting..." onClick={startWorkout}>
                Start Workout
              </Button>
            </div>
          ) : (
            <div className="workout-card">
              <div>
                <h3>No active plan</h3>
                <p>Create one from the questionnaire to get started.</p>
              </div>
              <Button variant="inverse" onClick={() => navigate('/plans/new')}>Create Plan</Button>
            </div>
          )}
          <div className="week-progress">
            <h3>This Week's Progress</h3>
            <div className="bars">
              {progressDays.map(item => (
                <div className="bar-item" key={item.day}>
                  <span className={item.active ? 'bar active' : 'bar'} style={{ height: `${item.value}px` }} />
                  <small>{item.day}</small>
                </div>
              ))}
            </div>
          </div>
          </>
          )}
        </Card>

        <aside className="side-column">
          {user?.role === 'coach' ? (
            <Card as="section" className="achievements-panel coach-lookout-panel">
              <CardHeader title="Look Out" />
              <p className="coach-lookout-subtitle">These trainees haven’t been progressing lately. It may be time to check in with them.</p>
              {progressLookout.length === 0 ? (
                <div className="coach-lookout-empty"><Icon name="check" /> No stalled progress detected.</div>
              ) : (
                <div className="coach-lookout-list">
                  {progressLookout.map(item => (
                    <button type="button" key={item.trainee._id} onClick={() => setSelectedLookout(item)}>
                      <span className="dashboard-stat-avatar">{item.trainee.name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase()}</span>
                      <span><strong>{item.trainee.name}</strong><small>{item.stalledWorkouts.length} stalled {item.stalledWorkouts.length === 1 ? 'workout type' : 'workout types'}</small></span>
                      <Icon name="chevronRight" />
                    </button>
                  ))}
                </div>
              )}
            </Card>
          ) : (
          <Card as="section" className="achievements-panel">
            <CardHeader title="Recent Achievements" />
            {topRecord ? (
              <div className="achievement-row">
                <IconTile tone="yellow" size="sm"><Icon name="trophy" /></IconTile>
                <div><strong>Personal Record</strong><p>{topRecord.exerciseName}: {topRecord.maxWeightKg} kg</p></div>
              </div>
            ) : null}
            {weeklyGoalAchieved ? (
              <div className="achievement-row">
                <IconTile tone="green" size="sm"><Icon name="check" /></IconTile>
                <div><strong>Weekly Goal Achieved</strong><p>Completed {weeklyCompleted.length} workouts</p></div>
              </div>
            ) : null}
            {!topRecord && !weeklyGoalAchieved ? (
              <div className="achievement-row">
                <IconTile tone="blue" size="sm"><Icon name="target" /></IconTile>
                <div><strong>No achievements yet</strong><p>Complete workouts to unlock your first milestones.</p></div>
              </div>
            ) : null}
          </Card>
          )}
          {user?.role !== 'coach' ? (
            <Card as="section" variant="info" className="coach-panel">
              <h2>AI Coach Available</h2>
              <p>Upload your workout video for real-time form analysis and feedback</p>
              <Button variant="inverse" size="sm" style={{ color: '#2563eb' }} onClick={() => navigate('/ai-coach')}>
                Try AI Coach
              </Button>
            </Card>
          ) : null}
        </aside>
      </section>
      {selectedCoachWorkout ? (
        <div className="coach-workout-modal-backdrop" role="presentation" onClick={() => setSelectedCoachWorkout(null)}>
          <section
            className="coach-workout-review-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="coach-workout-review-title"
            onClick={event => event.stopPropagation()}
          >
            <div className="coach-workout-review-head">
              <div>
                <span>{selectedCoachWorkout.trainee.name}</span>
                <h2 id="coach-workout-review-title">{selectedCoachWorkout.title}</h2>
                <p>
                  Completed {new Date(selectedCoachWorkout.completedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  {' · '}{selectedCoachWorkout.durationMinutes} minutes
                </p>
              </div>
              <button type="button" aria-label="Close workout review" onClick={() => setSelectedCoachWorkout(null)}>
                <Icon name="x" />
              </button>
            </div>
            <div className="coach-workout-exercises">
              {selectedCoachWorkout.exercises.length === 0 ? (
                <div className="coach-workout-queue-empty">No exercise details were logged.</div>
              ) : selectedCoachWorkout.exercises.map((exercise, exerciseIndex) => (
                <div className="coach-workout-exercise" key={`${exercise.name}-${exerciseIndex}`}>
                  <h3>{exercise.name}</h3>
                  <div className="coach-workout-set-head"><span>Set</span><span>Reps</span><span>Weight</span></div>
                  {exercise.sets.map((set, setIndex) => (
                    <div className={set.isPb ? 'coach-workout-set pb' : 'coach-workout-set'} key={`${set.setNumber}-${setIndex}`}>
                      <span>{set.setNumber}</span>
                      <span>{set.repsCompleted}</span>
                      <span>
                        {set.weightUsedKg !== undefined ? `${set.weightUsedKg} kg` : 'Bodyweight'}
                        {set.isPb ? <b><Icon name="trophy" /> PB!</b> : null}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="coach-workout-review-actions">
              {selectedCoachWorkout.reviewedAt ? (
                <span><Icon name="check" /> Reviewed {new Date(selectedCoachWorkout.reviewedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              ) : (
                <Button loading={reviewingWorkout} loadingLabel="Marking reviewed..." onClick={markWorkoutReviewed}>
                  Mark as Reviewed
                </Button>
              )}
            </div>
          </section>
        </div>
      ) : null}
      {selectedLookout ? (
        <div className="coach-workout-modal-backdrop" role="presentation" onClick={() => setSelectedLookout(null)}>
          <section
            className="coach-lookout-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="coach-lookout-modal-title"
            onClick={event => event.stopPropagation()}
          >
            <div className="coach-workout-review-head">
              <div>
                <span>Progress lookout</span>
                <h2 id="coach-lookout-modal-title">{selectedLookout.trainee.name}</h2>
                <p>{selectedLookout.trainee.email}</p>
              </div>
              <button type="button" aria-label="Close progress lookout" onClick={() => setSelectedLookout(null)}><Icon name="x" /></button>
            </div>
            <div className="coach-lookout-workouts">
              {selectedLookout.stalledWorkouts.map(workout => (
                <section className="coach-lookout-workout" key={workout.workoutKey}>
                  <div className="coach-lookout-workout-head">
                    <div><h3>{workout.workoutName}</h3><p>{workout.stagnantExerciseCount} of {workout.evaluatedExerciseCount} exercises have not progressed</p></div>
                    <div className="coach-lookout-actions">
                      <span>Last {workout.exercises[0]?.history.length ?? 0} workouts</span>
                      <button
                        type="button"
                        disabled={clearingLookoutKey === workout.workoutKey}
                        onClick={() => markLookoutHandled(workout.workoutKey)}
                      >
                        <Icon name="check" /> {clearingLookoutKey === workout.workoutKey ? 'Clearing...' : 'Mark handled'}
                      </button>
                    </div>
                  </div>
                  <div className="coach-lookout-exercises">
                    {workout.exercises.map(exercise => (
                      <div className={exercise.progressed ? 'coach-lookout-exercise progressed' : 'coach-lookout-exercise stalled'} key={exercise.exerciseKey}>
                        <div>
                          <strong>{exercise.exerciseName}</strong>
                          <span>{exercise.progressed ? 'Progressing' : 'No increase'}</span>
                        </div>
                        <div className="coach-lookout-history">
                          {exercise.history.map((entry, index) => (
                            <span key={entry.completedAt}>
                              <small>Workout {index + 1}</small>
                              <b>{entry.maxWeightKg > 0 ? `${entry.maxWeightKg} kg` : 'Bodyweight'} · {entry.maxReps} reps</b>
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </section>
        </div>
      ) : null}
      {calendarOpen ? (
        <div className="calendar-modal-backdrop" role="presentation" onClick={() => setCalendarOpen(false)}>
          <section
            className="workout-calendar-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Workout calendar"
            onClick={event => event.stopPropagation()}
          >
            <div className="workout-calendar-header">
              <button type="button" aria-label="Previous month" onClick={() => moveCalendarMonth(-1)}>
                <Icon name="chevronLeft" />
              </button>
              <div>
                <strong>{monthLabel(calendarMonth)}</strong>
                  <span>{selectedMonthWorkoutCount} planned or completed workouts</span>
              </div>
              <button type="button" aria-label="Next month" onClick={() => moveCalendarMonth(1)}>
                <Icon name="chevronRight" />
              </button>
            </div>
            <button className="calendar-modal-close" type="button" aria-label="Close calendar" onClick={() => setCalendarOpen(false)}>
              <Icon name="x" />
            </button>
            <div className="workout-calendar-weekdays">
              {dayLabels.map(day => <span key={day}>{day}</span>)}
            </div>
            <div className="workout-calendar-grid">
              {calendarCells.map(cell => {
                const workouts = cell.date ? workoutsByDate[dateKey(cell.date)] ?? [] : []
                const completedNames = cell.date ? completedByDate[dateKey(cell.date)] ?? [] : []
                const plannedCount = workouts.length - completedNames.length
                const isToday = cell.date ? sameDay(cell.date, new Date()) : false
                const canPlan = cell.date ? isFutureDay(cell.date) : false
                return (
                  <button
                    type="button"
                    aria-label={workouts.length > 0 ? `${workouts.length} workout${workouts.length === 1 ? '' : 's'}: ${workouts.map(workout => workout.name).join(', ')}` : undefined}
                    className={[
                      'workout-calendar-day',
                      cell.date ? '' : 'empty',
                      completedNames.length > 0 ? 'worked-out' : '',
                      plannedCount > 0 ? 'planned' : '',
                      isToday ? 'today' : '',
                      canPlan ? 'can-plan' : '',
                    ].filter(Boolean).join(' ')}
                    disabled={!cell.date}
                    key={cell.key}
                    onClick={() => cell.date && openPlanningModal(cell.date)}
                  >
                    {cell.date ? <span>{cell.date.getDate()}</span> : null}
                    {workouts.length > 0 ? (
                      <>
                        <small>{workouts.length}</small>
                        <div className="workout-calendar-tooltip" role="tooltip">
                          {workouts.map((workout, index) => (
                            <span key={`${workout.name}-${index}`}>
                              {workout.name}{workout.planned ? ' (planned)' : ''}
                            </span>
                          ))}
                        </div>
                      </>
                    ) : null}
                  </button>
                )
              })}
            </div>
            {planningDate ? (
              <div className="schedule-workout-modal" role="dialog" aria-modal="true" aria-label="Plan future workout">
                <h3>Plan Workout</h3>
                <p>{planningDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                <label>
                  Workout type
                  <select value={selectedWorkout} onChange={event => setSelectedWorkout(event.target.value)}>
                    {activeWorkoutTypes.map(({ day, index }) => (
                      <option value={String(index)} key={`${day.focus}-${index}`}>
                        {day.focus}
                      </option>
                    ))}
                    <option value="other">Other</option>
                  </select>
                </label>
                {selectedWorkout === 'other' ? (
                  <label>
                    Workout name
                    <input
                      value={customWorkoutName}
                      onChange={event => setCustomWorkoutName(event.target.value)}
                      placeholder="Recovery run, yoga, skills..."
                    />
                  </label>
                ) : null}
                {scheduleError ? <span className="schedule-workout-error">{scheduleError}</span> : null}
                <div className="schedule-workout-actions">
                  <Button variant="secondary" size="sm" onClick={closePlanningModal}>Cancel</Button>
                  <Button size="sm" loading={scheduling} loadingLabel="Saving..." onClick={submitPlannedWorkout}>
                    Save
                  </Button>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </main>
  )
}

export default function DashboardPage() {
  return <Dashboard />
}
