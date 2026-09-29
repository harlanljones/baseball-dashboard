"use client";

import { useEffect, useState } from "react";
import BackLink from "@/components/BackLink";

/**
 * Back link for pages that can be reached from a specific game (batter-vs-
 * pitcher history). The origin game travels in the URL hash — `#game=123` —
 * which keeps the route statically renderable; before hydration, or without
 * the marker, it falls back to the slate.
 */
export default function ContextualBackLink({
  fallbackHref = "/",
  fallbackLabel = "All games",
}: {
  fallbackHref?: string;
  fallbackLabel?: string;
}) {
  const [gamePk, setGamePk] = useState<number | null>(null);

  useEffect(() => {
    // Read the hash a tick after mount (client-only state without a
    // synchronous setState-in-effect).
    const id = requestAnimationFrame(() => {
      const match = window.location.hash.match(/game=(\d+)/);
      if (match) setGamePk(Number(match[1]));
    });
    return () => cancelAnimationFrame(id);
  }, []);

  if (gamePk != null) {
    return <BackLink href={`/games/${gamePk}`}>Back to the matchup</BackLink>;
  }
  return <BackLink href={fallbackHref}>{fallbackLabel}</BackLink>;
}
