/** Joins truthy class name parts. Falsy values are dropped, enabling
 *  `cx('gb-x', condition && 'gb-x--mod', className)`. */
export const cx = (...parts: Array<string | false | null | undefined>): string =>
  parts.filter((part): part is string => typeof part === 'string' && part.length > 0).join(' ')
