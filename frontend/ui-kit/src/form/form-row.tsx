import type { ComponentPropsWithoutRef } from 'react'
import { cx } from '../utils/cx'
import './form-row.css'

export type FormRowProps = ComponentPropsWithoutRef<'div'>

/** Two-column field row that collapses to one column on small screens. */
const FormRow = ({ className, ...rest }: FormRowProps) => (
  <div className={cx('gb-form-row', className)} {...rest} />
)

export default FormRow
