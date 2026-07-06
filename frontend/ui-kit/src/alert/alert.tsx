import type { ComponentPropsWithoutRef } from 'react'
import { cx } from '../utils/cx'
import './alert.less'

export type AlertVariant = 'info' | 'success' | 'error'

export type AlertProps = {
  /** Required on purpose — every call site must state its intent. */
  variant: AlertVariant
} & ComponentPropsWithoutRef<'div'>

const Alert = ({ variant, role, className, children, ...rest }: AlertProps) => (
  <div
    role={role ?? (variant === 'error' ? 'alert' : 'status')}
    className={cx('gb-alert', `gb-alert--${variant}`, className)}
    {...rest}
  >
    {children}
  </div>
)

export default Alert
