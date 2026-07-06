import { createContext, useContext } from 'react'

export type FormFieldContextValue = {
  /** id the wrapping FormField's <label> points at. */
  controlId: string
  /** id(s) of the hint/error nodes, for aria-describedby. */
  describedBy: string | undefined
  invalid: boolean
}

export const FormFieldContext = createContext<FormFieldContextValue | null>(null)

/** Read the enclosing FormField's wiring (null outside a FormField).
 *  Input/Select/Textarea use this to pick up id + aria attributes automatically. */
export const useFormField = (): FormFieldContextValue | null => useContext(FormFieldContext)
