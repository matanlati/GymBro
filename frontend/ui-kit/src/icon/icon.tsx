import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { cx } from '../utils/cx'

export type IconName =
  | 'home'
  | 'dumbbell'
  | 'spark'
  | 'chart'
  | 'user'
  | 'share'
  | 'calendar'
  | 'trend'
  | 'target'
  | 'weight'
  | 'trophy'
  | 'check'
  | 'checkCircle'
  | 'chevronLeft'
  | 'chevronRight'
  | 'x'
  | 'camera'
  | 'upload'
  | 'alert'
  | 'activity'
  | 'bolt'
  | 'rings'

/** Geometry only — stroke, size, and linecaps live on the <svg> in Icon.
 *  All paths are drawn on a 24×24 grid. */
const shapes: Record<IconName, ReactNode> = {
  home: (
    <>
      <path d="m3 10 9-7 9 7" />
      <path d="M5 10v10h14V10" />
      <path d="M10 20v-6h4v6" />
    </>
  ),
  dumbbell: (
    <>
      <path d="m6 6 12 12" />
      <path d="m4 8 4-4" />
      <path d="m16 20 4-4" />
      <path d="m2 10 8-8" />
      <path d="m14 22 8-8" />
    </>
  ),
  spark: (
    <>
      <path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z" />
      <path d="m19 3 .8 2.2L22 6l-2.2.8L19 9l-.8-2.2L16 6l2.2-.8Z" />
    </>
  ),
  chart: (
    <>
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="m7 15 4-4 3 3 5-7" />
    </>
  ),
  user: (
    <>
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
  share: (
    <>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 10.5 6.8-4" />
      <path d="m8.6 13.5 6.8 4" />
    </>
  ),
  calendar: (
    <>
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18" />
    </>
  ),
  trend: (
    <>
      <path d="m4 16 5-5 4 4 7-7" />
      <path d="M14 8h6v6" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  weight: (
    <>
      <path d="M6.5 8a5.5 5.5 0 0 1 11 0" />
      <path d="M5 8h14l-2 13H7Z" />
      <path d="M10 12h4" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M7 4h10v5a5 5 0 0 1-10 0Z" />
      <path d="M5 6H3a3 3 0 0 0 3 3h1" />
      <path d="M19 6h2a3 3 0 0 1-3 3h-1" />
    </>
  ),
  /** Bare tick. `checkCircle` is the enclosed variant — they are not interchangeable. */
  check: <path d="m20 6-11 11-5-5" />,
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  chevronLeft: <path d="m15 18-6-6 6-6" />,
  chevronRight: <path d="m9 18 6-6-6-6" />,
  x: (
    <>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </>
  ),
  camera: (
    <>
      <path d="m22 8-6 4 6 4V8Z" />
      <rect x="2" y="6" width="14" height="12" rx="2" />
    </>
  ),
  upload: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m17 8-5-5-5 5" />
      <path d="M12 3v12" />
    </>
  ),
  alert: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </>
  ),
  activity: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
  bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7Z" />,
  rings: (
    <>
      <circle cx="9" cy="12" r="5" />
      <circle cx="15" cy="12" r="5" />
    </>
  ),
}

export type IconProps = {
  name: IconName
  /** Edge length in px (or any CSS length). Parent rules that target `svg` —
   *  e.g. `.gb-icon-tile svg` — still win over this, as they do today. */
  size?: number | string
} & Omit<ComponentPropsWithoutRef<'svg'>, 'name'>

/** Decorative by default: `aria-hidden` is set so icons inside labelled buttons
 *  are not double-announced. Pass `aria-hidden={undefined}` plus a label when the
 *  glyph carries meaning on its own.
 *
 *  Deliberately ships no stylesheet — it inherits `currentColor` and is sized by
 *  the `size` prop or by whatever the parent already styles. */
const Icon = ({ name, size = 18, className, ...rest }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={cx('gb-icon', className)}
    {...rest}
  >
    {shapes[name]}
  </svg>
)

export default Icon
