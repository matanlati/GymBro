import { FFmpeg } from '@ffmpeg/ffmpeg'
// Vite's `?url` suffix (typed generically by vite/client) resolves both of
// these to hashed same-origin asset URLs at build time - no CDN involved.
import coreURL from '@ffmpeg/core?url'
import wasmURL from '@ffmpeg/core/wasm?url'

// Drops audio from the trimmed clip: pose analysis never reads it, it shrinks
// the upload, and it removes a whole class of "can't stream-copy this audio
// codec" failures at the cut point. Flip if that ever stops being true.
const DROP_AUDIO = true

const MIME_TO_EXT: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
}

const TRIM_EXEC_TIMEOUT_MS = 120_000

export type TrimProgressCallback = (ratio: number) => void

export const isTrimSupported = (): boolean =>
  typeof WebAssembly === 'object' && typeof Worker !== 'undefined'

let instance: FFmpeg | null = null
let loadPromise: Promise<FFmpeg> | null = null

const ensureLoaded = (): Promise<FFmpeg> => {
  if (loadPromise) return loadPromise
  loadPromise = (async () => {
    const ffmpeg = new FFmpeg()
    if (import.meta.env.DEV) {
      ffmpeg.on('log', ({ message }) => console.debug('[ffmpeg]', message))
    }
    await ffmpeg.load({ coreURL, wasmURL })
    instance = ffmpeg
    return ffmpeg
  })()
  loadPromise.catch(() => {
    // A failed load must not stick around and be reused as a settled rejection.
    loadPromise = null
  })
  return loadPromise
}

// Kicks off the (multi-second, first-time-only) module load ahead of time so
// it's not sitting on the critical path when the user hits submit. Safe to
// call repeatedly - subsequent calls just await the same in-flight/settled load.
export const preloadTrimmer = async (): Promise<void> => {
  if (!isTrimSupported()) return
  await ensureLoaded()
}

export const cancelTrim = (): void => {
  instance?.terminate()
  instance = null
  loadPromise = null
}

const extensionFor = (file: File): string => {
  const ext = MIME_TO_EXT[file.type]
  if (ext) return ext
  const fromName = file.name.split('.').pop()
  return fromName && fromName.length <= 4 ? fromName.toLowerCase() : 'mp4'
}

const trimmedName = (originalName: string, ext: string): string => {
  const base = originalName.replace(/\.[^./\\]+$/, '')
  return `${base || 'video'}-trimmed.${ext}`
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n))

const runExec = async (
  ffmpeg: FFmpeg,
  args: string[],
  onProgress?: TrimProgressCallback
): Promise<void> => {
  const onProgressEvent = onProgress
    ? ({ progress }: { progress: number }) => onProgress(clamp01(progress))
    : undefined
  if (onProgressEvent) ffmpeg.on('progress', onProgressEvent)
  try {
    const code = await ffmpeg.exec(args, TRIM_EXEC_TIMEOUT_MS)
    if (code !== 0) throw new Error(`ffmpeg exited with code ${code}`)
  } finally {
    if (onProgressEvent) ffmpeg.off('progress', onProgressEvent)
  }
}

const deleteQuietly = async (ffmpeg: FFmpeg, path: string): Promise<void> => {
  try {
    await ffmpeg.deleteFile(path)
  } catch {
    // Never produced or already gone - fine, this is best-effort cleanup.
  }
}

// Trims [start, end] (seconds) out of `file` and returns the result as a new
// File with the same MIME type/container as the input. Uses a fast stream
// copy (no re-encode) by default; falls back to a light re-encode once if
// the copy fails (e.g. an unremuxable stream), and finally rethrows so the
// caller can fall back to uploading the untrimmed original.
export const trimVideo = async (
  file: File,
  start: number,
  end: number,
  onProgress?: TrimProgressCallback
): Promise<File> => {
  const ffmpeg = await ensureLoaded()
  const ext = extensionFor(file)
  const input = `input.${ext}`
  const output = `output.${ext}`
  const duration = (end - start).toFixed(3)
  const ss = start.toFixed(3)

  try {
    await ffmpeg.writeFile(input, new Uint8Array(await file.arrayBuffer()))

    const copyArgs = [
      '-ss', ss,
      '-i', input,
      '-t', duration,
      '-c', 'copy',
      ...(DROP_AUDIO ? ['-an'] : []),
      '-avoid_negative_ts', 'make_zero',
      '-movflags', '+faststart',
      output,
    ]

    try {
      await runExec(ffmpeg, copyArgs, onProgress)
    } catch {
      // Stream copy can fail on streams it can't cut without re-encoding.
      // Retry once with a fast, frame-accurate re-encode.
      await deleteQuietly(ffmpeg, output)
      const reencodeArgs = [
        '-ss', ss,
        '-i', input,
        '-t', duration,
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '28',
        '-pix_fmt', 'yuv420p',
        ...(DROP_AUDIO ? ['-an'] : []),
        '-vf', "scale='min(720,iw)':-2",
        '-movflags', '+faststart',
        `output.mp4`,
      ]
      await runExec(ffmpeg, reencodeArgs, onProgress)
      const data = await ffmpeg.readFile('output.mp4')
      if (!(data instanceof Uint8Array) || data.byteLength === 0) {
        throw new Error('Trim produced an empty file')
      }
      await deleteQuietly(ffmpeg, 'output.mp4')
      // Re-wrap in a plain ArrayBuffer-backed Uint8Array: ffmpeg's FileData type
      // is generic over ArrayBufferLike (incl. SharedArrayBuffer), which BlobPart
      // doesn't accept.
      return new File([new Uint8Array(data)], trimmedName(file.name, 'mp4'), {
        type: 'video/mp4',
        lastModified: Date.now(),
      })
    }

    const data = await ffmpeg.readFile(output)
    if (!(data instanceof Uint8Array) || data.byteLength === 0) {
      throw new Error('Trim produced an empty file')
    }
    return new File([new Uint8Array(data)], trimmedName(file.name, ext), {
      type: file.type,
      lastModified: Date.now(),
    })
  } finally {
    await deleteQuietly(ffmpeg, input)
    await deleteQuietly(ffmpeg, output)
  }
}
