import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { cx } from '../utils/cx'
import './card-header.css'

export type CardHeaderProps = {
  title: ReactNode
  /** Small uppercase accent line above the title. */
  eyebrow?: ReactNode
  /** Right-aligned slot: an icon, a select, a button… */
  trailing?: ReactNode
  /** Heading element for `title`. Defaults to h2. */
  headingLevel?: 2 | 3
} & Omit<ComponentPropsWithoutRef<'header'>, 'title'>

const CardHeader = ({
  title,
  eyebrow,
  trailing,
  headingLevel = 2,
  className,
  ...rest
}: CardHeaderProps) => {
  const Heading = headingLevel === 2 ? 'h2' : 'h3'
  return (
    <header className={cx('gb-card-header', className)} {...rest}>
      <div className="gb-card-header__titles">
        {eyebrow != null && <span className="gb-card-header__eyebrow">{eyebrow}</span>}
        <Heading className="gb-card-header__title">{title}</Heading>
      </div>
      {trailing != null && <div className="gb-card-header__trailing">{trailing}</div>}
    </header>
  )
}

export default CardHeader
