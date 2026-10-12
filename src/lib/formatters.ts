/**
 * Shared `Intl.DateTimeFormat` instances.
 *
 * Building a formatter costs ~19µs, about thirty times what formatting with it
 * costs (~0.6µs), and these calls run once per rendered row: one per game card
 * on a slate, one per meeting in a head-to-head series, one per date in a table.
 * A page of dates would otherwise rebuild the same formatter dozens of times
 * inside a single render.
 *
 * Instances are cached per locale + option set. The cache is unbounded by
 * design: keys come from a handful of literal option objects in this codebase,
 * not from user input.
 */
const FORMATTERS = new Map<string, Intl.DateTimeFormat>();

/** A cached `Intl.DateTimeFormat` for `locale` + `options`. */
export function dateFormatter(
  locale: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = FORMATTERS.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    FORMATTERS.set(key, formatter);
  }
  return formatter;
}
