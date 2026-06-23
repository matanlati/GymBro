import { useState, useEffect, useRef, DragEvent, ChangeEvent, FormEvent } from 'react'
import {
  analyzeVideo,
  listAnalyses,
  Evaluation,
  EvaluationIssue,
  RecentAnalysis,
} from '../api/video.api'

const EXERCISE_TYPES = ['squat', 'deadlift', 'push-up', 'lunge', 'shoulder press', 'biceps curl']
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

const scoreTone = (score: number): 'green' | 'amber' | 'red' => {
  if (score >= 80) return 'green'
  if (score >= 60) return 'amber'
  return 'red'
}

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })

const formatSize = (bytes: number): string => `${(bytes / (1024 * 1024)).toFixed(1)} MB`

const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

const IssueRow = ({ issue }: { issue: EvaluationIssue }) => {
  const severity = ['low', 'medium', 'high'].includes(issue.severity) ? issue.severity : 'medium'
  return (
    <div className={`issue-row ${severity}`}>
      <div className="issue-head">
        <span className="issue-title"><Icon name="alert" /> {issue.title}</span>
        <span className={`severity-pill ${severity}`}>{severity}</span>
      </div>
      <p className="issue-explanation">{issue.explanation}</p>
      <p className="issue-suggestion"><strong>Fix:</strong> {issue.suggestion}</p>
    </div>
  )
}

const ResultsPanel = ({ evaluation, onAnalyzeAnother }: { evaluation: Evaluation; onAnalyzeAnother: () => void }) => {
  const tone = scoreTone(evaluation.score)
  return (
    <section className="panel results-panel">
      <div className="results-header">
        <div>
          <h2>{capitalize(evaluation.exerciseType)} — Analysis</h2>
          <span className={`technique-label ${evaluation.isGoodTechnique ? 'good' : 'bad'}`}>
            {evaluation.isGoodTechnique ? 'Good technique' : 'Needs work'}
          </span>
        </div>
        <span className={`score-badge large ${tone}`}>{evaluation.score}%</span>
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

      {(evaluation.dataReliabilityNote || evaluation.cameraView) && (
        <p className="reliability-note">
          {evaluation.cameraView && <strong>{evaluation.cameraView.replace(/_/g, ' ')}. </strong>}
          {evaluation.dataReliabilityNote}
        </p>
      )}

      <button type="button" className="back-button" onClick={onAnalyzeAnother}>Analyze another</button>
    </section>
  )
}

const AiCoach = () => {
  const [file, setFile] = useState<File | null>(null)
  const [exerciseType, setExerciseType] = useState(EXERCISE_TYPES[0])
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [recent, setRecent] = useState<RecentAnalysis[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    listAnalyses()
      .then(({ data }) => setRecent(data))
      .catch(() => setRecent([]))
  }, [])

  const pickFile = (f: File | null) => {
    setError(null)
    if (!f) return
    if (!ACCEPTED.includes(f.type)) {
      setError('Unsupported format. Use MP4, MOV, or WebM.')
      return
    }
    if (f.size > MAX_SIZE) {
      setError('File is too large. Maximum size is 100MB.')
      return
    }
    setFile(f)
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragActive(false)
    pickFile(e.dataTransfer.files?.[0] ?? null)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!file) {
      setError('Please choose a video first.')
      return
    }
    setLoading(true)
    setError(null)
    setEvaluation(null)
    try {
      const { data } = await analyzeVideo(file, exerciseType)
      setEvaluation(data.evaluation)
      const { data: list } = await listAnalyses()
      setRecent(list)
    } catch {
      setError('Failed to analyze video. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const analyzeAnother = () => {
    setEvaluation(null)
    setFile(null)
    setError(null)
  }

  return (
    <main className="aicoach">
      <header className="aicoach-header">
        <h1>AI Form Analysis</h1>
        <p>Upload your exercise videos for real-time pose estimation and technique feedback</p>
      </header>

      <div className="aicoach-grid">
        <section className="panel upload-card">
          <span className="icon-tile blue upload-icon"><Icon name="camera" /></span>
          <h2>Upload Exercise Video</h2>
          <p className="upload-sub">Record or upload a video of your exercise for AI-powered analysis</p>

          <form onSubmit={handleSubmit}>
            <label className="field">
              <span>Exercise type</span>
              <select
                value={exerciseType}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setExerciseType(e.target.value)}
              >
                {EXERCISE_TYPES.map(type => (
                  <option key={type} value={type}>{capitalize(type)}</option>
                ))}
              </select>
            </label>

            <div
              className={dragActive ? 'dropzone active' : 'dropzone'}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
              onDragLeave={() => setDragActive(false)}
              onDrop={onDrop}
              role="button"
              tabIndex={0}
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
                onChange={(e: ChangeEvent<HTMLInputElement>) => pickFile(e.target.files?.[0] ?? null)}
              />
            </div>

            {error && <p className="aicoach-error">{error}</p>}

            <button type="submit" className="primary-button" disabled={loading || !file}>
              {loading ? 'Analyzing…' : 'Analyze Video'}
            </button>
          </form>
        </section>

        <aside className="aicoach-side">
          <section className="how-card">
            <span className="how-icon"><Icon name="activity" /></span>
            <h2>How It Works</h2>
            <ol>
              {HOW_IT_WORKS.map((step, i) => (
                <li key={step}><span>{i + 1}.</span> {step}</li>
              ))}
            </ol>
          </section>

          <section className="panel tips-card">
            <h2>Tips for Best Results</h2>
            <ul>
              {TIPS.map(tip => (
                <li key={tip}><span className="tip-check"><Icon name="check" /></span>{tip}</li>
              ))}
            </ul>
          </section>
        </aside>
      </div>

      {evaluation && <ResultsPanel evaluation={evaluation} onAnalyzeAnother={analyzeAnother} />}

      <section className="panel recent-analyses">
        <h2>Recent Analyses</h2>
        {recent.length === 0 ? (
          <p className="recent-empty">No analyses yet — upload a video to get started.</p>
        ) : (
          recent.map(item => (
            <article className="recent-row" key={item.id}>
              <div className="recent-main">
                <div className="recent-title">
                  <strong>{capitalize(item.exerciseName)}</strong>
                  <span className={`score-badge ${scoreTone(item.score)}`}>{item.score}%</span>
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
      </section>
    </main>
  )
}

export default AiCoach
