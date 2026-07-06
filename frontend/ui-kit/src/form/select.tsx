import type { ChangeEvent, ComponentPropsWithoutRef } from 'react'
import { useFormField } from './form-field-context'
import { cx } from '../utils/cx'
import './controls.less'

export type SelectOption<V extends string = string> = {
  value: V
  label: string
  disabled?: boolean
}

export type SelectProps<V extends string = string> = {
  options: readonly SelectOption<V>[]
  /** Rendered as an empty-value first option; pair with `required` to force a choice. */
  placeholder?: string
  /** '' means "nothing selected" (the placeholder option). */
  value: V | ''
  /** Fires with the typed option value instead of a raw DOM event. */
  onValueChange: (value: V) => void
} & Omit<ComponentPropsWithoutRef<'select'>, 'value' | 'onChange' | 'children'>

/** Typed native select: `value`/`onValueChange` are constrained to the union of
 *  the option values, so a mismatched handler is a compile error. */
const Select = <V extends string = string>({
  options,
  placeholder,
  value,
  onValueChange,
  id,
  className,
  ...rest
}: SelectProps<V>) => {
  const field = useFormField()

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    // The DOM only ever reports values we rendered below, all of which are V.
    onValueChange(event.target.value as V)
  }

  return (
    <select
      id={id ?? field?.controlId}
      aria-invalid={field?.invalid || undefined}
      aria-describedby={field?.describedBy}
      className={cx('gb-control', 'gb-select', className)}
      value={value}
      onChange={handleChange}
      {...rest}
    >
      {placeholder != null && <option value="">{placeholder}</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

export default Select
