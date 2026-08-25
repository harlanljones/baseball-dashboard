/**
 * Resolves an MLB game to an odds-provider event id. SportsGameOdds is the
 * primary provider (see `sgo.ts`); The Odds API remains as a fallback for
 * when no SportsGameOdds key is configured, its request fails, or it has
 * no event for the matchup.
 */

import { getOddsApiKey, oddsFetch } from "./client";import { findSgoEvent, getSgoApiKey, teamsMatch } from "./sgo";
import type { ResolvedOddsEvent } from "./types";

interface RawOddsApiEvent {
  id: string;
  commence_time: string;
  home_team: string;
  away_team: string;
}

/**
 * The Odds API lookup: resolves a game to their event id, or `null` if the
 * key is unset, the request fails, or no event matches. On a doubleheader
 * (two events for the same team pair on the same day) picks whichever
 * `commence_time` is closest to `startTimeISO`.
 */
export async function findTheOddsApiEvent(
  awayTeamName: string,
  homeTeamName: string,
  startTimeISO: string,
): Promise<string | null> {
  if (!getOddsApiKey()) return null;

  try {
    const events = await oddsFetch<RawOddsApiEvent[]>(
      "/v4/sports/baseball_mlb/events",
    );

    const matches = events.filter(
      (e) =>
        teamsMatch(e.home_team, homeTeamName) &&
        teamsMatch(e.away_team, awayTeamName),
    );
    if (matches.length === 0) return null;

    const startMs = new Date(startTimeISO).getTime();
    matches.sort(
      (a, b) =>
        Math.abs(new Date(a.commence_time).getTime() - startMs) -
        Math.abs(new Date(b.commence_time).getTime() - startMs),
    );
    return matches[0].id;
  } catch {
    return null;
  }
}

/**
 * Resolves a game to `{ provider, eventId }` using the primary provider
 * first: SportsGameOdds when `SPORTSGAMEODDS_API_KEY` is set, falling back
 * to The Odds API on error or when no matching event is found there.
 * Returns `null` when neither provider yields an event.
 */
export async function resolveOddsEvent(
  awayTeamName: string,
  homeTeamName: string,
  startTimeISO: string,
): Promise<ResolvedOddsEvent | null> {
  if (getSgoApiKey()) {
    try {
      const eventId = await findSgoEvent(awayTeamName, homeTeamName, startTimeISO);
      if (eventId) return { provider: "sgo", eventId };
    } catch {
      // Primary unavailable — fall through to the fallback provider.
    }
  }

  const eventId = await findTheOddsApiEvent(awayTeamName, homeTeamName, startTimeISO);
  return eventId ? { provider: "the-odds-api", eventId } : null;
}
