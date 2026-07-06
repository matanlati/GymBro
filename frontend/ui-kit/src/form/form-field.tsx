import { useId, useMemo } from 'react'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { FormFieldContext } from './form-field-context'
import type { FormFieldContextValue } from './form-field-context'
import { cx } from '../utils/cx'
import './form-field.css'

export type FormFieldProps = {
  label: ReactNode
  /** Muted helper line under the control. */
  hint?: ReactNode
  /** Error line under the control; also flags the control via aria-invalid. */
  error?: ReactNode
  /** Override the auto-generated control id (e.g. when the child sets its own). */
  htmlFor?: string
  children: ReactNode
} & Omit<ComponentPropsWithoutRef<'div'>, 'children'>

const FormField = ({ label, hint, error, htmlFor, className, children, ...rest }: FormFieldProps) => {
  const autoId = useId()
  const controlId = htmlFor ?? autoId
  const hintId = hint != null ? `${controlId}-hint` : undefined
  const errorId = error != null ? `${controlId}-error` : undefined

  const context = useMemo<FormFieldContextValue>(
    () => ({
      controlId,
      describedBy: [errorId, hintId].filter(Boolean).join(' ') || undefined,
      invalid: error != null,
    }),
    [controlId, hintId, errorId],
  )

  return (
    <div className={cx('gb-field', className)} {...rest}>
      <label className="gb-field__label" htmlFor={controlId}>
        {label}
      </label>
      <FormFieldContext.Provider value={context}>{children}</FormFieldContext.Provider>
      {hint != null && (
        <small id={hintId} className="gb-field__hint">
          {hint}
        </small>
      )}
      {error != null && (
        <p id={errorId} className="gb-field__error">
          {error}
        </p>
      )}
    </div>
  )
}

export default FormField
