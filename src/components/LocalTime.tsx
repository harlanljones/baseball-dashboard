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
