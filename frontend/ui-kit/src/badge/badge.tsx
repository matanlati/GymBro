import type { ComponentPropsWithoutRef } from 'react'
import { cx } from '../utils/cx'
import './badge.css'

export type BadgeTone = 'success' | 'warning' | 'danger' | 'accent' | 'neutral' | 'info'
export type BadgeSize = 'md' | 'lg'

export type BadgeProps = {
  tone?: BadgeTone
  size?: BadgeSize
} & ComponentPropsWithoutRef<'span'>

const Badge = ({ tone = 'neutral', size = 'md', className, children, ...rest }: BadgeProps) => (
  <span
    className={cx('gb-badge', `gb-badge--${tone}`, size === 'lg' && 'gb-badge--lg', className)}
    {...rest}
  >
    {children}
  </span>
)

export default Badge
