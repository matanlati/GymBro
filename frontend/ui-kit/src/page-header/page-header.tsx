import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { cx } from '../utils/cx'
import './page-header.css'

export type PageHeaderProps = {
  title: ReactNode
  subtitle?: ReactNode
  /** Right-aligned slot for buttons or badges. */
  actions?: ReactNode
} & Omit<ComponentPropsWithoutRef<'header'>, 'title'>

const PageHeader = ({ title, subtitle, actions, className, ...rest }: PageHeaderProps) => (
  <header className={cx('gb-page-header', className)} {...rest}>
    <div className="gb-page-header__titles">
      <h1 className="gb-page-header__title">{title}</h1>
      {subtitle != null && <p className="gb-page-header__subtitle">{subtitle}</p>}
    </div>
    {actions != null && <div className="gb-page-header__actions">{actions}</div>}
  </header>
)

export default PageHeader
