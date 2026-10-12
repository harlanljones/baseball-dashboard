/**
 * Deterministic upstream fixtures for the autoresearch benchmark.
 *
 * Nothing here touches the network. Every count is derived from a hash of the
 * player / team ids, so each run — on any machine — sees byte-identical
 * upstream payloads, which is what makes the timings comparable across
 * iterations.
 *
 * The shapes mirror what `src/lib/{mlb,odds,weather}` actually reads; each
 * builder names the reader it feeds so a response-shape change upstream shows
 * up here as a failing invariant rather than a silent empty board.
 */

import { BALLPARKS } from "@/lib/weather/ballparks";

export interface BenchTeam {
  id: number;
  name: string;
  abbreviation: string;
  venueId: number;
  venue: string;
  city: string;
}

/** Real MLB ids / venue ids, so the ballpark table (weather) resolves them. */
export const TEAMS: readonly BenchTeam[] = [
  { id: 110, name: "Baltimore Orioles", abbreviation: "BAL", venueId: 2, venue: "Oriole Park at Camden Yards", city: "Baltimore" },
  { id: 141, name: "Toronto Blue Jays", abbreviation: "TOR", venueId: 14, venue: "Rogers Centre", city: "Toronto" },
  { id: 147, name: "New York Yankees", abbreviation: "NYY", venueId: 3313, venue: "Yankee Stadium", city: "New York" },
  { id: 111, name: "Boston Red Sox", abbreviation: "BOS", venueId: 3, venue: "Fenway Park", city: "Boston" },
  { id: 139, name: "Tampa Bay Rays", abbreviation: "TB", venueId: 12, venue: "Tropicana Field", city: "St. Petersburg" },
  { id: 114, name: "Cleveland Guardians", abbreviation: "CLE", venueId: 5, venue: "Progressive Field", city: "Cleveland" },
  { id: 116, name: "Detroit Tigers", abbreviation: "DET", venueId: 2394, venue: "Comerica Park", city: "Detroit" },
  { id: 145, name: "Chicago White Sox", abbreviation: "CWS", venueId: 4, venue: "Rate Field", city: "Chicago" },
  { id: 118, name: "Kansas City Royals", abbreviation: "KC", venueId: 7, venue: "Kauffman Stadium", city: "Kansas City" },
  { id: 142, name: "Minnesota Twins", abbreviation: "MIN", venueId: 3312, venue: "Target Field", city: "Minneapolis" },
  { id: 140, name: "Texas Rangers", abbreviation: "TEX", venueId: 5325, venue: "Globe Life Field", city: "Arlington" },
  { id: 117, name: "Houston Astros", abbreviation: "HOU", venueId: 2392, venue: "Daikin Park", city: "Houston" },
  { id: 133, name: "Athletics", abbreviation: "ATH", venueId: 2529, venue: "Sutter Health Park", city: "West Sacramento" },
  { id: 136, name: "Seattle Mariners", abbreviation: "SEA", venueId: 680, venue: "T-Mobile Park", city: "Seattle" },
  { id: 108, name: "Los Angeles Angels", abbreviation: "LAA", venueId: 1, venue: "Angel Stadium", city: "Anaheim" },
  { id: 120, name: "Washington Nationals", abbreviation: "WSH", venueId: 3309, venue: "Nationals Park", city: "Washington" },
  { id: 143, name: "Philadelphia Phillies", abbreviation: "PHI", venueId: 2681, venue: "Citizens Bank Park", city: "Philadelphia" },
  { id: 121, name: "New York Mets", abbreviation: "NYM", venueId: 3289, venue: "Citi Field", city: "New York" },
  { id: 144, name: "Atlanta Braves", abbreviation: "ATL", venueId: 4705, venue: "Truist Park", city: "Atlanta" },
  { id: 146, name: "Miami Marlins", abbreviation: "MIA", venueId: 4169, venue: "loanDepot park", city: "Miami" },
  { id: 113, name: "Cincinnati Reds", abbreviation: "CIN", venueId: 2602, venue: "Great American Ball Park", city: "Cincinnati" },
  { id: 158, name: "Milwaukee Brewers", abbreviation: "MIL", venueId: 32, venue: "American Family Field", city: "Milwaukee" },
  { id: 112, name: "Chicago Cubs", abbreviation: "CHC", venueId: 17, venue: "Wrigley Field", city: "Chicago" },
  { id: 134, name: "Pittsburgh Pirates", abbreviation: "PIT", venueId: 31, venue: "PNC Park", city: "Pittsburgh" },
  { id: 138, name: "St. Louis Cardinals", abbreviation: "STL", venueId: 2889, venue: "Busch Stadium", city: "St. Louis" },
  { id: 109, name: "Arizona Diamondbacks", abbreviation: "ARI", venueId: 15, venue: "Chase Field", city: "Phoenix" },
  { id: 135, name: "San Diego Padres", abbreviation: "SD", venueId: 2680, venue: "PETCO Park", city: "San Diego" },
  { id: 137, name: "San Francisco Giants", abbreviation: "SF", venueId: 2395, venue: "Oracle Park", city: "San Francisco" },
  { id: 119, name: "Los Angeles Dodgers", abbreviation: "LAD", venueId: 22, venue: "Dodger Stadium", city: "Los Angeles" },
  { id: 115, name: "Colorado Rockies", abbreviation: "COL", venueId: 19, venue: "Coors Field", city: "Denver" },
];

export const BENCH_DATE = "2026-07-11";
export const BENCH_SEASON = 2026;

/** Games on the slate — a full MLB day. */
export const GAME_COUNT = 15;
/** Preview games the slate-wide leans sample (mirrors `MAX_GAMES` in lib/odds/leans). */
export const LEAN_GAME_COUNT = 8;
/** Active-roster composition per team. */
export const HITTERS_PER_TEAM = 13;
export const PITCHERS_PER_TEAM = 13;
/** Players per team that carry prop markets on the provider board. */
export const PROP_HITTERS_PER_TEAM = 10;
export const PROP_PITCHERS_PER_TEAM = 1;
/** Sportsbooks quoting each prop line. */
/** Books quoting each market (see BOOK_NAMES). */
export const BOOKS = 12;

const FIRST_NAMES = [
  "Aaron", "José", "Rafael", "Bobby", "Corbin", "Manny", "Jean", "J.D.", "Luis", "Carlos",
  "Tarik", "Gerrit", "Framber", "Zack", "Logan", "Pete", "Freddie", "Mookie", "Bryce", "Trea",
  "Vladimir", "Bo", "Yordan", "Kyle", "Randy", "Adley", "Salvador", "Xander", "Nolan", "Matt",
  "Cody", "Eloy", "Wander", "Gleyber", "Anthony", "Julio", "Teoscar", "Marcell", "Willy", "Josh",
  "Jordan", "Spencer", "Keibert", "Isaac", "Oneil", "Lars", "Seiya",
];

const LAST_NAMES = [
  "Judge", "Ramírez", "Devers", "Witt", "Carroll", "Machado", "Segura", "Martinez", "Arraez", "Correa",
  "Skubal", "Cole", "Valdez", "Wheeler", "Webb", "Alonso", "Freeman", "Betts", "Harper", "Turner",
  "Guerrero", "Bichette", "Alvarez", "Tucker", "Arozarena", "Rutschman", "Perez", "Bogaerts", "Arenado", "Olson",
  "Bellinger", "Jimenez", "Franco", "Torres", "Volpe", "Rodriguez", "Hernandez", "Ozuna", "Adames", "Naylor",
  "Walker", "Strider", "Ruiz", "Paredes", "Cruz", "Nootbaar", "Suzuki", "Chapman", "Ohtani", "Soto",
  "Riley", "Albies", "Contreras", "Langford", "Carter",
];

export interface BenchPlayer {
  id: number;
  fullName: string;
}

export interface BenchSide {
  team: BenchTeam;
  hitters: BenchPlayer[];
  pitchers: BenchPlayer[];
  probable: BenchPlayer;
}

export interface BenchGame {
  gamePk: number;
  startTimeISO: string;
  venueId: number;
  venue: string;
  city: string;
  away: BenchSide;
  home: BenchSide;
}

/** 32-bit integer hash — the single source of every "random" number here. */
function hash32(value: number): number {
  let x = (value ^ 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}

/** Deterministic 0..1 sample for a (id, salt) pair. */
export function unit(id: number, salt: number): number {
  return hash32(id * 2654435761 + salt * 40503) / 4294967296;
}

/** Round to a plausible sportsbook half-point line, never below the market floor. */
function halfLine(value: number, min: number, max: number): number {
  const clamped = Math.min(max, Math.max(min, value));
  return Math.max(min, Math.round(clamped * 2) / 2);
}

function playerName(globalIndex: number): string {
  const first = FIRST_NAMES[globalIndex % FIRST_NAMES.length];
  let last = LAST_NAMES[(globalIndex * 13 + 7) % LAST_NAMES.length];
  // A slice of the league carries the naming quirks the matcher has to strip:
  // Jr./Sr. suffixes and hyphenated surnames.
  if (globalIndex % 61 === 0) return `${first} ${last} Jr.`;
  if (globalIndex % 37 === 0) last = `${last}-Garcia`;
  return `${first} ${last}`;
}

function makeSide(teamIndex: number): BenchSide {
  const team = TEAMS[teamIndex];
  const hitters: BenchPlayer[] = [];
  const pitchers: BenchPlayer[] = [];
  for (let i = 0; i < HITTERS_PER_TEAM; i += 1) {
    const slot = i;
    const g = teamIndex * 26 + slot;
    hitters.push({ id: 800000 + teamIndex * 100 + i, fullName: playerName(g) });
  }
  for (let i = 0; i < PITCHERS_PER_TEAM; i += 1) {
    const g = teamIndex * 26 + HITTERS_PER_TEAM + i;
    pitchers.push({ id: 900000 + teamIndex * 100 + i, fullName: playerName(g) });
  }
  // Season plate appearances, descending down the roster: `getRosterWithSeasonStats`
  // sorts by PA and the lineup proxy takes the top nine.
  const withPa = hitters.map((hitter, i) => ({ hitter, pa: 520 - i * 37 - (teamIndex % 3) * 11 }));
  withPa.sort((a, b) => b.pa - a.pa);
  return { team, hitters: withPa.map((entry) => entry.hitter), pitchers, probable: pitchers[0] };
}

/** Deterministic shuffle (Fisher–Yates over a seeded stream) for team pairing. */
function shuffle<T>(items: T[], seed: number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = hash32(seed + i * 7919) % (i + 1);
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

export function buildGames(): BenchGame[] {
  const sides = TEAMS.map((_, index) => makeSide(index));
  const order = shuffle(
    sides.map((_, index) => index),
    20260711,
  );
  const games: BenchGame[] = [];
  for (let i = 0; i < GAME_COUNT; i += 1) {
    const away = sides[order[i * 2]];
    const home = sides[order[i * 2 + 1]];
    // First pitches spread across the afternoon/evening UTC window so the
    // weather buckets land on different hours.
    const minuteOfDay = 17 * 60 + ((i * 29) % 400);
    const hh = String(Math.floor(minuteOfDay / 60)).padStart(2, "0");
    const mm = String(minuteOfDay % 60).padStart(2, "0");
    games.push({
      gamePk: 745000 + i,
      startTimeISO: `${BENCH_DATE}T${hh}:${mm}:00Z`,
      venueId: home.team.venueId,
      venue: home.team.venue,
      city: home.team.city,
      away,
      home,
    });
  }
  return games;
}

export const GAMES: BenchGame[] = buildGames();

/**
 * The game the props-page phase renders: the first slate game at an open-air
 * park, so the weather-sensitive HR/total-bases markets actually read a
 * wind/temperature signal instead of being skipped for a closed roof.
 */
export const PROPS_GAME_INDEX = Math.max(
  0,
  GAMES.findIndex((game) => BALLPARKS[game.venueId]?.roof === "open"),
);
export const PROPS_GAME = GAMES[PROPS_GAME_INDEX];

/** Every player id in the league, for batch lookups and name resolution. */
const NAME_BY_ID = new Map<number, string>();
for (const game of GAMES) {
  for (const side of [game.away, game.home]) {
    for (const player of [...side.hitters, ...side.pitchers]) NAME_BY_ID.set(player.id, player.fullName);
  }
}

export function playerNameById(id: number): string {
  return NAME_BY_ID.get(id) ?? `Player ${id}`;
}

// --- Season stat lines -------------------------------------------------------

export interface HitterCounts {
  games: number;
  pa: number;
  ab: number;
  h: number;
  hr: number;
  rbi: number;
  bb: number;
  totalBases: number;
  avg: string;
  obp: string;
  slg: string;
  babip: string;
}

export function hitterCounts(id: number): HitterCounts {
  const games = 60 + Math.floor(unit(id, 1) * 70);
  const pa = Math.round(games * (3.9 + unit(id, 2) * 0.6));
  const ab = Math.round(pa * 0.88);
  const h = Math.round(games * (0.55 + unit(id, 3) * 0.9));
  const hr = Math.round(games * (0.03 + unit(id, 4) * 0.22));
  const rbi = Math.round(games * (0.25 + unit(id, 5) * 0.55));
  const bb = Math.round(games * (0.05 + unit(id, 6) * 0.35));
  const totalBases = h + Math.round(games * (0.15 + unit(id, 7) * 0.5));
  const inPlay = Math.max(1, ab - hr - Math.round(games * 0.18));
  const babip = ((h - hr) / inPlay).toFixed(3).replace(/^0/, "");
  return {
    games,
    pa,
    ab,
    h,
    hr,
    rbi,
    bb,
    totalBases,
    avg: (h / Math.max(1, ab)).toFixed(3).replace(/^0/, ""),
    obp: ((h + bb) / Math.max(1, pa)).toFixed(3).replace(/^0/, ""),
    slg: (totalBases / Math.max(1, ab)).toFixed(3).replace(/^0/, ""),
    babip,
  };
}

export interface PitcherCounts {
  gamesStarted: number;
  ip: number;
  ipText: string;
  k: number;
  bb: number;
  battersFaced: number;
  earnedRuns: number;
  era: string;
  k9: number;
  outsPerStart: number;
}

export function pitcherCounts(id: number): PitcherCounts {
  const gamesStarted = 18 + Math.floor(unit(id, 11) * 14);
  const ip = 95 + Math.floor(unit(id, 12) * 85);
  const k9 = 7 + unit(id, 13) * 5;
  const k = Math.round((k9 * ip) / 9);
  const bb = Math.round(ip * (0.05 + unit(id, 14) * 0.06));
  const battersFaced = Math.round(ip * 4.15);
  const earnedRuns = Math.round(ip * (0.2 + unit(id, 15) * 0.24));
  const outsPerStart = (ip * 3) / gamesStarted;
  return {
    gamesStarted,
    ip,
    ipText: `${Math.floor(ip / 3)}.${ip % 3}`,
    k,
    bb,
    battersFaced,
    earnedRuns,
    era: ((earnedRuns * 9) / ip).toFixed(2),
    k9,
    outsPerStart,
  };
}

/** The line the provider posts for one prop: near the season rate, on a half point. */
export function propLineFor(id: number, market: PropMarketKey, salt: number): number {
  const factor = 0.7 + unit(id, salt + 40) * 0.6; // season-average / line
  if (market === "pitcher_strikeouts") {
    const p = pitcherCounts(id);
    return halfLine((p.k9 * p.outsPerStart) / 27 / factor, 2.5, 9.5);
  }
  if (market === "pitcher_outs") {
    const p = pitcherCounts(id);
    return halfLine(p.outsPerStart / factor, 9.5, 20.5);
  }
  const c = hitterCounts(id);
  const perGame: Record<string, number> = {
    batter_hits: c.h / c.games,
    batter_total_bases: c.totalBases / c.games,
    batter_home_runs: c.hr / c.games,
    batter_rbis: c.rbi / c.games,
    batter_walks: c.bb / c.games,
  };
  const max = market === "batter_total_bases" ? 3.5 : market === "batter_walks" ? 1.5 : 1.5;
  const min = market === "batter_home_runs" ? 0.5 : 0.5;
  return halfLine(perGame[market] / factor, min, max);
}

// --- Raw payload builders ----------------------------------------------------

export type PropMarketKey =
  | "pitcher_strikeouts"
  | "pitcher_outs"
  | "batter_hits"
  | "batter_total_bases"
  | "batter_home_runs"
  | "batter_rbis"
  | "batter_walks";

export const MARKETS: readonly PropMarketKey[] = [
  "pitcher_strikeouts",
  "pitcher_outs",
  "batter_hits",
  "batter_total_bases",
  "batter_home_runs",
  "batter_rbis",
  "batter_walks",
];

export const STAT_ID_BY_MARKET: Record<PropMarketKey, string> = {
  pitcher_strikeouts: "pitching_strikeouts",
  pitcher_outs: "pitching_outs",
  batter_hits: "batting_hits",
  batter_total_bases: "batting_totalBases",
  batter_home_runs: "batting_homeRuns",
  batter_rbis: "batting_RBI",
  batter_walks: "batting_basesOnBalls",
};

export const BATTER_MARKETS: readonly PropMarketKey[] = [
  "batter_hits",
  "batter_total_bases",
  "batter_home_runs",
  "batter_rbis",
  "batter_walks",
];
export const PITCHER_MARKETS: readonly PropMarketKey[] = [
  "pitcher_strikeouts",
  "pitcher_outs",
];

/**
 * Prop names the provider posts that match nobody on an MLB roster (renamed
 * players, typos). The matcher must drop them rather than attribute them to the
 * wrong player, so the harness asserts none of them reaches the board.
 */
export const PHANTOM_NAMES: readonly string[] = ["Nate Bargatze", "Ricky Vaughn"];

export interface EventPropPair {
  player: BenchPlayer;
  market: PropMarketKey;
  line: number;
  /** True when both sides of the market are posted, so the reader can pair a book. */
  usable: boolean;
}

/**
 * The prop markets one event's board posts: both teams' prop hitters plus both
 * probables. Roughly one market in twenty is posted one-sided — the reader has
 * to drop those instead of quoting half a market — which is what makes a
 * fixture-derived expected board size necessary rather than a constant.
 */
export function propPairsForEvent(game: BenchGame): EventPropPair[] {
  const pairs: EventPropPair[] = [];
  const add = (player: BenchPlayer, market: PropMarketKey) => {
    const droppedOver = hash32(player.id + market.length * 977 + 1) % 20 === 0;
    const droppedUnder = hash32(player.id + market.length * 977 + 2) % 20 === 0;
    pairs.push({ player, market, line: propLineFor(player.id, market, 3), usable: !droppedOver && !droppedUnder });
  };
  for (const side of [game.away, game.home]) {
    for (const hitter of side.hitters.slice(0, PROP_HITTERS_PER_TEAM)) {
      for (const market of BATTER_MARKETS) add(hitter, market);
    }
    for (const pitcher of side.pitchers.slice(0, PROP_PITCHERS_PER_TEAM)) {
      for (const market of PITCHER_MARKETS) add(pitcher, market);
    }
  }
  return pairs;
}

/** Props the reader must resolve for one event — the harness's expected board size. */
export function expectedMatchedProps(game: BenchGame): number {
  return propPairsForEvent(game).filter((pair) => pair.usable).length;
}

/** SportsGameOdds playerID convention: `AARON_JUDGE_1_MLB`. */
export function sgoPlayerId(fullName: string): string {
  return `${fullName
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")}_1_MLB`;
}

/**
 * The books the fixture quotes each market from — the provider's real MLB prop
 * book universe, trimmed to the majors. `bookmakerID` requests are served from
 * this set, so narrowing a request shrinks the payload exactly as upstream does.
 */
export const BOOK_NAMES = [
  "fanduel",
  "draftkings",
  "betmgm",
  "caesars",
  "bet365",
  "espnbet",
  "fanatics",
  "pointsbet",
  "betrivers",
  "hardrock",
  "tipico",
  "wynnbet",
];

export interface SgoBookLine {
  odds?: string;
  overUnder?: string;
  available?: boolean;
}

export interface SgoOddFixture {
  oddID?: string;
  statID?: string;
  statEntityID?: string;
  playerID?: string;
  periodID?: string;
  betTypeID?: string;
  sideID?: string;
  byBookmaker?: Record<string, SgoBookLine>;
}

/** One SportsGameOdds event, shaped like the provider's v2 `/events` payload. */
export interface SgoEventFixture {
  eventID: string;
  leagueID: string;
  teams: {
    away: { names: { long: string; medium: string } };
    home: { names: { long: string; medium: string } };
  };
  status: { startsAt: string; started: boolean; completed: boolean };
  odds: Record<string, SgoOddFixture>;
  players?: Record<string, { name: string }>;
}

/**
 * One SportsGameOdds event object (`oddfmt` filters handled by the caller).
 * `withPlayers` mirrors the provider sometimes omitting the player record, which
 * forces the `playerNameFromId` fallback on the reader side.
 */
export function sgoEvent(game: BenchGame, withPlayers: boolean): SgoEventFixture {
  const odds: Record<string, SgoOddFixture> = {};
  const players: Record<string, { name: string }> = {};

  for (const { player, market, line } of propPairsForEvent(game)) {
    const statID = STAT_ID_BY_MARKET[market];
    const playerID = sgoPlayerId(player.fullName);
    if (withPlayers) players[playerID] = { name: player.fullName };

    for (const sideID of ["over", "under"] as const) {
      const dropped = hash32(player.id + market.length * 977 + (sideID === "over" ? 1 : 2)) % 20 === 0;
      if (dropped) continue;
      const oddID = `${statID}-${playerID}-game-ou-${sideID}`;
      const byBookmaker: Record<string, SgoBookLine> = {};
      const bookOffset = hash32(player.id + playerID.length) % (BOOK_NAMES.length - 3);
      for (let b = 0; b < BOOKS; b += 1) {
        const book = BOOK_NAMES[(b + bookOffset) % BOOK_NAMES.length];
        // Books disagree on the line by half points — but quote the *same* line
        // on both sides, so the reader can pair over and under at one book.
        const drift = ((hash32(player.id + b * 31 + market.length * 17) % 5) - 2) * 0.5;
        // American price on the grid books actually post, side-dependent.
        const price = -140 + (hash32(player.id * 7 + (b * 17 + (sideID === "over" ? 3 : 11)) * 131) % 81);
        byBookmaker[book] = {
          odds: String(price),
          overUnder: Math.max(0.5, line + drift).toFixed(1),
          available: !(book === "fanatics" && b % 3 === 0),
        };
      }
      odds[oddID] = {
        oddID,
        statID,
        statEntityID: "player",
        playerID,
        periodID: "game",
        betTypeID: "ou",
        sideID,
        byBookmaker,
      };
    }
  }

  // A couple of team-level totals ride along; the reader filters them out.
  odds["batting_hits-all-game-ou-over"] = {
    oddID: "batting_hits-all-game-ou-over",
    statID: "batting_hits",
    statEntityID: "all",
    playerID: "all",
    periodID: "game",
    betTypeID: "ou",
    sideID: "over",
    byBookmaker: { fanduel: { odds: "-110", overUnder: "17.5", available: true } },
  };

  // Names no MLB roster carries (provider naming drift). The reader must drop
  // these rather than attach them to some other player.
  PHANTOM_NAMES.forEach((name, index) => {
    const playerID = sgoPlayerId(name);
    const phantomId = -(index + 1) * 1000;
    const line = 1.5;
    for (const sideID of ["over", "under"] as const) {
      const oddID = `batting_hits-${playerID}-game-ou-${sideID}`;
      odds[oddID] = {
        oddID,
        statID: "batting_hits",
        statEntityID: "player",
        playerID,
        periodID: "game",
        betTypeID: "ou",
        sideID,
        byBookmaker: {
          fanduel: { odds: "-115", overUnder: line.toFixed(1), available: true },
          draftkings: { odds: "-105", overUnder: line.toFixed(1), available: true },
          betmgm: { odds: `${-140 + (hash32(phantomId + index) % 60)}`, overUnder: line.toFixed(1), available: true },
        },
      };
    }
    players[playerID] = { name };
  });

  const event: SgoEventFixture = {
    eventID: `SGO_${game.gamePk}`,
    leagueID: "MLB",
    teams: {
      away: { names: { long: game.away.team.name, medium: game.away.team.abbreviation } },
      home: { names: { long: game.home.team.name, medium: game.home.team.abbreviation } },
    },
    status: { startsAt: game.startTimeISO, started: false, completed: false },
    odds,
  };
  if (withPlayers) event.players = players;
  return event;
}

/** Schedule response body (`getSchedule`, `getGameTeams`). */
export function scheduleBody(games: BenchGame[], date: string): string {
  const raw = games.map((game) => ({
    gamePk: game.gamePk,
    gameDate: game.startTimeISO,
    officialDate: date,
    gameType: "R",
    status: { abstractGameState: "Preview", detailedState: "Scheduled" },
    venue: { id: game.venueId, name: game.venue, location: { city: game.city } },
    teams: {
      away: {
        team: { id: game.away.team.id, name: game.away.team.name, abbreviation: game.away.team.abbreviation },
        leagueRecord: { wins: 48, losses: 42, pct: ".533" },
        probablePitcher: { id: game.away.probable.id, fullName: game.away.probable.fullName },
      },
      home: {
        team: { id: game.home.team.id, name: game.home.team.name, abbreviation: game.home.team.abbreviation },
        leagueRecord: { wins: 51, losses: 39, pct: ".567" },
        probablePitcher: { id: game.home.probable.id, fullName: game.home.probable.fullName },
      },
    },
  }));
  return JSON.stringify({ dates: [{ date, totalGames: raw.length, games: raw }] });
}

/**
 * Active-roster response, hydrated with season hitting stats — what
 * `getRosterWithSeasonStats` reads (it drops pitchers, sorts by PA).
 */
export function rosterBody(side: BenchSide, season: number, hydrate: boolean): string {
  const entries: unknown[] = [];
  side.hitters.forEach((player, i) => {
    const counts = hitterCounts(player.id);
    const pa = 520 - i * 37 - (side.team.id % 3) * 11;
    entries.push({
      person: {
        id: player.id,
        fullName: player.fullName,
        ...(hydrate
          ? {
              stats: [
                {
                  type: { displayName: "season" },
                  group: { displayName: "hitting" },
                  splits: [{ season: String(season), stat: seasonHittingStat({ ...counts, pa }) }],
                },
              ],
            }
          : {}),
      },
      position: { type: "Outfielder", abbreviation: "OF" },
      status: { code: "A" },
    });
  });
  side.pitchers.forEach((player, i) => {
    const counts = pitcherCounts(player.id);
    entries.push({
      person: {
        id: player.id,
        fullName: player.fullName,
        ...(hydrate
          ? {
              stats: [
                {
                  type: { displayName: "season" },
                  group: { displayName: "pitching" },
                  splits: [{ season: String(season), stat: seasonPitchingStat(counts) }],
                },
              ],
            }
          : {}),
      },
      position: { type: "Pitcher", abbreviation: i === 0 ? "SP" : "RP" },
      status: { code: "A" },
    });
  });
  return JSON.stringify({ roster: entries, link: `/api/v1/teams/${side.team.id}/roster` });
}

function seasonHittingStat(counts: HitterCounts): Record<string, unknown> {
  return {
    gamesPlayed: counts.games,
    plateAppearances: counts.pa,
    atBats: counts.ab,
    hits: counts.h,
    homeRuns: counts.hr,
    rbi: counts.rbi,
    baseOnBalls: counts.bb,
    strikeOuts: Math.round(counts.pa * 0.22),
    totalBases: counts.totalBases,
    avg: counts.avg,
    obp: counts.obp,
    slg: counts.slg,
    babip: counts.babip,
    ops: (Number(counts.obp) + Number(counts.slg)).toFixed(3).replace(/^0/, ""),
  };
}

function seasonPitchingStat(counts: PitcherCounts): Record<string, unknown> {
  return {
    gamesStarted: counts.gamesStarted,
    inningsPitched: counts.ipText,
    strikeOuts: counts.k,
    baseOnBalls: counts.bb,
    battersFaced: counts.battersFaced,
    earnedRuns: counts.earnedRuns,
    era: counts.era,
  };
}

function sabermetricStat(id: number, group: "hitting" | "pitching"): Record<string, unknown> {
  if (group === "pitching") {
    return {
      war: (unit(id, 25) * 5).toFixed(1),
      fip: (2.7 + unit(id, 26) * 2.2).toFixed(2),
      xfip: (2.9 + unit(id, 27) * 2.2).toFixed(2),
      eraMinus: Math.round(70 + unit(id, 28) * 70),
    };
  }
  return {
    woba: (0.29 + unit(id, 21) * 0.12).toFixed(3),
    wRcPlus: Math.round(80 + unit(id, 22) * 70),
    war: (unit(id, 23) * 6).toFixed(1),
    xwoba: (0.28 + unit(id, 24) * 0.12).toFixed(3),
  };
}

function splitHittingStat(id: number, salt: number): Record<string, unknown> {
  const pa = 40 + Math.round(unit(id, salt) * 180);
  return {
    plateAppearances: pa,
    baseOnBalls: Math.round(pa * (0.05 + unit(id, salt + 1) * 0.1)),
    strikeOuts: Math.round(pa * (0.15 + unit(id, salt + 2) * 0.15)),
    obp: (0.28 + unit(id, salt + 3) * 0.12).toFixed(3).replace(/^0/, ""),
    ops: (0.66 + unit(id, salt + 4) * 0.4).toFixed(3).replace(/^0/, ""),
  };
}

function splitPitchingStat(id: number, salt: number): Record<string, unknown> {
  const counts = pitcherCounts(id);
  const bf = 60 + Math.round(unit(id, salt) * 120);
  return {
    inningsPitched: `${Math.floor(bf / 4.15 / 3)}.${bf % 3}`,
    era: (2.5 + unit(id, salt + 1) * 3).toFixed(2),
    battersFaced: bf,
    baseOnBalls: Math.round(bf * 0.08),
    strikeOuts: Math.round(bf * 0.24),
    gamesStarted: Math.max(1, Math.round(counts.gamesStarted / 2)),
  };
}

function vsPlayerStat(id: number, pitcherId: number): Record<string, unknown> {
  const seed = hash32(id + pitcherId);
  const pa = seed % 31;
  const h = Math.min(pa, Math.round(pa * 0.25));
  return {
    plateAppearances: pa,
    hits: h,
    homeRuns: Math.min(h, seed % 3),
    baseOnBalls: Math.round(pa * 0.08),
    strikeOuts: Math.round(pa * 0.25),
    avg: pa > 0 ? (h / pa).toFixed(3).replace(/^0/, "") : "-",
    obp: "-",
    slg: "-",
  };
}

function gameLogSplits(id: number, season: number): { date: string; stat: Record<string, unknown> }[] {
  const counts = pitcherCounts(id);
  const starts = [4, 9, 17, 24, 30].map((daysAgo) => {
    const date = new Date(`${BENCH_DATE}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - daysAgo);
    return date.toISOString().slice(0, 10);
  });
  return starts.map((date, i) => ({
    date,
    season: String(season),
    stat: {
      inningsPitched: `${5 + (hash32(id + i) % 3)}.${hash32(id + i * 3) % 3}`,
      earnedRuns: hash32(id + i * 5) % 5,
      battersFaced: 22 + (hash32(id + i * 7) % 8),
      baseOnBalls: hash32(id + i * 11) % 4,
      strikeOuts: 3 + (hash32(id + i * 13) % 8),
      gamesStarted: 1,
      numberOfPitches: 78 + (hash32(id + i * 17) % 30),
    },
  })).filter((_, i) => counts.gamesStarted > 0 && i < 5);
}

export interface HydrateQuery {
  type: string;
  group?: string;
  season?: string;
  sitCodes?: string;
  opposingPlayerId?: string;
}

/** Parse `stats(type=season,season=2026,group=hitting)`-style hydrate strings. */
export function parseHydrate(hydrate: string): HydrateQuery {
  const inner = /stats\(([^)]*)\)/.exec(hydrate)?.[1] ?? "";
  const parts = new Map<string, string>();
  for (const part of inner.split(",")) {
    const [key, value] = part.split("=");
    if (key && value != null) parts.set(key, value);
  }
  return {
    type: parts.get("type") ?? "",
    group: parts.get("group"),
    season: parts.get("season"),
    sitCodes: parts.get("sitCodes"),
    opposingPlayerId: parts.get("opposingPlayerId"),
  };
}

/**
 * Batched people-stats response — what `fetchPeopleStats` reads through
 * `/api/v1/people?personIds=…&hydrate=…`. Returns exactly the requested ids.
 */
export function peopleBody(personIds: number[], hydrate: string): string {
  const query = parseHydrate(hydrate);
  const group = query.group === "pitching" ? "pitching" : "hitting";
  const season = Number(query.season ?? BENCH_SEASON);
  const people = personIds.map((id) => {
    let stats: unknown[] = [];
    switch (query.type) {
      case "season":
        stats = [
          {
            type: { displayName: "season" },
            group: { displayName: group },
            splits: [
              {
                season: String(season),
                stat: group === "pitching" ? seasonPitchingStat(pitcherCounts(id)) : seasonHittingStat(hitterCounts(id)),
              },
            ],
          },
        ];
        break;
      case "sabermetrics":
        stats = [
          {
            type: { displayName: "sabermetrics" },
            group: { displayName: group },
            splits: [{ season: String(season), stat: sabermetricStat(id, group) }],
          },
        ];
        break;
      case "statSplits":
        stats = [
          {
            type: { displayName: "statSplits" },
            group: { displayName: group },
            splits: [
              {
                season: String(season),
                stat:
                  group === "pitching"
                    ? splitPitchingStat(id, query.sitCodes === "h" ? 31 : 41)
                    : splitHittingStat(id, query.sitCodes === "vl" ? 51 : 61),
              },
            ],
          },
        ];
        break;
      case "vsPlayer": {
        const pitcherId = Number(query.opposingPlayerId ?? 0);
        stats = [
          {
            type: { displayName: "vsPlayerTotal" },
            group: { displayName: "hitting" },
            splits: [{ stat: vsPlayerStat(id, pitcherId) }],
          },
          {
            type: { displayName: "vsPlayer" },
            group: { displayName: "hitting" },
            splits: [
              { season: String(season), stat: vsPlayerStat(id, pitcherId) },
              { season: String(season - 1), stat: vsPlayerStat(id + 3, pitcherId) },
            ],
          },
        ];
        break;
      }
      case "gameLog":
        stats = [
          {
            type: { displayName: "gameLog" },
            group: { displayName: "pitching" },
            splits: gameLogSplits(id, season),
          },
        ];
        break;
      default:
        stats = [];
    }
    return { id, fullName: playerNameById(id), stats };
  });
  return JSON.stringify({ people });
}

/** `/api/v1/people/{id}` — the reader's pitch-hand lookup and person ref. */
export function personBody(id: number): string {
  return JSON.stringify({
    people: [
      {
        id,
        fullName: playerNameById(id),
        pitchHand: { code: id % 3 === 0 ? "L" : "R" },
        batSide: { code: "R" },
      },
    ],
  });
}

/**
 * Open-Meteo hourly forecast. `profile` decides the wind/temperature regime the
 * props scoring reads: "out-hot" blows straight out on a hot day (nudges HR/TB
 * leans over), "in-cold" blows in on a cold one (nudges them under), "calm" is
 * below the wind threshold so no nudge fires.
 *
 * `cfBearingDeg` is the park's home-plate-to-center-field bearing: the wind
 * direction is expressed relative to it, which is what `windRelativeToPlate`
 * turns back into an out/in/cross category.
 */
export function openMeteoBody(
  startDate: string,
  profile: "out-hot" | "in-cold" | "calm",
  cfBearingDeg: number,
): string {
  const times: string[] = [];
  const start = new Date(`${startDate}T00:00:00Z`);
  for (let i = 0; i < 48; i += 1) {
    const t = new Date(start.getTime() + i * 3600_000);
    times.push(t.toISOString().slice(0, 16));
  }
  // Wind "to" direction is windFrom + 180; blowing out means toward CF.
  const windFromDeg = profile === "out-hot" ? (cfBearingDeg + 180) % 360 : profile === "in-cold" ? cfBearingDeg : (cfBearingDeg + 90) % 360;
  const speed = profile === "out-hot" ? 12 : profile === "in-cold" ? 13 : 1;
  return JSON.stringify({
    latitude: 40,
    longitude: -75,
    elevation: 30,
    hourly: {
      time: times,
      temperature_2m: times.map((_, i) => (profile === "out-hot" ? 84 + (i % 5) : profile === "in-cold" ? 44 + (i % 3) : 70 + (i % 6))),
      relative_humidity_2m: times.map((_, i) => 45 + (i % 20)),
      wind_speed_10m: times.map(() => speed),
      wind_direction_10m: times.map(() => windFromDeg),
      wind_gusts_10m: times.map((_, i) => speed + 6 + (i % 9)),
      cloud_cover: times.map((_, i) => 20 + (i % 40)),
      precipitation_probability: times.map((_, i) => i % 30),
      weather_code: times.map(() => 1),
    },
  });
}
