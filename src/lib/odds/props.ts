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
 * The books we ask The Odds API for, in preference order. These are the
 * provider's own keys for our preferred books that it lists: its Caesars key is
 * `williamhill_us` and it has no US `bet365`, so the list is shorter than the
 * SportsGameOdds one. Requesting these instead of `regions=us` still costs one
 * region against the quota (up to 10 bookmakers is 1 region) but a fraction of
 * the payload — `us` returns every US bookmaker, and only one book is ever read.
 */
const ODDS_API_BOOKMAKERS = ["fanduel", "draftkings", "betmgm"] as const;

const BOOK_RANK: Record<string, number> = Object.fromEntries(
  ODDS_API_BOOKMAKERS.map((book, rank) => [book, rank]),
);

/** True when the book carries at least one of our tracked prop markets. */
function carriesTrackedMarket(bookmaker: RawBookmaker): boolean {
  return bookmaker.markets.some((market) => PROP_MARKETS.includes(market.key as PropMarketKey));
}

/**
 * The most preferred book that actually carries one of our markets. Reading a
 * single fixed book (the response's first) loses props whenever that book does
 * not post player props, which is common outside the majors.
 */
function pickBookmaker(bookmakers: RawBookmaker[] | undefined): RawBookmaker | undefined {
  return [...(bookmakers ?? [])]
    .filter(carriesTrackedMarket)
    .sort((a, b) => (BOOK_RANK[a.key] ?? 99) - (BOOK_RANK[b.key] ?? 99))[0];
}

/**
 * Fetches player-prop odds for one The Odds API event across the 7 tracked
 * markets, from the most preferred bookmaker that carries them. Only outcome
 * pairs where both Over and Under exist with the same line are kept.
 */
export async function getPlayerProps(eventId: string): Promise<PlayerProp[]> {
  const path = `/v4/sports/baseball_mlb/events/${eventId}/odds`;
  const common = {
    markets: PROP_MARKETS.join(","),
    oddsFormat: "american",
  };

  const narrowed = await oddsFetch<RawEventOdds>(
    path,
    { ...common, bookmakers: ODDS_API_BOOKMAKERS.join(",") },
    TTL.odds,
  );
  let bookmaker = pickBookmaker(narrowed.bookmakers);
  if (!bookmaker) {
    // None of the preferred books posted a tracked market. Widen to the whole
    // region — the request this used to make — before giving up on the game.
    const widened = await oddsFetch<RawEventOdds>(path, { ...common, regions: "us" }, TTL.odds);
    bookmaker = pickBookmaker(widened.bookmakers);
  }
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
