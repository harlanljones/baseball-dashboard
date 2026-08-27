/**
 * Client for SportsGameOdds (api.sportsgameodds.com/v2 — primary provider,
 * free tier). Mirrors `src/lib/mlb/client.ts`'s `mlbFetch`: Next.js fetch
 * caching with a per-call `revalidate` TTL, no persistence of our own.
 *
 * Unlike The Odds API, SportsGameOdds bills per *event object* rather than
 * per market × region, so one cached league-wide request returns every
 * tracked prop market for every game on the slate. A single 6-hour-TTL
 * request (~15 events on a full slate) therefore costs ~15 objects/month
 * per refresh window — comfortably inside the free tier's 2,500 objects.
 */

import type { PlayerProp, PropMarketKey } from "./types";
import { createPool, isQuotaExhausted, type FetchResult } from "./keys";

const SGO_KEYS = createPool("SPORTSGAMEODDS");

const BASE = "https://api.sportsgameodds.com/v2";

/**
 * Cache TTL in seconds. Six hours trades line freshness (upstream updates
 * every 10 min even on the free plan) for quota headroom: refreshing a full
 * slate every 6h stays well under the Amateur plan's monthly object budget,
 * and pre-game lines move over hours, not seconds.
 */
export const TTL_SGO = 60 * 60 * 6;

const LEAGUE_ID = "MLB";

/** Hard cap on pagination round-trips per board load (limit is 100/page). */
const MAX_PAGES = 3;

/** Bookmaker preference order, most-preferred first. FanDuel first by product decision. */
const PREFERRED_BOOKMAKERS = ["fanduel", "draftkings", "betmgm"] as const;

/**
 * Our tracked prop markets mapped to SportsGameOdds statIDs (verified
 * against their published MLB market catalog — note the inconsistent
 * casing: `batting_RBI`, `batting_totalBases`, `batting_basesOnBalls`).
 */
const MARKET_STAT_IDS: Record<PropMarketKey, string> = {
  pitcher_strikeouts: "pitching_strikeouts",
  pitcher_outs: "pitching_outs",
  batter_hits: "batting_hits",
  batter_total_bases: "batting_totalBases",
  batter_home_runs: "batting_homeRuns",
  batter_rbis: "batting_RBI",
  batter_walks: "batting_basesOnBalls",
};

const STAT_ID_TO_MARKET: Record<string, PropMarketKey> = Object.fromEntries(
  Object.entries(MARKET_STAT_IDS).map(([market, statId]) => [statId, market as PropMarketKey]),
);

/**
 * oddID filter selecting only our markets' main over/under lines for every
 * player at once (`PLAYER_ID` is the API's wildcard participant token).
 * Requested under both parameter spellings seen across SGO's v2 docs and
 * OpenAPI spec; an unfiltered payload parses identically either way.
 */
const ODD_ID_FILTER = Object.values(MARKET_STAT_IDS)
  .flatMap((statId) => [`ou-over`, `ou-under`].map((tail) => `${statId}-PLAYER_ID-game-${tail}`))
  .join(",");

/** Thrown when SportsGameOdds responds with a non-2xx status, or when no API key is configured. */
export class SgoError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
    message?: string,
  ) {
    super(message ?? `SportsGameOdds request failed (${status}) for ${url}`);
    this.name = "SgoError";
  }
}

/** The configured SportsGameOdds key, or `null` if unset — callers fail closed on `null`. */
export function getSgoApiKey(): string | null {
  return process.env.SPORTSGAMEODDS_API_KEY || null;
}

/** Test seam: reset the in-memory rotation state so cases don't leak into each other. */
export function resetSgoKeyPool(): void {
  SGO_KEYS.reset();
}

interface SgoNames {
  long?: string;
}

interface SgoBookLine {
  odds?: string;
  overUnder?: string;
  available?: boolean;
}

interface SgoOdd {
  oddID?: string;
  statID?: string;
  statEntityID?: string;
  playerID?: string;
  periodID?: string;
  betTypeID?: string;
  sideID?: string;
  byBookmaker?: Record<string, SgoBookLine>;
}

interface SgoEventPlayer {
  name?: string;
}

export interface SgoEvent {
  eventID?: string;
  teams?: {
    home?: { names?: SgoNames };
    away?: { names?: SgoNames };
  };
  status?: { startsAt?: string };
  players?: Record<string, SgoEventPlayer>;
  odds?: Record<string, SgoOdd>;
}

interface SgoEventsPage {
  success?: boolean;
  data?: SgoEvent[];
  nextCursor?: string;
  error?: string;
}

type Params = Record<string, string | number | boolean | undefined>;

async function sgoFetch(params: Params, revalidate: number = TTL_SGO): Promise<SgoEventsPage> {
  const key = SGO_KEYS.pick();
  if (!key) {
    throw new SgoError(0, `${BASE}/events`, "No usable SPORTSGAMEODDS_API_KEY");
  }

  const url = new URL(`${BASE}/events`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") {
      url.searchParams.set(k, String(v));
    }
  }

  // Auth via header so the key never appears in cached/logged URLs.
  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json", "x-api-key": key },
    next: { revalidate },
  });

  const body = await res.json().catch(() => null);
  const result: FetchResult = { ok: res.ok, status: res.status, body };

  if (!res.ok) {
    SGO_KEYS.record(key, result);
    if (isQuotaExhausted(body, "SPORTSGAMEODDS")) {
      SGO_KEYS.markPoolExhausted();
    }
    throw new SgoError(res.status, url.toString());
  }

  return body as SgoEventsPage;
}

/**
 * Loads the league-wide prop board: every upcoming MLB event carrying our
 * seven tracked markets' main over/under lines. Identical URLs collapse to
 * one upstream request per TTL window no matter how many games call this.
 */
async function fetchBoard(): Promise<SgoEvent[]> {
  const baseParams: Params = {
    leagueID: LEAGUE_ID,
    oddsAvailable: true,
    started: false,
    limit: 100,
    oddIDs: ODD_ID_FILTER,
  };

  const events: SgoEvent[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const res = await sgoFetch({ ...baseParams, cursor });
    if (res.success === false) {
      throw new SgoError(200, `${BASE}/events`, res.error ?? "SportsGameOdds reported failure");
    }
    events.push(...(res.data ?? []));
    cursor = res.nextCursor;
    if (!cursor) break;
  }
  return events;
}

/** Loose team-name matcher shared by both providers' event lookups. */
export function teamsMatch(oddsName: string, mlbName: string): boolean {
  const a = oddsName.trim().toLowerCase();
  const b = mlbName.trim().toLowerCase();
  return a === b || a.includes(b) || b.includes(a);
}

function eventHomeName(event: SgoEvent): string {
  return event.teams?.home?.names?.long ?? "";
}

function eventAwayName(event: SgoEvent): string {
  return event.teams?.away?.names?.long ?? "";
}

/**
 * Resolves an MLB game (team names + start time) to SportsGameOdds'
 * event id, or `null` when the key is unset or no event matches. On a
 * doubleheader picks whichever `status.startsAt` is closest to
 * `startTimeISO`.
 */
export async function findSgoEvent(
  awayTeamName: string,
  homeTeamName: string,
  startTimeISO: string,
): Promise<string | null> {
  if (!getSgoApiKey()) return null;

  const events = await fetchBoard();
  const matches = events.filter(
    (event) =>
      teamsMatch(eventAwayName(event), awayTeamName) &&
      teamsMatch(eventHomeName(event), homeTeamName),
  );
  if (matches.length === 0) return null;

  const startMs = new Date(startTimeISO).getTime();
  matches.sort(
    (a, b) =>
      Math.abs(new Date(a.status?.startsAt ?? 0).getTime() - startMs) -
      Math.abs(new Date(b.status?.startsAt ?? 0).getTime() - startMs),
  );
  return matches[0].eventID ?? null;
}

/**
 * Derives a display name from a SportsGameOdds playerID
 * (`AARON_JUDGE_1_MLB` → `AARON JUDGE`). Used when the event carries no
 * player record for the prop.
 */
export function playerNameFromId(playerId: string): string {
  const stripped = /^(.*)_\d+_[A-Za-z0-9]+$/.exec(playerId)?.[1] ?? playerId;
  return stripped.replaceAll("_", " ").trim();
}

function parseAmericanPrice(raw: string | undefined): number | null {
  if (!raw) return null;
  const price = Number(raw);
  return Number.isFinite(price) ? price : null;
}

function parseLine(raw: string | undefined): number | null {
  if (!raw) return null;
  const line = Number(raw);
  return Number.isFinite(line) ? line : null;
}

function isUsable(line: SgoBookLine | undefined): line is SgoBookLine & { odds: string; overUnder: string } {
  return (
    line?.available !== false &&
    typeof line?.odds === "string" &&
    typeof line.overUnder === "string"
  );
}

/**
 * Picks the first bookmaker (FanDuel → DraftKings → BetMGM, then any other
 * available book) quoting the SAME line on both sides of the pairing —
 * books disagree on lines, so a price without its line would be a false
 * quote. Returns `null` when no book posts a matched pair.
 */
function pickBookPair(
  over: SgoOdd,
  under: SgoOdd,
): { bookmaker: string; overPrice: number; underPrice: number; line: number } | null {
  const books = Object.keys(over.byBookmaker ?? {});
  const ordered = [
    ...PREFERRED_BOOKMAKERS.filter((preferred) => books.includes(preferred)),
    ...books.filter((book) => !(PREFERRED_BOOKMAKERS as readonly string[]).includes(book)),
  ];

  for (const book of ordered) {
    const overLine = over.byBookmaker?.[book];
    const underLine = under.byBookmaker?.[book];
    if (!isUsable(overLine) || !isUsable(underLine)) continue;

    const line = parseLine(overLine.overUnder);
    if (line === null || line !== parseLine(underLine.overUnder)) continue;

    const overPrice = parseAmericanPrice(overLine.odds);
    const underPrice = parseAmericanPrice(underLine.odds);
    if (overPrice === null || underPrice === null) continue;

    return { bookmaker: book, overPrice, underPrice, line };
  }
  return null;
}

/** statEntityID values that mark team/game markets rather than player props. */
const TEAM_ENTITY_IDS = new Set(["all", "home", "away"]);

/**
 * Parses one event's odds map into `PlayerProp` rows. Only outcome pairs
 * from a single bookmaker sharing an identical line are kept, mirroring
 * the previous The Odds API behavior.
 */
export function parseSgoProps(event: SgoEvent): PlayerProp[] {
  const pairs = new Map<string, { over?: SgoOdd; under?: SgoOdd }>();
  for (const odd of Object.values(event.odds ?? {})) {
    const marketKey = STAT_ID_TO_MARKET[odd.statID ?? ""];
    if (!marketKey) continue;
    if (odd.betTypeID !== "ou" || odd.periodID !== "game") continue;
    // Player props carry a playerID; all/home/away mark team-level totals.
    if (!odd.playerID || TEAM_ENTITY_IDS.has(odd.playerID)) continue;

    const entry = pairs.get(`${odd.statID}|${odd.playerID}`) ?? {};
    if (odd.sideID === "over") entry.over = odd;
    else if (odd.sideID === "under") entry.under = odd;
    else continue;
    pairs.set(`${odd.statID}|${odd.playerID}`, entry);
  }

  const props: PlayerProp[] = [];
  for (const [key, { over, under }] of pairs) {
    if (!over || !under) continue;
    const picked = pickBookPair(over, under);
    if (!picked) continue;

    const statId = key.split("|")[0];
    const playerName =
      (over.playerID ? event.players?.[over.playerID]?.name : undefined) ??
      playerNameFromId(over.playerID ?? "");

    props.push({
      marketKey: STAT_ID_TO_MARKET[statId],
      playerName,
      line: picked.line,
      overPrice: picked.overPrice,
      underPrice: picked.underPrice,
    });
  }
  return props;
}

/**
 * Fetches player-prop rows for one SportsGameOdds event id off the cached
 * league-wide board. Returns `[]` when the event is absent (props not yet
 * posted) — callers treat emptiness as the signal to fall back.
 */
export async function getSgoPlayerProps(eventId: string): Promise<PlayerProp[]> {
  if (!getSgoApiKey()) return [];

  const events = await fetchBoard();
  const event = events.find((candidate) => candidate.eventID === eventId);
  if (!event) return [];
  return parseSgoProps(event);
}
