import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { cx } from '../utils/cx'
import './empty-state.less'

export type EmptyStateProps = {
  icon?: ReactNode
  /** Optional call-to-action rendered under the message. */
  action?: ReactNode
} & ComponentPropsWithoutRef<'div'>

/** Muted "nothing here yet" block for lists, charts, and dashboards.
 *  Children are the message. */
const EmptyState = ({ icon, action, className, children, ...rest }: EmptyStateProps) => (
  <div className={cx('gb-empty-state', className)} {...rest}>
    {icon != null && (
      <span className="gb-empty-state__icon" aria-hidden="true">
        {icon}
      </span>
    )}
    <p className="gb-empty-state__message">{children}</p>
    {action != null && <div className="gb-empty-state__action">{action}</div>}
  </div>
)

export default EmptyState
