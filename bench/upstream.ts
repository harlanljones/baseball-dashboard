/**
 * Deterministic stand-in for every upstream the app talks to.
 *
 * The app's clients (`mlbFetch`, `sgoFetch`, `oddsFetch`, `fetchHourlyForecast`)
 * all go through global `fetch`, so installing one routing stub here is what
 * keeps the benchmark offline while still executing the real shaping, matching
 * and scoring code paths end to end.
 *
 * Two properties matter for honest timing:
 *  - every response body is built from the fixtures (no clock, no network, no
 *    randomness), and
 *  - bodies are serialized once per distinct request shape, so the stub's own
 *    work is negligible next to the app's `JSON.parse` of the same bytes. The
 *    app still pays a fresh parse per call, which is what Next's fetch cache
 *    does too (it stores the body and re-parses it on every read).
 */

import { BALLPARKS } from "@/lib/weather/ballparks";
import {
  BENCH_DATE,
  BENCH_SEASON,
  GAMES,
  PROPS_GAME,
  STAT_ID_BY_MARKET,
  openMeteoBody,
  peopleBody,
  personBody,
  rosterBody,
  scheduleBody,
  sgoEvent,
  type BenchSide,
  type SgoOddFixture,
} from "./fixture";

export type WeatherProfile = "out-hot" | "in-cold" | "calm";

export interface FetchRecord {
  url: string;
  status: number;
  bytes: number;
}

const SIDE_BY_TEAM_ID = new Map<number, BenchSide>();
for (const game of GAMES) {
  SIDE_BY_TEAM_ID.set(game.away.team.id, game.away);
  SIDE_BY_TEAM_ID.set(game.home.team.id, game.home);
}

/**
 * Wind/temperature regime per venue. The props page's game blows out on a hot
 * day (so the HR/TB weather nudge fires up), one other park blows in cold (the
 * nudge fires down), everything else is neutral.
 */
interface ParkRegime {
  profile: WeatherProfile;
  cfBearingDeg: number;
}

const REGIME_BY_COORD = new Map<string, ParkRegime>();
const PROFILE_BY_VENUE = new Map<number, WeatherProfile>([
  [PROPS_GAME.venueId, "out-hot"],
  [GAMES.find((game) => game.venueId !== PROPS_GAME.venueId)?.venueId ?? 0, "in-cold"],
]);
for (const [venueId, park] of Object.entries(BALLPARKS)) {
  REGIME_BY_COORD.set(`${park.lat},${park.lon}`, {
    profile: PROFILE_BY_VENUE.get(Number(venueId)) ?? "calm",
    cfBearingDeg: park.cfBearingDeg,
  });
}

function regimeFor(url: URL): ParkRegime {
  return (
    REGIME_BY_COORD.get(`${url.searchParams.get("latitude")},${url.searchParams.get("longitude")}`) ?? {
      profile: "calm",
      cfBearingDeg: 0,
    }
  );
}

// --- Pre-serialized payloads -------------------------------------------------

const SCHEDULE_BODY = scheduleBody(GAMES, BENCH_DATE);
const ROSTER_BODIES = new Map<number, string>();
for (const side of SIDE_BY_TEAM_ID.values()) {
  ROSTER_BODIES.set(side.team.id, rosterBody(side, BENCH_SEASON, true));
}

const EVENT_OBJECTS = GAMES.map((game, index) => sgoEvent(game, index % 2 === 0));
const EVENT_STRINGS = EVENT_OBJECTS.map((event) => JSON.stringify(event));

/** Lazy caches for request shapes that need object-level filtering. */
const memo = new Map<string, string>();

function allRequestedStatIds(oddIDs: string | null): Set<string> | null {
  if (!oddIDs) return null;
  const ids = new Set<string>();
  for (const pattern of oddIDs.split(",")) {
    // `<statID>-PLAYER_ID-game-ou-(over|under)` — the provider's wildcard form.
    const match = /^(.+)-PLAYER_ID-game-ou-(?:over|under)$/.exec(pattern.trim());
    if (match) ids.add(match[1]);
  }
  return ids.size > 0 ? ids : null;
}

function sgoBoardBody(url: URL): string {
  const limit = Number(url.searchParams.get("limit") ?? 100) || 100;
  const cursor = Number(url.searchParams.get("cursor") ?? 0) || 0;
  const eventIDs = url.searchParams.get("eventIDs");
  const oddIDs = url.searchParams.get("oddIDs");
  // The assembled page is cached by request shape: joining 2 MB of per-event
  // strings is the fixture's own work, and counting it as application time
  // would dilute everything the benchmark is meant to measure.
  const pageKey = `sgo:${cursor}:${limit}:${eventIDs ?? ""}:${oddIDs ?? ""}`;
  const cachedPage = memo.get(pageKey);
  if (cachedPage != null) return cachedPage;

  const requested = allRequestedStatIds(oddIDs);
  const wanted = new Set<number>();
  if (eventIDs) {
    for (const id of eventIDs.split(",")) {
      const pk = Number(id.replace(/^SGO_/, ""));
      if (Number.isFinite(pk)) wanted.add(pk);
    }
  }

  const everyStatId = Object.values(STAT_ID_BY_MARKET);
  const unfiltered = requested == null || everyStatId.every((statId) => requested.has(statId));
  const selected: string[] = [];
  for (let i = cursor; i < Math.min(GAMES.length, cursor + limit); i += 1) {
    const game = GAMES[i];
    if (wanted.size > 0 && !wanted.has(game.gamePk)) continue;
    if (unfiltered) {
      selected.push(EVENT_STRINGS[i]);
      continue;
    }
    const key = `ev:${i}:${[...(requested ?? [])].sort().join("|")}`;
    let body = memo.get(key);
    if (body == null) {
      const event = EVENT_OBJECTS[i];
      const odds: Record<string, SgoOddFixture> = {};
      for (const [oddID, odd] of Object.entries(event.odds)) {
        if (odd.statID && requested?.has(odd.statID)) odds[oddID] = odd;
      }
      body = JSON.stringify({ ...event, odds });
      memo.set(key, body);
    }
    selected.push(body);
  }

  const next = cursor + limit < GAMES.length ? `c${cursor + limit}` : null;
  const page = `{"success":true,"data":[${selected.join(",")}],"nextCursor":${next === null ? "null" : JSON.stringify(next)}}`;
  memo.set(pageKey, page);
  return page;
}

function memoized(key: string, build: () => string): string {
  let body = memo.get(key);
  if (body == null) {
    body = build();
    memo.set(key, body);
  }
  return body;
}

function mlbBody(url: URL): string {
  const path = url.pathname;
  if (path === "/api/v1/schedule") {
    const gamePk = url.searchParams.get("gamePk");
    if (gamePk) {
      const game = GAMES.find((g) => String(g.gamePk) === gamePk);
      return game ? scheduleBody([game], BENCH_DATE) : JSON.stringify({ dates: [] });
    }
    const date = url.searchParams.get("date") ?? BENCH_DATE;
    return date === BENCH_DATE ? SCHEDULE_BODY : memoized(`sched:${date}`, () => JSON.stringify({ dates: [] }));
  }

  const roster = /^\/api\/v1\/teams\/(\d+)\/roster$/.exec(path);
  if (roster) {
    const teamId = Number(roster[1]);
    const side = SIDE_BY_TEAM_ID.get(teamId);
    const hydrate = url.searchParams.get("hydrate") ?? "";
    if (!side) return JSON.stringify({ roster: [] });
    if (hydrate.includes("stats(")) return ROSTER_BODIES.get(teamId) ?? JSON.stringify({ roster: [] });
    return memoized(`roster-plain:${teamId}`, () => rosterBody(side, BENCH_SEASON, false));
  }

  if (path === "/api/v1/people") {
    const ids = (url.searchParams.get("personIds") ?? "")
      .split(",")
      .map(Number)
      .filter((id) => Number.isInteger(id) && id > 0);
    const hydrate = url.searchParams.get("hydrate") ?? "";
    return memoized(`people:${ids.join(",")}:${hydrate}`, () => peopleBody(ids, hydrate));
  }

  const person = /^\/api\/v1\/people\/(\d+)$/.exec(path);
  if (person) return memoized(`person:${person[1]}`, () => personBody(Number(person[1])));

  throw new Error(`bench upstream: unhandled statsapi route ${url.pathname}`);
}

function openMeteoUrl(url: URL): string {
  const start = url.searchParams.get("start_date") ?? BENCH_DATE;
  return `meteo:${start}:${regimeFor(url).profile}`;
}

export interface Upstream {
  calls: FetchRecord[];
  unexpected: string[];
}

/** Install the routing stub over global `fetch` and return its call log. */
export function installUpstream(): Upstream {
  const log: Upstream = { calls: [], unexpected: [] };

  const stub = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw);
    void init;
    let body: string;
    try {
      if (url.hostname === "statsapi.mlb.com") body = mlbBody(url);
      else if (url.hostname === "api.sportsgameodds.com") body = sgoBoardBody(url);
      else if (url.hostname === "api.open-meteo.com") {
        const regime = regimeFor(url);
        const start = url.searchParams.get("start_date") ?? BENCH_DATE;
        body = memoized(openMeteoUrl(url), () => openMeteoBody(start, regime.profile, regime.cfBearingDeg));
      } else if (url.hostname === "api.the-odds-api.com") {
        // The Odds API only runs as a fallback when SportsGameOdds has no lines;
        // the fixture always posts lines, so any call here is a bench bug.
        throw new Error("bench upstream: The Odds API fallback should not be reached");
      } else {
        throw new Error(`bench upstream: unexpected host ${url.hostname} (${raw})`);
      }
    } catch (error) {
      log.unexpected.push(`${raw}: ${(error as Error).message}`);
      throw error;
    }
    log.calls.push({ url: raw, status: 200, bytes: body.length });
    return new Response(body, { status: 200, headers: { "content-type": "application/json" } });
  };

  // The DOM `fetch` type carries extra overloads (Request, URL); the routing
  // stub only needs the single (input, init) form the app's clients use.
  const stubFetch = stub as typeof globalThis.fetch;
  globalThis.fetch = stubFetch;
  return log;
}
