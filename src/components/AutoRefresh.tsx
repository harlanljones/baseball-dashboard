"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Periodically re-runs the server components on the current route by calling
 * `router.refresh()`. Only active when `enabled` (i.e. the server saw a live
 * game), so off-days and finished slates don't poll the MLB API. Polling
 * pauses while the tab is hidden and resumes (with one immediate refresh, so
 * the returning user isn't looking at stale scores) when it becomes visible.
 */
export default function AutoRefresh({
  enabled,
  intervalMs = 30_000,
}: {
  enabled: boolean;
  intervalMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;

    let id: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      id ??= setInterval(() => router.refresh(), intervalMs);
    };
    const stop = () => {
      if (id !== undefined) {
        clearInterval(id);
        id = undefined;
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        stop();
      } else {
        router.refresh();
        start();
      }
    };

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [enabled, intervalMs, router]);

  return null;
}
