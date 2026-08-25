"use client";

import { useEffect, useState } from "react";

import type { MatchupSide } from "@/lib/mlb/types";
import MatchupTable from "./MatchupTable";
import StatGradeLegend from "./StatGradeLegend";

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "loaded"; awayPitching: MatchupSide; homePitching: MatchupSide };

/**
 * Batter-vs-pitcher matchup tables, loaded from `/api/games/[gamePk]/matchups`.
 *
 * The lookup fans out to a dozen-plus upstream MLB Stats API calls, so it runs
 * in its own route handler — rendering it inline used to push the game page's
 * Worker invocation over the platform's per-request subrequest limit and drop
 * this section's data entirely.
 */
export default function MatchupsSection({ gamePk }: { gamePk: number }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [fetchedGamePk, setFetchedGamePk] = useState(gamePk);
  if (fetchedGamePk !== gamePk) {
    // Adjusting state during render keeps a gamePk change from showing stale data.
    setFetchedGamePk(gamePk);
    setState({ status: "loading" });
  }

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/games/${gamePk}/matchups`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as {
          awayPitching: MatchupSide;
          homePitching: MatchupSide;
        };
      })
      .then((data) => {
        if (!cancelled) {
          setState({
            status: "loaded",
            awayPitching: data.awayPitching,
            homePitching: data.homePitching,
          });
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
        Couldn’t load matchup history right now.
      </p>
    );
  }

  return (
    <div className="fade-in">
      <StatGradeLegend className="mb-4" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <MatchupTable side={state.awayPitching} gamePk={gamePk} />
        <MatchupTable side={state.homePitching} gamePk={gamePk} />
      </div>
    </div>
  );
}
