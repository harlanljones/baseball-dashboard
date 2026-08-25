"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Periodically re-runs the server components on the current route by calling
 * `router.refresh()`. Only active when `enabled` (i.e. the server saw a live
 * game), so off-days and finished slates don't poll the MLB API. Polling
 * pauses while the tab is hidden and resumes (with one immediate refresh, so
 * the returning user isn't looking at stale scores) when it becomes visible.
 *
 * While active it also renders the live-status pill, so the silent background
 * polling is visible: dot, freshness ("updated Ns ago"), and an sr-only note.
 */
export default function AutoRefresh({
  enabled,
  intervalMs = 30_000,
}: {
  enabled: boolean;
  intervalMs?: number;
}) {
  const router = useRouter();
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let id: ReturnType<typeof setInterval> | undefined;
    let ticker: ReturnType<typeof setInterval> | undefined;
    const refresh = () => {
      router.refresh();
      setLastRefreshedAt(Date.now());
    };
    const start = () => {
      id ??= setInterval(refresh, intervalMs);
      ticker ??= setInterval(() => setNow(Date.now()), 1_000);
    };
    const stop = () => {
      if (id !== undefined) {
        clearInterval(id);
        id = undefined;
      }
      if (ticker !== undefined) {
        clearInterval(ticker);
        ticker = undefined;
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        stop();
      } else {
        refresh();
        start();
      }
    };

    if (!document.hidden) {
      start();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [enabled, intervalMs, router]);

  if (!enabled) return null;

  const secondsAgo =
    now == null || lastRefreshedAt == null
      ? null
      : Math.max(0, Math.round((now - lastRefreshedAt) / 1000));

  return (
    <div
      role="status"
      className="fixed bottom-3 right-3 z-20 flex items-center gap-1.5 rounded-full bg-field px-3 py-1.5 text-xs font-medium text-white shadow-md"
    >
      <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold" />
      <span>
        Live · scores update automatically
        {secondsAgo != null && (
          <span aria-hidden>
            {" "}
            · updated{" "}
            <span className="nums font-mono">{secondsAgo}</span>s ago
          </span>
        )}
      </span>
    </div>
  );
}
