import { useEffect, useRef, useState, PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Button } from '@gymbro/ui-kit'

export type TrimRange = { start: number; end: number }

export const MIN_TRIM_SECONDS = 0.5

const LOOP_EPSILON = 0.03
const NUDGE = 0.1
const NUDGE_SHIFT = 1
const NUDGE_PAGE = 5

type Handle = 'start' | 'end'

type VideoTrimmerProps = {
  src: string
  value: TrimRange | null
  onChange: (range: TrimRange) => void
  onDurationChange: (duration: number) => void
  onPreviewError: () => void
  disabled?: boolean
  minDuration?: number
  hint?: string
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n))

const clampRange = (
  which: Handle,
  t: number,
  range: TrimRange,
  duration: number,
  minDuration: number
): TrimRange =>
  which === 'start'
    ? { start: Math.min(Math.max(t, 0), range.end - minDuration), end: range.end }
    : { start: range.start, end: Math.max(Math.min(t, duration), range.start + minDuration) }

const formatClock = (seconds: number): string => {
  const s = Math.max(0, seconds)
  const m = Math.floor(s / 60)
  const rem = (s - m * 60).toFixed(1).padStart(4, '0')
  return `${m}:${rem}`
}

const PlayIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 4v16l14-8L6 4Z" />
  </svg>
)

const PauseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="6" y="4" width="4" height="16" rx="1" />
    <rect x="14" y="4" width="4" height="16" rx="1" />
  </svg>
)

const VideoTrimmer = ({
  src,
  value,
  onChange,
  onDurationChange,
  onPreviewError,
  disabled = false,
  minDuration = MIN_TRIM_SECONDS,
  hint,
}: VideoTrimmerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const playheadRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ which: Handle; pointerId: number } | null>(null)
  const rangeRef = useRef(value)
  const durationRef = useRef<number | null>(null)

  const [duration, setDuration] = useState<number | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [dragging, setDragging] = useState<Handle | null>(null)

  useEffect(() => {
    rangeRef.current = value
  }, [value])

  useEffect(() => {
    durationRef.current = duration
  }, [duration])

  // Native `timeupdate` only fires a handful of times a second - fine for the
  // paused/scrubbing case and the text label, but too coarse for a smooth
  // playhead during playback (handled by the rAF loop below instead).
  const syncPlayheadFromTime = (t: number) => {
    setCurrentTime(t)
    const track = trackRef.current
    const playhead = playheadRef.current
    const d = durationRef.current
    if (track && playhead && d) {
      playhead.style.transform = `translateX(${(t / d) * track.clientWidth}px)`
    }
  }

  const finalizeDuration = (d: number) => {
    setDuration(d)
    onDurationChange(d)
    if (!rangeRef.current) {
      onChange({ start: 0, end: d })
    }
  }

  const handleLoadedMetadata = () => {
    const video = videoRef.current
    if (!video) return
    if (!Number.isFinite(video.duration)) {
      // Some fragmented/streamed containers report Infinity on first metadata -
      // seeking past the end forces the browser to resolve the real duration.
      const onDurationChange = () => {
        video.removeEventListener('durationchange', onDurationChange)
        video.currentTime = 0
        finalizeDuration(video.duration)
      }
      video.addEventListener('durationchange', onDurationChange)
      video.currentTime = 1e6
    } else {
      finalizeDuration(video.duration)
    }
  }

  // Drives the playhead at display refresh rate during playback, and loops
  // playback back to the selection start once it reaches the end.
  useEffect(() => {
    if (!playing) return
    let raf: number
    const tick = () => {
      const video = videoRef.current
      const range = rangeRef.current
      if (video && range) {
        let t = video.currentTime
        if (t >= range.end - LOOP_EPSILON || t < range.start - LOOP_EPSILON) {
          t = range.start
          video.currentTime = t
        }
        syncPlayheadFromTime(t)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !value) return
    // Keep the playhead glued to the live edge while a handle is dragged.
    if (dragging === 'start') syncPlayheadFromTime(value.start)
    if (dragging === 'end') syncPlayheadFromTime(value.end)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, dragging])

  const togglePlay = () => {
    const video = videoRef.current
    if (!video || !value) return
    if (playing) {
      video.pause()
      setPlaying(false)
    } else {
      if (video.currentTime < value.start || video.currentTime >= value.end) {
        video.currentTime = value.start
      }
      video.play().catch(() => {})
      setPlaying(true)
    }
  }

  const useFullVideo = () => {
    if (duration == null) return
    videoRef.current && (videoRef.current.currentTime = 0)
    onChange({ start: 0, end: duration })
  }

  const timeFromClientX = (clientX: number): number | null => {
    const track = trackRef.current
    if (!track || duration == null) return null
    const rect = track.getBoundingClientRect()
    return clamp01((clientX - rect.left) / rect.width) * duration
  }

  const handlePointerDown = (which: Handle) => (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled || !value || duration == null) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { which, pointerId: e.pointerId }
    setDragging(which)
    videoRef.current?.pause()
    setPlaying(false)
  }

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId || !value || duration == null) return
    const t = timeFromClientX(e.clientX)
    if (t == null) return
    onChange(clampRange(drag.which, t, value, duration, minDuration))
  }

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    dragRef.current = null
    setDragging(null)
  }

  const handleTrackPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled || duration == null || e.target !== trackRef.current) return
    const t = timeFromClientX(e.clientX)
    if (t == null) return
    const video = videoRef.current
    if (video) video.currentTime = t
    syncPlayheadFromTime(t)
  }

  const handleKeyDown = (which: Handle) => (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (disabled || !value || duration == null) return
    let next: TrimRange | null = null
    switch (e.key) {
      case 'ArrowLeft':
        next = clampRange(which, (which === 'start' ? value.start : value.end) - (e.shiftKey ? NUDGE_SHIFT : NUDGE), value, duration, minDuration)
        break
      case 'ArrowRight':
        next = clampRange(which, (which === 'start' ? value.start : value.end) + (e.shiftKey ? NUDGE_SHIFT : NUDGE), value, duration, minDuration)
        break
      case 'PageDown':
        next = clampRange(which, (which === 'start' ? value.start : value.end) - NUDGE_PAGE, value, duration, minDuration)
        break
      case 'PageUp':
        next = clampRange(which, (which === 'start' ? value.start : value.end) + NUDGE_PAGE, value, duration, minDuration)
        break
      case 'Home':
        next = which === 'start' ? { start: 0, end: value.end } : { start: value.start, end: value.start + minDuration }
        break
      case 'End':
        next = which === 'start' ? { start: value.end - minDuration, end: value.end } : { start: value.start, end: duration }
        break
      default:
        return
    }
    e.preventDefault()
    onChange(next)
    const video = videoRef.current
    if (video) video.currentTime = which === 'start' ? next.start : next.end
  }

  const startPct = value && duration ? (value.start / duration) * 100 : 0
  const endPct = value && duration ? (value.end / duration) * 100 : 100
  const selectedDuration = value ? value.end - value.start : 0

  return (
    <div className={`trimmer${disabled ? ' is-disabled' : ''}`} role="group" aria-label="Trim video">
      <video
        ref={videoRef}
        className="trimmer-video"
        src={src}
        muted
        playsInline
        preload="metadata"
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={(e) => !playing && syncPlayheadFromTime(e.currentTarget.currentTime)}
        onSeeked={(e) => syncPlayheadFromTime(e.currentTarget.currentTime)}
        onPause={() => setPlaying(false)}
        onError={onPreviewError}
      />

      {duration != null && value && (
        <>
          <div className="trimmer-controls">
            <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={togglePlay}>
              {playing ? <PauseIcon /> : <PlayIcon />}
              {playing ? 'Pause' : 'Preview selection'}
            </Button>
            <span className="trimmer-duration">
              Selected {formatClock(selectedDuration)} of {formatClock(duration)}
            </span>
            <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={useFullVideo}>
              Use full video
            </Button>
          </div>

          <div
            ref={trackRef}
            className="trimmer-track"
            onPointerDown={handleTrackPointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <div className="trimmer-selection" style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }} />
            <div
              className={`trimmer-handle trimmer-handle--start${dragging === 'start' ? ' is-dragging' : ''}`}
              style={{ left: `${startPct}%` }}
              role="slider"
              tabIndex={disabled ? -1 : 0}
              aria-label="Trim start"
              aria-valuemin={0}
              aria-valuemax={duration}
              aria-valuenow={value.start}
              aria-valuetext={formatClock(value.start)}
              aria-disabled={disabled}
              onPointerDown={handlePointerDown('start')}
              onPointerMove={handlePointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onKeyDown={handleKeyDown('start')}
            />
            <div
              className={`trimmer-handle trimmer-handle--end${dragging === 'end' ? ' is-dragging' : ''}`}
              style={{ left: `${endPct}%` }}
              role="slider"
              tabIndex={disabled ? -1 : 0}
              aria-label="Trim end"
              aria-valuemin={0}
              aria-valuemax={duration}
              aria-valuenow={value.end}
              aria-valuetext={formatClock(value.end)}
              aria-disabled={disabled}
              onPointerDown={handlePointerDown('end')}
              onPointerMove={handlePointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onKeyDown={handleKeyDown('end')}
            />
            <div ref={playheadRef} className="trimmer-playhead" />
          </div>

          <div className="trimmer-times">
            <span>{formatClock(value.start)}</span>
            <span>{formatClock(value.end)}</span>
          </div>

          <p aria-live="polite" className="sr-only">
            {`${formatClock(selectedDuration)} selected, from ${formatClock(value.start)} to ${formatClock(value.end)}`}
          </p>

          {hint && <p className="trimmer-hint">{hint}</p>}
        </>
      )}
    </div>
  )
}

export default VideoTrimmer
