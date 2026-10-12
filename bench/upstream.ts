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

import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

import { SCHEDULE_FIELDS } from "@/lib/mlb/schedule";
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
  liveFeedBody,
  scheduleBody,
  sgoEvent,
  type BenchSide,
  type SgoBookLine,
  type SgoOddFixture,
} from "./fixture";

export type WeatherProfile = "out-hot" | "in-cold" | "calm";

/**
 * A real finalized game's `feed/live` payload (715 KB, 64 plays, 9 innings, 52
 * players), captured once from the live API and committed gzipped. It is the
 * app's largest single upstream read, so the harness reads it too; the request
 * `fields` filter still applies, which is what makes narrowing it measurable.
 */
export const CAPTURED_FEED_PK = 849832;
const CAPTURED_FEED_PATH = new URL("./fixtures/game-feed.json.gz", import.meta.url);
const CAPTURED_FEED_FIELDS_PATH = new URL("./fixtures/game-feed-fields.json.gz", import.meta.url);

/**
 * The field list the narrowed fixture was captured with. The API's `fields`
 * filter is schema-aware — it keeps a listed name only where the response
 * schema has that field (e.g. `errors` under `linescore`, not under a stat
 * block) — which a name-based local model cannot reproduce. So the narrowed
 * payload is served verbatim when the request asks for exactly this list, and
 * the local model (conservative, i.e. larger) covers every other request.
 */
const CAPTURED_FEED_FIELDS = [
  "gamePk", "gameData", "players", "pitchHand", "code", "game", "type", "status",
  "abstractGameState", "detailedState", "datetime", "dateTime", "venue", "id", "name",
  "abbreviation", "location", "city", "weather", "condition", "temp", "wind", "teams",
  "away", "home", "probablePitchers", "fullName", "liveData", "linescore",
  "scheduledInnings", "innings", "num", "ordinalNum", "runs", "hits", "errors",
  "boxscore", "team", "batters", "pitchers", "bullpen", "battingOrder", "person",
  "position", "stats", "batting", "pitching", "seasonStats", "atBats", "baseOnBalls",
  "strikeOuts", "avg", "inningsPitched", "earnedRuns", "era", "decisions", "winner",
  "loser", "save", "plays", "allPlays", "about", "halfInning", "inning", "result",
  "eventType", "description", "awayScore", "homeScore", "rbi", "matchup", "batter",
  "pitcher",
].join(",");

/**
 * The postseason pitch-count path (`getBullpenWorkload`): a team's games over a
 * three-day window, then one boxscore per game played. Two real postseason
 * boxscores (169 KB and 174 KB) captured from the live API — the app's request
 * narrows them to ~12 KB each, which is what this fixture pair makes measurable.
 * The window and the team both come from the captured feed (gameDate
 * 2026-10-08 -> 2026-10-05..2026-10-07 for team 114), exactly as the page
 * derives them, so no date is hardcoded here.
 */
const POSTSEASON_SCHEDULE_PATH = new URL("./fixtures/postseason-schedule.json.gz", import.meta.url);
const POSTSEASON_SCHEDULE_FIELDS_PATH = new URL("./fixtures/postseason-schedule-fields.json.gz", import.meta.url);
const BOXSCORE_PKS = [849833, 849834];
const BOXSCORE_FIELDS = [
  "teams", "away", "home", "team", "id", "pitchers", "players", "stats",
  "pitching", "numberOfPitches",
].join(",");
function boxscorePath(pk: number, narrowed: boolean): URL {
  return new URL(`./fixtures/boxscore-${pk}${narrowed ? "-fields" : ""}.json.gz`, import.meta.url);
}

/**
 * The offseason home view (`OffseasonSections`): a season's final standings, a
 * season's postseason recap, and the next season's key dates plus opening day.
 * All four captured from the live API — 110 KB of standings, 290 KB of
 * postseason series (the recap's own request is 32 KB), a 1.18 MB opening-day
 * schedule (already narrowed to 1.5 KB by the app) and an 830 B season record.
 * The seasons match what the app asks for on a winter date: the 2026 season
 * dates put 2026-01-15 before spring training, so the recap and standings are
 * the 2025 season and opening day is 2026.
 */
const STANDINGS_PATH = new URL("./fixtures/standings.json.gz", import.meta.url);
const STANDINGS_FIELDS_PATH = new URL("./fixtures/standings-fields.json.gz", import.meta.url);
const POSTSEASON_SERIES_PATH = new URL("./fixtures/postseason-series.json.gz", import.meta.url);
const POSTSEASON_SERIES_FIELDS_PATH = new URL("./fixtures/postseason-series-fields.json.gz", import.meta.url);
const SEASON_DATES_PATH = new URL("./fixtures/season-dates.json.gz", import.meta.url);
const SEASON_DATES_FIELDS_PATH = new URL("./fixtures/season-dates-fields.json.gz", import.meta.url);
const OPENING_DAY_PATH = new URL("./fixtures/opening-day-schedule.json.gz", import.meta.url);
const OPENING_DAY_FIELDS_PATH = new URL("./fixtures/opening-day-schedule-fields.json.gz", import.meta.url);

/** Copies of the app's own lists; a mismatch falls back to the local model. */
const STANDINGS_FIELDS = [
  "records", "league", "division", "teamRecords", "team", "id", "name",
  "abbreviation", "wins", "losses", "winningPercentage", "gamesBack",
  "runDifferential", "clinchIndicator", "streak", "streakCode", "divisionRank",
].join(",");
const POSTSEASON_SERIES_FIELDS = [
  "series", "games", "sortNumber", "seriesDescription", "gamesInSeries",
  "gamePk", "gameDate", "officialDate", "gameType", "status",
  "abstractGameState", "detailedState", "teams", "away", "home", "team", "id",
  "name", "abbreviation", "score", "isWinner", "leagueRecord", "wins", "losses",
  "pct", "probablePitcher", "fullName", "venue", "location", "city",
].join(",");
const SEASON_DATES_FIELDS = [
  "seasons", "springStartDate", "regularSeasonStartDate", "regularSeasonEndDate",
].join(",");
const OPENING_DAY_FIELDS = "dates,date";

const fixtureCache = new Map<string, string>();
function fixture(path: URL): string {
  let body = fixtureCache.get(path.href);
  if (body == null) {
    body = gunzipSync(readFileSync(path)).toString("utf8");
    fixtureCache.set(path.href, body);
  }
  return body;
}
function capturedFeedBody(): string {
  return fixture(CAPTURED_FEED_PATH);
}
function capturedNarrowedFeedBody(): string {
  return fixture(CAPTURED_FEED_FIELDS_PATH);
}

/**
 * A captured payload is served verbatim when the request asks for exactly the
 * field list it was captured with; every other request falls back to the local
 * model. Same reasoning as {@link CAPTURED_FEED_FIELDS}.
 */
function capturedBodyFor(
  fields: string | null,
  full: URL,
  narrowed: URL,
  capturedList: string,
): string {
  if (!fields) return fixture(full);
  const wanted = fieldSet(fields);
  const captured = fieldSet(capturedList);
  if (wanted.size === captured.size && [...wanted].every((name) => captured.has(name))) {
    return fixture(narrowed);
  }
  return JSON.stringify(pruneFields(JSON.parse(fixture(full)), wanted));
}

export interface FetchRecord {
  url: string;
  status: number;
  bytes: number;
}

/**
 * The stub's own cost, accumulated so the harness can report it. Routing and
 * building a response body is the benchmark standing in for the network, not
 * application work: measuring it keeps the "negligible" claim in this file's
 * header honest, and catches it if a fixture ever stops being memoised.
 */
export interface Upstream {
  calls: FetchRecord[];
  unexpected: string[];
  stubMs: number;
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
  const bookmakerIDs = url.searchParams.get("bookmakerID") ?? url.searchParams.get("bookmakerIDs");
  // The assembled page is cached by request shape: joining 2 MB of per-event
  // strings is the fixture's own work, and counting it as application time
  // would dilute everything the benchmark is meant to measure.
  const pageKey = `sgo:${cursor}:${limit}:${eventIDs ?? ""}:${oddIDs ?? ""}:${bookmakerIDs ?? ""}`;
  const cachedPage = memo.get(pageKey);
  if (cachedPage != null) return cachedPage;

  const requested = allRequestedStatIds(oddIDs);
  // `bookmakerID` shapes the response: only the named books come back, which is
  // the provider's documented way to keep an odds request small.
  const books = bookmakerIDs ? new Set(bookmakerIDs.split(",").map((book) => book.trim())) : null;
  const wanted = new Set<number>();
  if (eventIDs) {
    for (const id of eventIDs.split(",")) {
      const pk = Number(id.replace(/^SGO_/, ""));
      if (Number.isFinite(pk)) wanted.add(pk);
    }
  }

  const everyStatId = Object.values(STAT_ID_BY_MARKET);
  const unfiltered = (requested == null || everyStatId.every((statId) => requested.has(statId))) && books == null;
  const selected: string[] = [];
  for (let i = cursor; i < Math.min(GAMES.length, cursor + limit); i += 1) {
    const game = GAMES[i];
    if (wanted.size > 0 && !wanted.has(game.gamePk)) continue;
    if (unfiltered) {
      selected.push(EVENT_STRINGS[i]);
      continue;
    }
    const key = `ev:${i}:${[...(requested ?? [])].sort().join("|")}:${bookmakerIDs ?? ""}`;
    let body = memo.get(key);
    if (body == null) {
      const event = EVENT_OBJECTS[i];
      const odds: Record<string, SgoOddFixture> = {};
      for (const [oddID, odd] of Object.entries(event.odds)) {
        if (odd.statID && requested && !requested.has(odd.statID)) continue;
        odds[oddID] = books ? { ...odd, byBookmaker: pickBooks(odd.byBookmaker, books) } : odd;
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

/**
 * Local model of the API's `fields` filter: keep listed names, recurse into
 * objects and arrays, drop branches with nothing listed beneath them.
 */
function pruneFields(value: unknown, wanted: Set<string>, listed = false): unknown {
  if (Array.isArray(value)) {
    const items = value.map((item) => pruneFields(item, wanted, listed)).filter((item) => item !== undefined);
    return listed || items.length > 0 ? items : undefined;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const keep = wanted.has(key);
      if (!keep && !hasListedDescendant(child, wanted)) continue;
      const pruned = pruneFields(child, wanted, keep);
      if (pruned !== undefined) out[key] = pruned;
    }
    return listed || Object.keys(out).length > 0 ? out : undefined;
  }
  return listed ? value : undefined;
}

/** The caller's `fields` list as a lookup set. */
function fieldSet(fields: string): Set<string> {
  return new Set(fields.split(",").map((field) => field.trim()).filter(Boolean));
}

function hasListedDescendant(value: unknown, wanted: Set<string>): boolean {
  if (Array.isArray(value)) return value.some((item) => hasListedDescendant(item, wanted));
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).some(
      ([key, child]) => wanted.has(key) || hasListedDescendant(child, wanted),
    );
  }
  return false;
}

/** The named books' lines for one odd, in provider order. */
function pickBooks(
  byBookmaker: Record<string, SgoBookLine> | undefined,
  books: Set<string>,
): Record<string, SgoBookLine> {
  const picked: Record<string, SgoBookLine> = {};
  for (const [book, line] of Object.entries(byBookmaker ?? {})) {
    if (books.has(book)) picked[book] = line;
  }
  return picked;
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
    const teamId = url.searchParams.get("teamId");
    if (teamId) {
      // `getPostseasonPitchCounts`: one team's games over a short window.
      const fields = url.searchParams.get("fields");
      return memoized(`postsched:${fields ?? ""}`, () =>
        capturedBodyFor(fields, POSTSEASON_SCHEDULE_PATH, POSTSEASON_SCHEDULE_FIELDS_PATH, SCHEDULE_FIELDS),
      );
    }
    const startDate = url.searchParams.get("startDate");
    if (startDate) {
      // `getOpeningDay`: the first regular-season date in a Feb-May window.
      const fields = url.searchParams.get("fields");
      return memoized(`opening:${fields ?? ""}`, () =>
        capturedBodyFor(fields, OPENING_DAY_PATH, OPENING_DAY_FIELDS_PATH, OPENING_DAY_FIELDS),
      );
    }
    const date = url.searchParams.get("date") ?? BENCH_DATE;
    const fields = url.searchParams.get("fields");
    return memoized(`sched:${date}:${fields ?? ""}`, () => {
      const body = date === BENCH_DATE ? SCHEDULE_BODY : JSON.stringify({ dates: [] });
      if (!fields) return body;
      return JSON.stringify(pruneFields(JSON.parse(body), fieldSet(fields)));
    });
  }

  const roster = /^\/api\/v1\/teams\/(\d+)\/roster$/.exec(path);
  if (roster) {
    const teamId = Number(roster[1]);
    const side = SIDE_BY_TEAM_ID.get(teamId);
    const hydrate = url.searchParams.get("hydrate") ?? "";
    if (!side) return JSON.stringify({ roster: [] });
    const hydrated = hydrate.includes("stats(");
    const fields = url.searchParams.get("fields");
    return memoized(`roster:${teamId}:${hydrated ? "h" : "p"}:${fields ?? ""}`, () => {
      const body = hydrated
        ? ROSTER_BODIES.get(teamId) ?? JSON.stringify({ roster: [] })
        : rosterBody(side, BENCH_SEASON, false);
      if (!fields) return body;
      return JSON.stringify(pruneFields(JSON.parse(body), fieldSet(fields)));
    });
  }

  if (path === "/api/v1/people") {
    const ids = (url.searchParams.get("personIds") ?? "")
      .split(",")
      .map(Number)
      .filter((id) => Number.isInteger(id) && id > 0);
    const hydrate = url.searchParams.get("hydrate") ?? "";
    const fields = url.searchParams.get("fields");
    return memoized(`people:${ids.join(",")}:${hydrate}:${fields ?? ""}`, () => {
      const body = peopleBody(ids, hydrate);
      if (!fields) return body;
      return JSON.stringify(pruneFields(JSON.parse(body), fieldSet(fields)));
    });
  }

  if (path === "/api/v1/standings") {
    const fields = url.searchParams.get("fields");
    return memoized(`standings:${fields ?? ""}`, () =>
      capturedBodyFor(fields, STANDINGS_PATH, STANDINGS_FIELDS_PATH, STANDINGS_FIELDS),
    );
  }

  if (path === "/api/v1/schedule/postseason/series") {
    const fields = url.searchParams.get("fields");
    return memoized(`series:${fields ?? ""}`, () =>
      capturedBodyFor(fields, POSTSEASON_SERIES_PATH, POSTSEASON_SERIES_FIELDS_PATH, POSTSEASON_SERIES_FIELDS),
    );
  }

  const seasonDates = /^\/api\/v1\/seasons\/(\d+)$/.exec(path);
  if (seasonDates) {
    const fields = url.searchParams.get("fields");
    return memoized(`season:${seasonDates[1]}:${fields ?? ""}`, () =>
      capturedBodyFor(fields, SEASON_DATES_PATH, SEASON_DATES_FIELDS_PATH, SEASON_DATES_FIELDS),
    );
  }

  const boxscore = /^\/api\/v1\/game\/(\d+)\/boxscore$/.exec(path);
  if (boxscore) {
    const pk = Number(boxscore[1]);
    if (!BOXSCORE_PKS.includes(pk)) return JSON.stringify({ teams: {} });
    const fields = url.searchParams.get("fields");
    return memoized(`box:${pk}:${fields ?? ""}`, () =>
      capturedBodyFor(fields, boxscorePath(pk, false), boxscorePath(pk, true), BOXSCORE_FIELDS),
    );
  }

  const person = /^\/api\/v1\/people\/(\d+)$/.exec(path);
  if (person) return memoized(`person:${person[1]}`, () => personBody(Number(person[1])));

  const liveFeed = /^\/api\/v1\.1\/game\/(\d+)\/feed\/live$/.exec(path);
  if (liveFeed) {
    if (Number(liveFeed[1]) === CAPTURED_FEED_PK) {
      const fields = url.searchParams.get("fields");
      return memoized(`feed:captured:${fields ?? ""}`, () => {
        if (!fields) return capturedFeedBody();
        const wanted = fieldSet(fields);
        const captured = fieldSet(CAPTURED_FEED_FIELDS);
        if (wanted.size === captured.size && [...wanted].every((name) => captured.has(name))) {
          return capturedNarrowedFeedBody();
        }
        return JSON.stringify(pruneFields(JSON.parse(capturedFeedBody()), wanted));
      });
    }
    const game = GAMES.find((g) => String(g.gamePk) === liveFeed[1]);
    if (!game) return JSON.stringify({ gamePk: 0, gameData: { teams: { away: { id: 0 } } }, liveData: {} });
    // The API honours `fields` as a list of field names; the stub applies the
    // list the caller sent, so a narrowed request serves a narrowed body without
    // the fixture and the app having to agree on a constant.
    const fields = url.searchParams.get("fields");
    return memoized(`feed:${liveFeed[1]}:${fields ?? ""}`, () => {
      const body = liveFeedBody(game);
      if (!fields) return body;
      return JSON.stringify(pruneFields(JSON.parse(body), fieldSet(fields)));
    });
  }

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
/**
 * A response-shaped stand-in for the network. The app's clients read only `ok`,
 * `status` and `json()`; a real `Response` would encode the body to bytes and
 * decode it again on every read, which is the network's cost rather than the
 * application's — and it would land inside the measured cycle. The app's own
 * `JSON.parse` still runs on every read, which is the cost being measured.
 */
function stubResponse(body: string): Response {
  return {
    ok: true,
    status: 200,
    json: async () => JSON.parse(body),
  } as unknown as Response;
}

export function installUpstream(): Upstream {
  const log: Upstream = { calls: [], unexpected: [], stubMs: 0 };

  const stub = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const started = performance.now();
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
    const response = stubResponse(body);
    log.calls.push({ url: raw, status: 200, bytes: body.length });
    log.stubMs += performance.now() - started;
    return response;
  };

  // The DOM `fetch` type carries extra overloads (Request, URL); the routing
  // stub only needs the single (input, init) form the app's clients use.
  const stubFetch = stub as typeof globalThis.fetch;
  globalThis.fetch = stubFetch;
  return log;
}
