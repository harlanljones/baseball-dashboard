"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Periodically re-runs the server components on the current route by calling
 * `router.refresh()`. Only active when `enabled` (i.e. the server saw a live
 * game), so off-days and finished slates don't poll the MLB API.
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
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs, router]);

  return null;
}
