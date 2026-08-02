import { useState, useEffect, useRef, DragEvent, ChangeEvent, FormEvent } from 'react'
import { Alert, Badge, Button, Card, CardHeader, EmptyState, FormField, IconTile, PageHeader, Select, scoreTone } from '@gymbro/ui-kit'
import type { BadgeTone, SelectOption } from '@gymbro/ui-kit'
import {
  analyzeVideo,
  listAnalyses,
  BodySide,
  Evaluation,
  EvaluationIssue,
  RecentAnalysis,
} from '../api/video.api'
import VideoTrimmer, { TrimRange } from './VideoTrimmer'
import { cancelTrim, isTrimSupported, preloadTrimmer, trimVideo } from '../utils/videoTrim'

// `value` is the pose-service registry key (sent to the API); `label` is the
// human-facing name shown in the dropdown.
const EXERCISE_TYPES: SelectOption[] = [
  { value: 'squat', label: 'Squat' },
  { value: 'deadlift', label: 'Deadlift' },
  { value: 'push-up', label: 'Push-up' },
  { value: 'lunge', label: 'Lunge' },
  { value: 'shoulder_press', label: 'Shoulder press' },
  { value: 'bicep_curl', label: 'Biceps curl' },
  { value: 'lateral_raise', label: 'Lateral raise' },
  { value: 'bench_press', label: 'Bench press' },
  { value: 'lat_pulldown', label: 'Lat pulldown' },
  { value: 'triceps_extension', label: 'Triceps extension' },
]
const SIDES: { value: BodySide; label: string }[] = [
  { value: 'left', label: 'Left side' },
  { value: 'right', label: 'Right side' },
]
const MAX_SIZE = 100 * 1024 * 1024
const ACCEPTED = ['video/mp4', 'video/quicktime', 'video/webm']

const HOW_IT_WORKS = [
  'Record your exercise from side angle',
  'AI analyzes your movement patterns',
  'Get instant feedback and tips',
  'Track improvements over time',
]

const TIPS = [
  'Record from the side view for full body visibility',
  'Ensure good lighting and clear background',
  'Complete at least 3–5 reps in the video',
  'Wear form-fitting clothes for better tracking',
]

type IconName = 'camera' | 'upload' | 'check' | 'alert' | 'activity' | 'trend'

const Icon = ({ name }: { name: IconName }) => {
  const common = {
    width: '18', height: '18', viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: '2',
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  switch (name) {
    case 'camera':   return <svg {...common}><path d="m22 8-6 4 6 4V8Z" /><rect x="2" y="6" width="14" height="12" rx="2" /></svg>
    case 'upload':   return <svg {...common}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m17 8-5-5-5 5" /><path d="M12 3v12" /></svg>
    case 'check':    return <svg {...common}><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></svg>
    case 'alert':    return <svg {...common}><circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
    case 'activity': return <svg {...common}><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
    case 'trend':    return <svg {...common}><path d="m4 16 5-5 4 4 7-7" /><path d="M14 8h6v6" /></svg>
  }
}

const severityTone = (severity: string): BadgeTone =>
  severity === 'high' ? 'danger' : severity === 'medium' ? 'warning' : 'neutral'

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })

const formatSize = (bytes: number): string => `${(bytes / (1024 * 1024)).toFixed(1)} MB`

const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

// Turn a registry key like "bench_press" or "push-up" into a readable label.
const prettifyExercise = (s: string): string =>
  capitalize(s.replace(/[_-]+/g, ' '))

const IssueRow = ({ issue }: { issue: EvaluationIssue }) => {
  const severity = ['low', 'medium', 'high'].includes(issue.severity) ? issue.severity : 'medium'
  const reps = issue.affected_reps
  return (
    <div className={`issue-row ${severity}`}>
      <div className="issue-head">
        <span className="issue-title"><Icon name="alert" /> {issue.title}</span>
        <Badge tone={severityTone(severity)}>
          {reps ? `${severity} · ${reps} ${reps === 1 ? 'rep' : 'reps'}` : severity}
        </Badge>
      </div>
      {issue.explanation && <p className="issue-explanation">{issue.explanation}</p>}
      {issue.suggestion && (
        <p className="issue-suggestion"><strong>Fix:</strong> {issue.suggestion}</p>
      )}
    </div>
  )
}

const ResultsPanel = ({ evaluation, onAnalyzeAnother }: { evaluation: Evaluation; onAnalyzeAnother: () => void }) => {
  return (
    <Card as="section" className="results-panel">
      <div className="results-header">
        <div>
          <h2>{prettifyExercise(evaluation.exerciseType)} — Analysis</h2>
          <Badge tone={evaluation.isGoodTechnique ? 'success' : 'warning'}>
            {evaluation.isGoodTechnique ? 'Good technique' : 'Needs work'}
          </Badge>
        </div>
        <Badge size="lg" tone={scoreTone(evaluation.score)}>{evaluation.score}%</Badge>
      </div>

      <p className="results-summary">{evaluation.overallSummary}</p>
      <p className="results-explanation">{evaluation.scoreExplanation}</p>

      {evaluation.analized_video_url && (
        <div className="results-block analyzed-video-block">
          <h3><Icon name="camera" /> Analyzed video</h3>
          <video
            className="analyzed-video"
            src={evaluation.analized_video_url}
            controls
            playsInline
            preload="metadata"
          >
            Your browser does not support embedded video.{' '}
            <a href={evaluation.analized_video_url} target="_blank" rel="noreferrer">
              Open the analyzed video
            </a>
            .
          </video>
        </div>
      )}

      {evaluation.positiveFeedback.length > 0 && (
        <div className="results-block">
          <h3>What went well</h3>
          <ul className="positive-list">
            {evaluation.positiveFeedback.map(item => (
              <li key={item}><span className="tip-check"><Icon name="check" /></span>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {evaluation.issues.length > 0 && (
        <div className="results-block">
          <h3>Issues to address</h3>
          {evaluation.issues.map(issue => <IssueRow key={issue.title} issue={issue} />)}
        </div>
      )}

      {evaluation.recommendations.length > 0 && (
        <div className="results-block">
          <h3>Recommendations</h3>
          <ul className="recommend-list">
            {evaluation.recommendations.map(item => <li key={item}>{item}</li>)}
          </ul>
        </div>
      )}

      {/* General best practice for the lift, as opposed to findings about this
          set — kept in its own block so the two are never confused. */}
      {(evaluation.techniqueTips?.length ?? 0) > 0 && (
        <div className="results-block">
          <h3>Technique tips for {prettifyExercise(evaluation.exerciseType).toLowerCase()}</h3>
          <ul className="recommend-list">
            {evaluation.techniqueTips!.map(item => <li key={item}>{item}</li>)}
          </ul>
        </div>
      )}

      {(evaluation.dataReliabilityNote || evaluation.cameraView) && (
        <p className="reliability-note">
          {evaluation.cameraView && <strong>{evaluation.cameraView.replace(/_/g, ' ')}. </strong>}
          {evaluation.dataReliabilityNote}
        </p>
      )}

      <Button variant="secondary" onClick={onAnalyzeAnother}>Analyze another</Button>
    </Card>
  )
}

type SubmitPhase = 'idle' | 'preparing' | 'trimming' | 'analyzing'
type TrimmerStatus = 'unsupported' | 'loading' | 'ready' | 'failed'

// A range within this much of [0, duration] on both ends is treated as "the
// whole clip" - ffmpeg is skipped and the original file uploads byte-for-byte.
const FULL_RANGE_EPSILON = 0.05

const AiCoach = () => {
  const [file, setFile] = useState<File | null>(null)
  const [exerciseType, setExerciseType] = useState(EXERCISE_TYPES[0].value)
  const [side, setSide] = useState<BodySide>('left')
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null)
  const [phase, setPhase] = useState<SubmitPhase>('idle')
  const [trimProgress, setTrimProgress] = useState(0)
  const [trimmerStatus, setTrimmerStatus] = useState<TrimmerStatus>(
    isTrimSupported() ? 'loading' : 'unsupported'
  )
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [recent, setRecent] = useState<RecentAnalysis[]>([])
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [duration, setDuration] = useState<number | null>(null)
  const [range, setRange] = useState<TrimRange | null>(null)
  const [previewFailed, setPreviewFailed] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const jobTokenRef = useRef(0)

  const busy = phase !== 'idle'

  useEffect(() => {
    listAnalyses()
      .then(({ data }) => setRecent(data))
      .catch(() => setRecent([]))
  }, [])

  // Single place that owns the preview object URL's lifetime - covers both
  // "picked a different file" and unmount cleanup.
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  // Terminates the ffmpeg worker if the user navigates away mid-job.
  useEffect(() => () => cancelTrim(), [])

  const pickFile = (f: File | null) => {
    if (busy) return
    setError(null)
    setNotice(null)
    if (!f) return
    if (!ACCEPTED.includes(f.type)) {
      setError('Unsupported format. Use MP4, MOV, or WebM.')
      return
    }
    if (f.size > MAX_SIZE) {
      setError('File is too large. Maximum size is 100MB.')
      return
    }
    jobTokenRef.current += 1
    setDuration(null)
    setRange(null)
    setPreviewFailed(false)
    setTrimProgress(0)
    setFile(f)

    if (isTrimSupported()) {
      setTrimmerStatus('loading')
      preloadTrimmer()
        .then(() => setTrimmerStatus('ready'))
        .catch(() => setTrimmerStatus('failed'))
    }
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragActive(false)
    if (busy) return
    pickFile(e.dataTransfer.files?.[0] ?? null)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!file) {
      setError('Please choose a video first.')
      return
    }
    const token = ++jobTokenRef.current
    setPhase('preparing')
    setError(null)
    setNotice(null)
    setEvaluation(null)
    setTrimProgress(0)

    const isFullRange =
      !range || duration == null || (range.start <= FULL_RANGE_EPSILON && range.end >= duration - FULL_RANGE_EPSILON)

    let uploadFile = file
    if (!isFullRange && range && trimmerStatus === 'ready' && !previewFailed) {
      setPhase('trimming')
      try {
        uploadFile = await trimVideo(file, range.start, range.end, (ratio) => {
          if (jobTokenRef.current === token) setTrimProgress(ratio)
        })
      } catch {
        uploadFile = file
        if (jobTokenRef.current === token) {
          setNotice('Trimming failed — analyzing the full video instead.')
        }
      }
    }

    if (jobTokenRef.current !== token) return

    setPhase('analyzing')
    try {
      const { data } = await analyzeVideo(uploadFile, exerciseType, side)
      if (jobTokenRef.current !== token) return
      setEvaluation(data.evaluation)
      const { data: list } = await listAnalyses()
      setRecent(list)
    } catch {
      if (jobTokenRef.current === token) setError('Failed to analyze video. Please try again.')
    } finally {
      if (jobTokenRef.current === token) setPhase('idle')
    }
  }

  const analyzeAnother = () => {
    jobTokenRef.current += 1
    setEvaluation(null)
    setFile(null)
    setError(null)
    setNotice(null)
    setDuration(null)
    setRange(null)
    setPreviewFailed(false)
    setTrimProgress(0)
    setPhase('idle')
  }

  return (
    <main className="aicoach">
      <PageHeader
        title="AI Form Analysis"
        subtitle="Upload your exercise videos for real-time pose estimation and technique feedback"
      />

      <div className="aicoach-grid">
        <Card as="section" className="upload-card">
          <IconTile tone="blue" className="upload-icon"><Icon name="camera" /></IconTile>
          <h2>Upload Exercise Video</h2>
          <p className="upload-sub">Record or upload a video of your exercise for AI-powered analysis</p>

          <form onSubmit={handleSubmit}>
            <FormField label="Exercise type">
              <Select
                options={EXERCISE_TYPES}
                value={exerciseType}
                onValueChange={setExerciseType}
              />
            </FormField>

            <FormField
              label="Side facing the camera"
              hint="Pick the side of your body facing the camera for a more accurate analysis."
            >
              <div className="side-toggle" role="group" aria-label="Side facing the camera">
                {SIDES.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    className={side === value ? 'side-option active' : 'side-option'}
                    aria-pressed={side === value}
                    onClick={() => setSide(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </FormField>

            <div
              className={`dropzone${dragActive ? ' active' : ''}${busy ? ' is-locked' : ''}`}
              onClick={() => !busy && inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); if (!busy) setDragActive(true) }}
              onDragLeave={() => setDragActive(false)}
              onDrop={onDrop}
              role="button"
              tabIndex={busy ? -1 : 0}
              aria-disabled={busy}
            >
              <Icon name="upload" />
              {file ? (
                <>
                  <p className="dropzone-file">{file.name}</p>
                  <span>{formatSize(file.size)} · click to replace</span>
                </>
              ) : (
                <>
                  <p><strong>Click to upload</strong> or drag and drop</p>
                  <span>MP4, MOV, or WebM (max. 100MB)</span>
                </>
              )}
              <input
                ref={inputRef}
                type="file"
                accept="video/mp4,video/quicktime,video/webm"
                hidden
                disabled={busy}
                onChange={(e: ChangeEvent<HTMLInputElement>) => pickFile(e.target.files?.[0] ?? null)}
              />
            </div>

            {file && previewUrl && !previewFailed && (
              <VideoTrimmer
                src={previewUrl}
                value={range}
                onChange={setRange}
                onDurationChange={setDuration}
                onPreviewError={() => setPreviewFailed(true)}
                disabled={busy}
                hint="Cuts snap to the nearest keyframe, so up to a second before your start point may be included."
              />
            )}

            {file && previewFailed && (
              <Alert variant="info">Can&rsquo;t preview this video here — it will be analyzed in full.</Alert>
            )}

            {notice && <Alert variant="info">{notice}</Alert>}
            {error && <Alert variant="error">{error}</Alert>}

            {phase === 'trimming' && (
              <div className="trim-progress" role="progressbar" aria-valuenow={Math.round(trimProgress * 100)} aria-valuemin={0} aria-valuemax={100}>
                <span style={{ width: `${Math.round(trimProgress * 100)}%` }} />
              </div>
            )}

            <Button
              type="submit"
              fullWidth
              loading={busy}
              loadingLabel={
                phase === 'preparing'
                  ? 'Preparing…'
                  : phase === 'trimming'
                    ? `Trimming video… ${Math.round(trimProgress * 100)}%`
                    : 'Analyzing…'
              }
              disabled={!file || busy}
            >
              Analyze Video
            </Button>
          </form>
        </Card>

        <aside className="aicoach-side">
          <Card as="section" variant="info" className="how-card">
            <span className="how-icon"><Icon name="activity" /></span>
            <h2>How It Works</h2>
            <ol>
              {HOW_IT_WORKS.map((step, i) => (
                <li key={step}><span>{i + 1}.</span> {step}</li>
              ))}
            </ol>
          </Card>

          <Card as="section" className="tips-card">
            <CardHeader title="Tips for Best Results" />
            <ul>
              {TIPS.map(tip => (
                <li key={tip}><span className="tip-check"><Icon name="check" /></span>{tip}</li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>

      {evaluation && <ResultsPanel evaluation={evaluation} onAnalyzeAnother={analyzeAnother} />}

      <Card as="section" className="recent-analyses">
        <CardHeader title="Recent Analyses" />
        {recent.length === 0 ? (
          <EmptyState>No analyses yet — upload a video to get started.</EmptyState>
        ) : (
          recent.map(item => (
            <article className="recent-row" key={item.id}>
              <div className="recent-main">
                <div className="recent-title">
                  <strong>{prettifyExercise(item.exerciseName)}</strong>
                  <Badge tone={scoreTone(item.score)}>{item.score}%</Badge>
                </div>
                <p className="recent-date">{formatDate(item.createdAt)}</p>
                <p className="recent-summary">{item.summary}</p>
                {item.issuesCount > 0 && (
                  <p className="recent-warning">
                    <Icon name="alert" /> {item.issuesCount} {item.issuesCount === 1 ? 'issue' : 'issues'} detected
                  </p>
                )}
              </div>
              <span className="recent-trend"><Icon name="trend" /></span>
            </article>
          ))
        )}
      </Card>
    </main>
  )
}

export default AiCoach
