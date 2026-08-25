"use client";

import { useEffect, useState } from "react";

import type { SaberHitting, SaberPitching, TeamRef } from "@/lib/mlb/types";
import RosterStatsTable from "./RosterStatsTable";

type Stats = {
  player: { id: number; fullName: string };
  position: string;
  stats: SaberHitting | SaberPitching | null;
};

interface TeamPayload {
  team: TeamRef;
  hitters: Stats[] | null;
  pitchers: Stats[] | null;
}

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "loaded"; away: TeamPayload; home: TeamPayload };

function teamBody(team: TeamPayload) {
  if (!team.hitters || !team.pitchers) {
    return <p className="text-ink/65 text-sm">No roster data available.</p>;
  }
  if (team.hitters.length === 0 && team.pitchers.length === 0) {
    return (
      <p className="text-ink/65 text-sm">No season stats available for this team.</p>
    );
  }
  return (
    <RosterStatsTable
      team={team.team}
      hitters={team.hitters}
      pitchers={team.pitchers}
    />
  );
}

/**
 * Per-team season sabermetric tables, loaded from
 * `/api/games/[gamePk]/roster-stats`.
 *
 * Enriching both rosters fans out to a dozen-plus upstream MLB Stats API
 * calls, so it runs in its own route handler — rendering it inline used to
 * push the game page's Worker invocation over the platform's per-request
 * subrequest limit and drop this section's data entirely.
 */
export default function RosterStatsSection({ gamePk }: { gamePk: number }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [fetchedGamePk, setFetchedGamePk] = useState(gamePk);
  if (fetchedGamePk !== gamePk) {
    // Adjusting state during render keeps a gamePk change from showing stale data.
    setFetchedGamePk(gamePk);
    setState({ status: "loading" });
  }

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/games/${gamePk}/roster-stats`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as { away: TeamPayload; home: TeamPayload };
      })
      .then((data) => {
        if (!cancelled) {
          setState({ status: "loaded", away: data.away, home: data.home });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [gamePk]);

  if (state.status === "loading") {
    return <div className="h-24 animate-pulse rounded bg-ink/10" />;
  }

  if (state.status === "error") {
    return (
      <p className="rounded-md border border-clay/40 bg-clay/10 px-3 py-2 text-sm text-clay">
        Couldn’t load season stats right now.
      </p>
    );
  }

  return (
    <div className="fade-in space-y-6">
      {teamBody(state.away)}
      {teamBody(state.home)}
    </div>
  );
}
