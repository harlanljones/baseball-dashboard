/**
 * Pure geometry for the game page's resizable split pane (IDE-style divider
 * between the main content and the player props panel). Kept DOM-free so it
 * can run under vitest's node environment like the rest of `src/lib`.
 */

export const MIN_PANE_PCT = 20;
export const MAX_PANE_PCT = 75;
export const DEFAULT_PANE_PCT = 50;
export const PANE_STORAGE_KEY = "baseball-dashboard:props-pane-pct";

/** Clamps a percentage into the pane's allowed [MIN_PANE_PCT, MAX_PANE_PCT] range. */
export function clampPanePct(pct: number): number {
  return Math.min(MAX_PANE_PCT, Math.max(MIN_PANE_PCT, pct));
}

/**
 * Converts a pointer's clientX during a drag into a clamped props-pane width
 * percentage. The props pane is right-anchored, so the pane grows as the
 * pointer moves left within the shell's bounding rect.
 */
export function panePctFromPointer(
  clientX: number,
  rect: { left: number; right: number; width: number },
): number {
  if (rect.width <= 0) return DEFAULT_PANE_PCT;
  const pct = ((rect.right - clientX) / rect.width) * 100;
  return clampPanePct(pct);
}

/**
 * Parses a persisted pane width, rejecting anything that isn't a finite
 * number in range so corrupted/tampered `localStorage` falls back to the
 * default rather than producing a collapsed or oversized pane.
 */
export function parseStoredPanePct(raw: string | null): number | null {
  if (raw === null) return null;
  const pct = Number(raw);
  if (!Number.isFinite(pct)) return null;
  if (pct < MIN_PANE_PCT || pct > MAX_PANE_PCT) return null;
  return pct;
}
