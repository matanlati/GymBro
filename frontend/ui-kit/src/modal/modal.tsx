import { useEffect, useId } from 'react'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import Icon from '../icon/icon'
import { cx } from '../utils/cx'
import './modal.less'

export type ModalSize = 'sm' | 'md' | 'lg'
export type ModalRole = 'dialog' | 'alertdialog'
export type ModalAlign = 'start' | 'center'

export type ModalProps = {
  /** Called by the close button, the backdrop, and Escape. The parent owns
   *  whether the modal is mounted — render it conditionally as usual. */
  onClose: () => void
  title: ReactNode
  /** Muted line under the title. */
  description?: ReactNode
  /** Footer slot, right-aligned. Omit when the buttons live inside `children`
   *  (e.g. inside a form that wraps the whole body). */
  actions?: ReactNode
  /** alertdialog for destructive confirmations that must interrupt. */
  role?: ModalRole
  /** sm = 440px, md = 620px, lg = 760px. */
  size?: ModalSize
  /** Rendered above the title. Pair with `align="center"` for confirm dialogs. */
  icon?: ReactNode
  /** center stacks icon/title/description and centers the actions — the
   *  destructive-confirm layout. start is the default title-left, close-right head. */
  align?: ModalAlign
  /** Blocks Escape and backdrop dismissal — use while a request is in flight. */
  dismissDisabled?: boolean
  /** Hides the header close button; Escape and the backdrop still work. */
  hideCloseButton?: boolean
  closeLabel?: string
  /** Extra classes for the panel. `className` targets the backdrop. */
  panelClassName?: string
  children?: ReactNode
} & Omit<ComponentPropsWithoutRef<'div'>, 'role' | 'title' | 'onClose'>

/** Centered dialog over a dimming backdrop.
 *
 *  Note on `useEffect`: the kit is otherwise effect-free, but Escape-to-close
 *  needs a window listener. It owns no state — it only calls `onClose` — so the
 *  parent still drives everything. */
const Modal = ({
  onClose,
  title,
  description,
  actions,
  role = 'dialog',
  size = 'sm',
  icon,
  align = 'start',
  dismissDisabled = false,
  hideCloseButton = false,
  closeLabel = 'Close',
  panelClassName,
  className,
  children,
  ...rest
}: ModalProps) => {
  const titleId = useId()

  useEffect(() => {
    if (dismissDisabled) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dismissDisabled, onClose])

  return (
    <div
      role="presentation"
      className={cx('gb-modal-backdrop', className)}
      onClick={() => !dismissDisabled && onClose()}
      {...rest}
    >
      <section
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        className={cx(
          'gb-modal',
          size !== 'sm' && `gb-modal--${size}`,
          align === 'center' && 'gb-modal--center',
          panelClassName,
        )}
        onClick={event => event.stopPropagation()}
      >
        <div className="gb-modal__head">
          <div>
            {icon != null && <div className="gb-modal__icon">{icon}</div>}
            <h2 id={titleId} className="gb-modal__title">
              {title}
            </h2>
            {description != null && <p className="gb-modal__description">{description}</p>}
          </div>
          {!hideCloseButton && (
            <button
              type="button"
              aria-label={closeLabel}
              disabled={dismissDisabled}
              className="gb-modal__close"
              onClick={onClose}
            >
              <Icon name="x" size={17} />
            </button>
          )}
        </div>

        {children}

        {actions != null && <div className="gb-modal__actions">{actions}</div>}
      </section>
    </div>
  )
}

export default Modal
