import { forwardRef } from 'react'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { cx } from '../utils/cx'
import './button.css'

export type ButtonVariant = 'primary' | 'solid' | 'secondary' | 'ghost' | 'outline'
export type ButtonSize = 'sm' | 'md' | 'lg'

export type ButtonProps = {
  /** primary = brand gradient CTA, solid = flat accent, secondary = gray,
   *  ghost = borderless text, outline = white with accent border. */
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  /** Disables the button and swaps the label to `loadingLabel` (or keeps children). */
  loading?: boolean
  loadingLabel?: ReactNode
  leadingIcon?: ReactNode
} & ComponentPropsWithoutRef<'button'>

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      fullWidth = false,
      loading = false,
      loadingLabel,
      leadingIcon,
      type = 'button',
      disabled,
      className,
      children,
      ...rest
    },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cx(
        'gb-button',
        `gb-button--${variant}`,
        `gb-button--${size}`,
        fullWidth && 'gb-button--full',
        className,
      )}
      {...rest}
    >
      {!loading && leadingIcon != null && (
        <span className="gb-button__icon" aria-hidden="true">
          {leadingIcon}
        </span>
      )}
      {loading ? loadingLabel ?? children : children}
    </button>
  ),
)

Button.displayName = 'Button'

export default Button
