import { forwardRef } from 'react'
import type { ComponentPropsWithoutRef } from 'react'
import { useFormField } from './form-field-context'
import { cx } from '../utils/cx'
import './controls.less'

export type InputProps = ComponentPropsWithoutRef<'input'>

const Input = forwardRef<HTMLInputElement, InputProps>(({ id, className, ...rest }, ref) => {
  const field = useFormField()
  return (
    <input
      ref={ref}
      id={id ?? field?.controlId}
      aria-invalid={field?.invalid || undefined}
      aria-describedby={field?.describedBy}
      className={cx('gb-control', 'gb-input', className)}
      {...rest}
    />
  )
})

Input.displayName = 'Input'

export default Input
