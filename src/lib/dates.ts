/**
 * Whole calendar days between two YYYY-MM-DD dates, UTC date math only — no
 * clocks. Positive when `to` is after `from`, negative when it's before.
 */
export function daysBetween(from: string, to: string): number {
  const a = Date.UTC(...parseDate(from));
  const b = Date.UTC(...parseDate(to));
  return Math.round((b - a) / 86_400_000);
}

function parseDate(date: string): [number, number, number] {
  const [year, month, day] = date.split("-").map(Number);
  return [year, month - 1, day];
}
