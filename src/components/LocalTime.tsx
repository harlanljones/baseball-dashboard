"use client";

import { useSyncExternalStore } from "react";

function format(
  iso: string,
  opts: { weekday?: boolean; timeZone?: string },
): string {
  return new Intl.DateTimeFormat("en-US", {
    ...(opts.timeZone ? { timeZone: opts.timeZone } : {}),
    ...(opts.weekday ? { weekday: "short" as const } : {}),
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(iso));
}

// The time zone never changes during a session, so there is nothing to
// subscribe to — useSyncExternalStore is used only for its server/client
// snapshot split.
const subscribe = () => () => {};

/**
 * A game start time. The server snapshot formats it in US Eastern so the HTML
 * is deterministic; once hydrated, the client snapshot re-renders it in the
 * viewer's own time zone, so a Pacific or European user sees their local time.
 */
export default function LocalTime({
  iso,
  weekday = false,
}: {
  iso: string;
  weekday?: boolean;
}) {
  const text = useSyncExternalStore(
    subscribe,
    () => (iso ? format(iso, { weekday }) : ""),
    () => (iso ? format(iso, { weekday, timeZone: "America/New_York" }) : ""),
  );

  if (!iso) return null;
  return <time dateTime={iso}>{text}</time>;
}

function formatHour(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-US", {
    ...(timeZone ? { timeZone } : {}),
    hour: "numeric",
    hour12: true,
  }).format(new Date(iso));
}

/**
 * Just the hour (e.g. "2 AM") of a timestamp, in the same viewer-local time
 * zone as `LocalTime` — SSR renders US Eastern for a deterministic snapshot,
 * then hydrates to the viewer's own time zone.
 */
export function LocalHour({ iso }: { iso: string }) {
  const text = useSyncExternalStore(
    subscribe,
    () => formatHour(iso),
    () => formatHour(iso, "America/New_York"),
  );

  return <time dateTime={iso}>{text}</time>;
}
