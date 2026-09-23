import { unstable_cache } from "next/cache";

import { oddsFetch, TTL, getOddsApiKey } from "./client";
import { findTheOddsApiEvent, resolveOddsEvent } from "./events";
import { getSgoPlayerProps } from "./sgo";
import { logOddsFailure } from "./log";
import { withOddsScope } from "./requestScope";
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
 *
 * Runs in an odds scope, so the event lookup and the prop read share one
 * board; a slate-wide caller that opened a scope first shares it across games.
 */
export function loadGamePlayerProps(
  awayTeamName: string,
  homeTeamName: string,
  startTimeISO: string,
): Promise<PlayerProp[]> {
  return withOddsScope(() => loadInScope(awayTeamName, homeTeamName, startTimeISO));
}

/**
 * How long one game's extracted props are kept, in seconds. Matches the
 * slate-wide leans: short enough that a moved line shows up within minutes.
 */
const GAME_PROPS_TTL = 5 * 60;

/** Signals "nothing to cache" out of {@link cachedGameProps}. */
class NoProps extends Error {}

/**
 * One game's props, kept for {@link GAME_PROPS_TTL}. Throwing on an empty
 * result keeps a passing failure (quota, lines not posted) out of the cache,
 * since a rejected promise is never persisted.
 */
const cachedGameProps = unstable_cache(
  async (awayTeamName: string, homeTeamName: string, startTimeISO: string) => {
    const props = await loadGamePlayerProps(awayTeamName, homeTeamName, startTimeISO);
    if (props.length === 0) throw new NoProps();
    return props;
  },
  ["game-player-props"],
  { revalidate: GAME_PROPS_TTL, tags: ["player-props"] },
);

/**
 * {@link loadGamePlayerProps}, cached per game.
 *
 * The fetch cache keeps the provider's board off the network, but every view
 * still read that multi-megabyte board back and parsed it to pull out one
 * game's few kilobytes of props. Caching the extracted props means a repeat
 * view reads only those. Inside the slate-wide leans' own cache the lookup
 * runs uncached (Next bypasses nested caches) but still stores its result, so
 * scoring the slate warms every game's props page too.
 */
export async function getGamePlayerProps(
  awayTeamName: string,
  homeTeamName: string,
  startTimeISO: string,
): Promise<PlayerProp[]> {
  try {
    return await cachedGameProps(awayTeamName, homeTeamName, startTimeISO);
  } catch (error) {
    if (error instanceof NoProps) return [];
    throw error;
  }
}

async function loadInScope(
  awayTeamName: string,
  homeTeamName: string,
  startTimeISO: string,
): Promise<PlayerProp[]> {
  const resolved = await resolveOddsEvent(awayTeamName, homeTeamName, startTimeISO);
  if (!resolved) return [];

  if (resolved.provider === "the-odds-api") {
    return getPlayerProps(resolved.eventId).catch((error) => {
      logOddsFailure(`The Odds API props for ${awayTeamName} at ${homeTeamName}`, error);
      return [];
    });
  }

  const primaryProps = await getSgoPlayerProps(resolved.eventId).catch((error) => {
    logOddsFailure(`SportsGameOdds props for ${awayTeamName} at ${homeTeamName}`, error);
    return [];
  });
  if (primaryProps.length > 0) return primaryProps;

  if (!getOddsApiKey()) return [];
  const fallbackEventId = await findTheOddsApiEvent(awayTeamName, homeTeamName, startTimeISO);
  if (!fallbackEventId) return [];
  return getPlayerProps(fallbackEventId).catch((error) => {
    logOddsFailure(`The Odds API fallback props for ${awayTeamName} at ${homeTeamName}`, error);
    return [];
  });
}
