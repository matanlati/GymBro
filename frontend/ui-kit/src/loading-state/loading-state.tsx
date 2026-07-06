import type { ComponentPropsWithoutRef } from 'react'
import { cx } from '../utils/cx'
import './loading-state.less'

export type LoadingStateProps = {
  label?: string
} & ComponentPropsWithoutRef<'p'>

/** In-flow loading placeholder; announced politely to screen readers. */
const LoadingState = ({ label = 'Loading…', className, ...rest }: LoadingStateProps) => (
  <p role="status" className={cx('gb-loading-state', className)} {...rest}>
    {label}
  </p>
)

export default LoadingState
