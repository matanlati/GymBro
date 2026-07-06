import { forwardRef } from 'react'
import type { ComponentPropsWithoutRef } from 'react'
import { useFormField } from './form-field-context'
import { cx } from '../utils/cx'
import './controls.css'

export type TextareaProps = ComponentPropsWithoutRef<'textarea'>

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({ id, className, ...rest }, ref) => {
  const field = useFormField()
  return (
    <textarea
      ref={ref}
      id={id ?? field?.controlId}
      aria-invalid={field?.invalid || undefined}
      aria-describedby={field?.describedBy}
      className={cx('gb-control', 'gb-textarea', className)}
      {...rest}
    />
  )
})

Textarea.displayName = 'Textarea'

export default Textarea
