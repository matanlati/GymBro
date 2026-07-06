import type { BadgeTone } from './badge'

/** Maps a 0-100 form-quality score to a Badge tone.
 *  Thresholds match the AI Coach evaluator convention: ≥80 good, ≥60 fair. */
export const scoreTone = (score: number): BadgeTone =>
  score >= 80 ? 'success' : score >= 60 ? 'warning' : 'danger'
