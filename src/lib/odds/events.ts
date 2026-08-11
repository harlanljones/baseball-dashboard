import { getOddsApiKey, oddsFetch, TTL } from "./client";

interface RawOddsEvent {
  id: string;
  commence_time: string;
  home_team: string;
  away_team: string;
}

function teamsMatch(oddsName: string, mlbName: string): boolean {
  const a = oddsName.trim().toLowerCase();
  const b = mlbName.trim().toLowerCase();
  return a === b || a.includes(b) || b.includes(a);
}

/**
 * Resolves an MLB game (identified by team names + start time) to the Odds
 * API's event id for that matchup, or `null` if the key is unset, the
 * request fails, or no event matches. On a doubleheader (two events for the
 * same team pair on the same day) picks whichever `commence_time` is closest
 * to `startTimeISO`.
 */
export async function findOddsEvent(
  awayTeamName: string,
  homeTeamName: string,
  startTimeISO: string,
): Promise<string | null> {
  if (!getOddsApiKey()) return null;

  let events: RawOddsEvent[];
  try {
    events = await oddsFetch<RawOddsEvent[]>(
      "/v4/sports/baseball_mlb/events",
      {},
      TTL.odds,
    );
  } catch {
    return null;
  }

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
}
