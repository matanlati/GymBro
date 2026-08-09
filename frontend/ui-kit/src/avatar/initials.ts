/** First letter of the first two words, upper-cased — "Dana Okonkwo" → "DO".
 *  `fallback` is returned for a blank/whitespace-only name. */
export const initials = (name: string, fallback = ''): string =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || fallback
