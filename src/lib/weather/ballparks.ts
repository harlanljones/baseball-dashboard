import type { Ballpark } from "./types";

// CF bearings are best-effort estimates rounded to the nearest 5°, researched from public
// stadium-orientation and elevation sources
export const BALLPARKS: Record<number, Ballpark> = {};

export function getBallpark(venueId: number | undefined): Ballpark | null {
  return venueId != null ? (BALLPARKS[venueId] ?? null) : null;
}
