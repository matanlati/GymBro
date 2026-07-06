import type { ComponentPropsWithoutRef } from 'react'
import { cx } from '../utils/cx'
import './icon-tile.css'

export type IconTileTone = 'orange' | 'green' | 'blue' | 'red' | 'yellow'
export type IconTileSize = 'sm' | 'md'

export type IconTileProps = {
  tone: IconTileTone
  size?: IconTileSize
} & ComponentPropsWithoutRef<'span'>

/** Rounded tinted square holding a decorative icon (hidden from screen readers
 *  by default — pass aria-hidden={undefined} and a label if it carries meaning). */
const IconTile = ({ tone, size = 'md', className, children, ...rest }: IconTileProps) => (
  <span
    aria-hidden="true"
    className={cx('gb-icon-tile', `gb-icon-tile--${tone}`, `gb-icon-tile--${size}`, className)}
    {...rest}
  >
    {children}
  </span>
)

export default IconTile
