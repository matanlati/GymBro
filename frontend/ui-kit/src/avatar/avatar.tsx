import type { ComponentPropsWithoutRef } from 'react'
import { cx } from '../utils/cx'
import { initials } from './initials'
import './avatar.less'

export type AvatarSize = 'sm' | 'md' | 'lg'
export type AvatarTone = 'soft' | 'solid'
export type AvatarShape = 'circle' | 'rounded'

export type AvatarProps = {
  /** Drives the initials and, for photos, the default alt text. */
  name: string
  /** When set, the photo replaces the initials and the tone is not visible. */
  photoUrl?: string
  size?: AvatarSize
  /** soft = tinted tile with accent initials, solid = accent tile with white initials. */
  tone?: AvatarTone
  shape?: AvatarShape
  /** Shown instead of initials when `name` is blank. */
  fallback?: string
} & ComponentPropsWithoutRef<'span'>

/** Identity tile for a person: their photo, or their initials on a tinted tile.
 *  Decorative by default — the owner's name is expected to sit next to it in the
 *  markup, so the tile is hidden from screen readers to avoid reading it twice.
 *  Pass `aria-hidden={undefined}` and a label when the tile stands alone. */
const Avatar = ({
  name,
  photoUrl,
  size = 'md',
  tone = 'soft',
  shape = 'circle',
  fallback = '',
  className,
  ...rest
}: AvatarProps) => (
  <span
    aria-hidden="true"
    className={cx(
      'gb-avatar',
      `gb-avatar--${size}`,
      `gb-avatar--${shape}`,
      photoUrl == null && `gb-avatar--${tone}`,
      className,
    )}
    {...rest}
  >
    {photoUrl != null ? (
      <img className="gb-avatar__photo" src={photoUrl} alt="" />
    ) : (
      initials(name, fallback)
    )}
  </span>
)

export default Avatar
