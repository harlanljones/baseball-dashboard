import { oddsFetch, TTL, getOddsApiKey } from "./client";
import { findTheOddsApiEvent, resolveOddsEvent } from "./events";
import { getSgoPlayerProps } from "./sgo";
import type { PlayerProp, PropMarketKey } from "./types";

const PROP_MARKETS: PropMarketKey[] = [
  "pitcher_strikeouts",
  "pitcher_outs",
  "batter_hits",
  "batter_total_bases",
  "batter_home_runs",
  "batter_rbis",
  "batter_walks",
];

interface RawOutcome {
  name: string; // "Over" | "Under"
  description?: string; // player name
  price: number;
  point?: number;
}

interface RawMarket {
  key: string;
  outcomes: RawOutcome[];
}

interface RawBookmaker {
  key: string;
  markets: RawMarket[];
}

interface RawEventOdds {
  id: string;
  bookmakers?: RawBookmaker[];
}

/**
 * Fetches player-prop odds for one The Odds API event across the 7 tracked
 * markets, from the first bookmaker in the response. Only outcome pairs
 * where both Over and Under exist with the same line are kept.
 */
export async function getPlayerProps(eventId: string): Promise<PlayerProp[]> {
  const res = await oddsFetch<RawEventOdds>(
    `/v4/sports/baseball_mlb/events/${eventId}/odds`,
    {
      regions: "us",
      markets: PROP_MARKETS.join(","),
      oddsFormat: "american",
    },
    TTL.odds,
  );

  const bookmaker = res.bookmakers?.[0];
  if (!bookmaker) return [];

  const props: PlayerProp[] = [];
  for (const market of bookmaker.markets) {
    if (!PROP_MARKETS.includes(market.key as PropMarketKey)) continue;

    const byPlayer = new Map<string, { over?: RawOutcome; under?: RawOutcome }>();
    for (const outcome of market.outcomes) {
      if (!outcome.description || outcome.point === undefined) continue;
      const entry = byPlayer.get(outcome.description) ?? {};
      if (outcome.name === "Over") entry.over = outcome;
      else if (outcome.name === "Under") entry.under = outcome;
      byPlayer.set(outcome.description, entry);
    }

    for (const [playerName, { over, under }] of byPlayer) {
      if (!over || !under || over.point !== under.point) continue;
      props.push({
        marketKey: market.key as PropMarketKey,
        playerName,
        line: over.point as number,
        overPrice: over.price,
        underPrice: under.price,
      });
    }
  }

  return props;
}

/**
 * Loads the tracked prop board for one MLB game, provider-agnostically.
 *
 * SportsGameOdds (primary) is consulted whenever its key is configured; a
 * failed request, an unresolved matchup, or an *empty* prop board — lines
 * often post later than the event listing itself — falls through to The
 * Odds API when `ODDS_API_KEY` is configured. Every failure mode resolves
 * to `[]`; this function never throws, so callers stay fail-soft.
 */
export async function loadGamePlayerProps(
  awayTeamName: string,
  homeTeamName: string,
  startTimeISO: string,
): Promise<PlayerProp[]> {
  const resolved = await resolveOddsEvent(awayTeamName, homeTeamName, startTimeISO);
  if (!resolved) return [];

  if (resolved.provider === "the-odds-api") {
    return getPlayerProps(resolved.eventId).catch(() => []);
  }

  const primaryProps = await getSgoPlayerProps(resolved.eventId).catch(() => []);
  if (primaryProps.length > 0) return primaryProps;

  if (!getOddsApiKey()) return [];
  const fallbackEventId = await findTheOddsApiEvent(awayTeamName, homeTeamName, startTimeISO);
  if (!fallbackEventId) return [];
  return getPlayerProps(fallbackEventId).catch(() => []);
}
