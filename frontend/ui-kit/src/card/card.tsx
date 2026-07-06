import type { ComponentPropsWithoutRef, ElementType } from 'react'
import { cx } from '../utils/cx'
import './card.css'

/** Elements a Card may render as. Bounded so the extra props stay fully typed —
 *  e.g. `onSubmit` is only accepted together with `as="form"`. */
export type CardElement = 'div' | 'section' | 'article' | 'aside' | 'form'

export type CardVariant = 'default' | 'brand' | 'info'
export type CardPadding = 'none' | 'sm' | 'md' | 'lg'

export type CardProps<E extends CardElement = 'div'> = {
  as?: E
  /** brand / info render the gradient surfaces with white text. */
  variant?: CardVariant
  padding?: CardPadding
} & Omit<ComponentPropsWithoutRef<E>, 'as'>

const Card = <E extends CardElement = 'div'>({
  as,
  variant = 'default',
  padding = 'md',
  className,
  ...rest
}: CardProps<E>) => {
  const Tag: ElementType = as ?? 'div'
  // TS cannot correlate the generic rest props with the runtime tag inside a
  // polymorphic component; callers are still fully checked via CardProps<E>.
  const passthrough = rest as Record<string, unknown>
  return (
    <Tag
      className={cx(
        'gb-card',
        variant !== 'default' && `gb-card--${variant}`,
        padding !== 'none' && `gb-card--pad-${padding}`,
        className,
      )}
      {...passthrough}
    />
  )
}

export default Card
