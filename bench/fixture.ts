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
/** A winter date: the home page has no games, so it renders the offseason sections. */
export const OFFSEASON_DATE = "2026-01-15";

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
/** Pitchers whose props the app can resolve: the probable starter. */
export const PROP_PITCHERS_PER_TEAM = 1;
/**
 * Bullpen arms the provider also posts strikeout/outs props for. The app's
 * pitcher matching resolves only the probables, so these are parsed, matched
 * and then dropped — modelling them keeps the board the size a real one is,
 * and makes that waste visible in the cycle instead of invisible.
 */
export const PROP_RELIEVERS_PER_TEAM = 6;
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

/**
 * Pitchers who work out of the bullpen. Their season line is a relief line —
 * no starts — which matters because the prop evidence has to pick a
 * per-appearance basis for them rather than a per-start one.
 */
const RELIEVER_IDS = new Set<number>();
for (const game of GAMES) {
  for (const side of [game.away, game.home]) {
    for (const pitcher of side.pitchers.slice(PROP_PITCHERS_PER_TEAM)) RELIEVER_IDS.add(pitcher.id);
  }
}

export function isReliever(id: number): boolean {
  return RELIEVER_IDS.has(id);
}

/** The bullpen arms of a game — the players whose evidence is per appearance. */
export function relieverIds(game: BenchGame): number[] {
  return [game.away, game.home].flatMap((side) =>
    side.pitchers.slice(PROP_PITCHERS_PER_TEAM, PROP_PITCHERS_PER_TEAM + PROP_RELIEVERS_PER_TEAM).map((p) => p.id),
  );
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
  gamesPlayed: number;
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
  if (isReliever(id)) {
    const games = 45 + Math.floor(unit(id, 11) * 25);
    const ip = 45 + Math.round(unit(id, 12) * 30 * 3) / 3;
    const k9 = 8.5 + unit(id, 13) * 4;
    const k = Math.round((k9 * ip) / 9);
    const bb = Math.round(ip * (0.06 + unit(id, 14) * 0.06));
    const earnedRuns = Math.round(ip * (0.22 + unit(id, 15) * 0.26));
    return {
      gamesStarted: 0,
      gamesPlayed: games,
      ip,
      ipText: `${Math.floor(ip)}.${Math.round((ip - Math.floor(ip)) * 3)}`,
      k,
      bb,
      battersFaced: Math.round(ip * 4.2),
      earnedRuns,
      era: ((earnedRuns * 9) / ip).toFixed(2),
      k9,
      outsPerStart: 0,
    };
  }
  const gamesStarted = 18 + Math.floor(unit(id, 11) * 14);
  // Innings pitched, fractional as the provider reports them (e.g. 118.2 = 118 2/3).
  const ip = 95 + Math.round(unit(id, 12) * 85 * 3) / 3;
  const k9 = 7 + unit(id, 13) * 5;
  const k = Math.round((k9 * ip) / 9);
  const bb = Math.round(ip * (0.05 + unit(id, 14) * 0.06));
  const battersFaced = Math.round(ip * 4.15);
  const earnedRuns = Math.round(ip * (0.2 + unit(id, 15) * 0.24));
  const outsPerStart = (ip * 3) / gamesStarted;
  return {
    gamesStarted,
    gamesPlayed: gamesStarted + 3,
    ip,
    // The API's `inningsPitched` is whole innings plus a thirds digit, so the
    // value has to be encoded as innings — not as outs, which is a third of it.
    ipText: `${Math.floor(ip)}.${Math.round((ip - Math.floor(ip)) * 3)}`,
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
    // A reliever's strikeout line is per appearance, a starter's per start.
    const basis = p.gamesStarted > 0 ? p.outsPerStart / 3 : p.ip / p.gamesPlayed;
    return p.gamesStarted > 0
      ? halfLine((p.k9 * p.outsPerStart) / 27 / factor, 2.5, 9.5)
      : halfLine((p.k9 / 9) * basis / factor, 0.5, 2.5);
  }
  if (market === "pitcher_outs") {
    const p = pitcherCounts(id);
    const basis = p.gamesStarted > 0 ? p.outsPerStart : (p.ip * 3) / p.gamesPlayed;
    return p.gamesStarted > 0
      ? halfLine(basis / factor, 9.5, 20.5)
      : halfLine(basis / factor, 1.5, 4.5);
  }
  const c = hitterCounts(id);
  const perGame: Record<string, number> = {
    batter_hits: c.h / c.games,
    batter_total_bases: c.totalBases / c.games,
    batter_home_runs: c.hr / c.games,
  };
  const max = market === "batter_total_bases" ? 3.5 : 1.5;
  const min = market === "batter_home_runs" ? 0.5 : 0.5;
  return halfLine(perGame[market] / factor, min, max);
}

// --- Raw payload builders ----------------------------------------------------

export type PropMarketKey =
  | "pitcher_strikeouts"
  | "pitcher_outs"
  | "batter_hits"
  | "batter_total_bases"
  | "batter_home_runs";

export const MARKETS: readonly PropMarketKey[] = [
  "pitcher_strikeouts",
  "pitcher_outs",
  "batter_hits",
  "batter_total_bases",
  "batter_home_runs",
];

export const STAT_ID_BY_MARKET: Record<PropMarketKey, string> = {
  pitcher_strikeouts: "pitching_strikeouts",
  pitcher_outs: "pitching_outs",
  batter_hits: "batting_hits",
  batter_total_bases: "batting_totalBases",
  batter_home_runs: "batting_homeRuns",
};

export const BATTER_MARKETS: readonly PropMarketKey[] = [
  "batter_hits",
  "batter_total_bases",
  "batter_home_runs",
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
    for (const reliever of side.pitchers.slice(
      PROP_PITCHERS_PER_TEAM,
      PROP_PITCHERS_PER_TEAM + PROP_RELIEVERS_PER_TEAM,
    )) {
      for (const market of PITCHER_MARKETS) add(reliever, market);
    }
  }
  return pairs;
}

/**
 * Props the app resolves for one event: the provider's usable pairs minus the
 * bullpen arms, which the app's pitcher matching cannot attribute to a roster
 * player. The difference against {@link expectedProviderProps} is the coverage
 * the analysis currently drops.
 */
export function expectedMatchedProps(game: BenchGame): number {
  return propPairsForEvent(game).filter((pair) => pair.usable && isMatchable(game, pair)).length;
}

/** Every usable pair the provider posts for one event, whether the app keeps it or not. */
export function expectedProviderProps(game: BenchGame): number {
  return propPairsForEvent(game).filter((pair) => pair.usable).length;
}

/**
 * True when the app can attribute the pair: a prop hitter, a probable starter,
 * or a bullpen arm the feed lists.
 */
function isMatchable(game: BenchGame, pair: EventPropPair): boolean {
  const bullpenEnd = PROP_PITCHERS_PER_TEAM + PROP_RELIEVERS_PER_TEAM;
  for (const side of [game.away, game.home]) {
    if (side.hitters.slice(0, PROP_HITTERS_PER_TEAM).some((p) => p.id === pair.player.id)) return true;
    if (side.pitchers.slice(0, bullpenEnd).some((p) => p.id === pair.player.id)) return true;
  }
  return false;
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

/**
 * One book's block for an odd. The provider's OpenAPI spec (`ByBookmakerOdds`)
 * declares 13 fields; the app reads three of them (`odds`, `overUnder`,
 * `available`), and `includeOpenCloseOdds` governs six more. Modelling all of
 * them keeps the board the size a real one is, so asking the provider to omit
 * what the app does not read shows up as the saving it is.
 */
export interface SgoBookLine {
  bookmakerID?: string;
  odds?: string;
  overUnder?: string;
  spread?: string;
  available?: boolean;
  isMainLine?: boolean;
  lastUpdatedAt?: string;
  openOdds?: string;
  closeOdds?: string;
  openSpread?: string;
  closeSpread?: string;
  openOverUnder?: string;
  closeOverUnder?: string;
}

/** The six fields `includeOpenCloseOdds` controls. */
export const OPEN_CLOSE_FIELDS = [
  "openOdds", "closeOdds", "openSpread", "closeSpread", "openOverUnder", "closeOverUnder",
] as const;

export interface SgoOddFixture {
  oddID?: string;
  /** The other side's oddID, as the provider's `Odds` schema declares. */
  opposingOddID?: string;
  statID?: string;
  statEntityID?: string;
  playerID?: string;
  periodID?: string;
  betTypeID?: string;
  sideID?: string;
  byBookmaker?: Record<string, SgoBookLine>;
}

/** One SportsGameOdds event, shaped like the provider's v2 `/events` payload. */
/**
 * The event envelope. The provider's OpenAPI document declares thirteen fields
 * on an Event, twelve on a Team and ten on a Player; a fixture that models a
 * convenient subset understates the board and quietly flatters anything
 * measured against it, so all of them are present (with deterministic values).
 * `players[id].name` is kept alongside the declared `names` because the reader
 * uses the flat field.
 */
export interface SgoEventFixture {
  eventID: string;
  sportID: string;
  leagueID: string;
  type: string;
  activity: { count: number; score: number };
  manual: boolean;
  aliases: string[];
  info: { seasonWeek: string; venue: { name: string; countryName: string; countryCode: string; regionName: string; city: string } };
  results: Record<string, Record<string, { points: number }>>;
  teams: { away: SgoTeamEnvelope; home: SgoTeamEnvelope };
  status: { startsAt: string; started: boolean; completed: boolean };
  odds: Record<string, SgoOddFixture>;
  players?: Record<string, SgoPlayerEnvelope>;
}

export interface SgoTeamEnvelope {
  teamID: string;
  sportID: string;
  leagueID: string;
  names: { long: string; medium: string; short: string };
  logo: string;
  colors: string[];
  aliases: string[];
  lookups: { teamID: string; leagueID: string };
  standings: { wins: number; losses: number; rank: number };
  venue: { name: string; city: string };
  coach: string;
  owner: string;
}

export interface SgoPlayerEnvelope {
  name: string;
  playerID: string;
  sportID: string;
  leagueID: string;
  teamID: string;
  names: { long: string; medium: string; short: string };
  jerseyNumber: string;
  position: string;
  aliases: string[];
  lookups: { playerID: string; teamID: string };
  playerTeams: string[];
}

function sgoTeamEnvelope(team: BenchTeam): SgoTeamEnvelope {
  const slug = team.abbreviation.toUpperCase();
  return {
    teamID: `${slug}_MLB`,
    sportID: "BASEBALL",
    leagueID: "MLB",
    names: { long: team.name, medium: team.abbreviation, short: team.abbreviation },
    logo: `https://cdn.sportsgameodds.com/teams/${slug}.png`,
    colors: ["#0B1121", "#C8102E"],
    aliases: [`${team.name} (MLB)`, team.abbreviation],
    lookups: { teamID: `${slug}_MLB`, leagueID: "MLB" },
    standings: { wins: 51, losses: 39, rank: 2 },
    venue: { name: `${team.name} Ballpark`, city: team.name.split(" ").pop() ?? "City" },
    coach: "Bench Coach",
    owner: `${team.name} Ownership Group`,
  };
}

/** The team a prop-carrying player belongs to, for his event envelope. */
function teamOfPlayer(game: BenchGame, id: number): BenchTeam {
  for (const side of [game.away, game.home]) {
    if ([...side.hitters, ...side.pitchers].some((p) => p.id === id)) return side.team;
  }
  return game.home.team;
}

function sgoPlayerEnvelope(id: number, team: BenchTeam, name: string): SgoPlayerEnvelope {
  const slug = team.abbreviation.toUpperCase();
  return {
    name,
    playerID: sgoPlayerId(name),
    sportID: "BASEBALL",
    leagueID: "MLB",
    teamID: `${slug}_MLB`,
    names: { long: name, medium: name.split(" ").pop() ?? name, short: name.slice(0, 1) },
    jerseyNumber: String(1 + (id % 98)),
    position: id >= 900000 ? "Pitcher" : "Outfielder",
    aliases: [name.replace(" ", "_")],
    lookups: { playerID: sgoPlayerId(name), teamID: `${slug}_MLB` },
    playerTeams: [`${slug}_MLB`],
  };
}

/**
 * One SportsGameOdds event object (`oddfmt` filters handled by the caller).
 * `withPlayers` mirrors the provider sometimes omitting the player record, which
 * forces the `playerNameFromId` fallback on the reader side.
 */
export function sgoEvent(game: BenchGame, withPlayers: boolean): SgoEventFixture {
  const odds: Record<string, SgoOddFixture> = {};
  const players: Record<string, SgoPlayerEnvelope> = {};

  for (const { player, market, line } of propPairsForEvent(game)) {
    const statID = STAT_ID_BY_MARKET[market];
    const playerID = sgoPlayerId(player.fullName);
    if (withPlayers) players[playerID] = sgoPlayerEnvelope(player.id, teamOfPlayer(game, player.id), player.fullName);

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
        const lineText = Math.max(0.5, line + drift).toFixed(1);
        byBookmaker[book] = {
          bookmakerID: book,
          odds: String(price),
          overUnder: lineText,
          spread: String(drift),
          available: !(book === "fanatics" && b % 3 === 0),
          isMainLine: true,
          lastUpdatedAt: `${BENCH_DATE}T18:00:00Z`,
          openOdds: String(price - 5),
          closeOdds: String(price + 5),
          openSpread: String(drift),
          closeSpread: String(drift),
          openOverUnder: lineText,
          closeOverUnder: lineText,
        };
      }
      odds[oddID] = {
        oddID,
        opposingOddID: `${statID}-${playerID}-game-ou-${sideID === "over" ? "under" : "over"}`,
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
        opposingOddID: `batting_hits-${playerID}-game-ou-${sideID === "over" ? "under" : "over"}`,
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
    players[playerID] = sgoPlayerEnvelope(phantomId, teamOfPlayer(game, phantomId), name);
  });

  const event: SgoEventFixture = {
    eventID: `SGO_${game.gamePk}`,
    sportID: "BASEBALL",
    leagueID: "MLB",
    type: "match",
    activity: { count: 0, score: 0 },
    manual: false,
    aliases: [`${game.away.team.name} at ${game.home.team.name}`],
    info: {
      seasonWeek: "regular",
      venue: {
        name: game.venue,
        countryName: "United States",
        countryCode: "US",
        regionName: game.city,
        city: game.city,
      },
    },
    // An upcoming game has nothing to report yet; the schema's shape is a map of
    // stat denominators per period, and the reader ignores it either way.
    results: {},
    teams: { away: sgoTeamEnvelope(game.away.team), home: sgoTeamEnvelope(game.home.team) },
    status: { startsAt: game.startTimeISO, started: false, completed: false },
    odds,
  };
  if (withPlayers) event.players = players;
  return event;
}

/**
 * Live-feed body for one game, shaped like the real `feed/live` response a
 * Preview game returns (measured: ~180 KB, 52 `gameData.players` entries with
 * full metadata and a boxscore carrying every player's season stats). The
 * benchmark fetches and shapes it so the props page's own upstream read is part
 * of the measured cycle instead of being handed to it for free.
 */
export function liveFeedBody(game: BenchGame): string {
  const handOf = (id: number) => (id % 3 === 0 ? "L" : "R");
  const personMeta = (player: BenchPlayer, index: number) => ({
    id: player.id,
    fullName: player.fullName,
    link: `/api/v1/people/${player.id}`,
    firstName: player.fullName.split(" ")[0],
    lastName: player.fullName.split(" ").slice(-1)[0],
    primaryNumber: String((index % 60) + 1),
    birthDate: `199${index % 10}-0${(index % 9) + 1}-1${index % 9}`,
    currentAge: 22 + (index % 14),
    birthCity: "Springfield",
    birthStateProvince: "MO",
    birthCountry: "USA",
    height: `${5 + (index % 2)}' ${8 + (index % 4)}"`,
    weight: 180 + (index % 60),
    active: true,
    primaryPosition: { code: "1", name: "Pitcher", type: "Pitcher", abbreviation: "P" },
    useName: player.fullName.split(" ")[0],
    useLastName: player.fullName.split(" ").slice(-1)[0],
    boxscoreName: player.fullName.split(" ").slice(-1)[0],
    gender: "M",
    isPlayer: true,
    isVerified: true,
    batSide: { code: handOf(player.id + 1), description: "Switch" },
    pitchHand: { code: handOf(player.id), description: handOf(player.id) === "L" ? "Left" : "Right" },
    nameFirstLast: player.fullName,
    nameSlug: player.fullName.toLowerCase().replace(/[^a-z]+/g, "-"),
    nickName: player.fullName.split(" ")[0],
    draftYear: 2012 + (index % 10),
    mlbDebutDate: "2018-04-01",
    lastPlayedDate: "2026-10-01",
    pronunciation: "",
  });

  const boxSide = (side: BenchSide) => {
    const players: Record<string, unknown> = {};
    side.hitters.forEach((hitter, index) => {
      const counts = hitterCounts(hitter.id);
      players[`ID${hitter.id}`] = {
        person: { id: hitter.id, fullName: hitter.fullName, link: `/api/v1/people/${hitter.id}` },
        jerseyNumber: String(index + 1),
        position: { code: "9", name: "Outfielder", type: "Outfielder", abbreviation: "OF" },
        status: { code: "A", description: "Active" },
        parentTeamId: side.team.id,
        battingOrder: "100",
        gameStatus: { isCurrentBatter: false, isCurrentPitcher: false, isOnBench: true, isSubstitute: false },
        stats: {
          batting: {
            gamesPlayed: counts.games, plateAppearances: counts.pa, atBats: counts.ab, runs: Math.round(counts.games * 0.5),
            hits: counts.h, doubles: 20, triples: 1, homeRuns: counts.hr, rbi: counts.rbi, baseOnBalls: counts.bb,
            strikeOuts: Math.round(counts.pa * 0.22), stolenBases: 4, avg: counts.avg, obp: counts.obp, slg: counts.slg,
          },
          pitching: {},
        },
        seasonStats: {
          batting: {
            gamesPlayed: counts.games, plateAppearances: counts.pa, atBats: counts.ab, runs: Math.round(counts.games * 0.5),
            hits: counts.h, doubles: 20, triples: 1, homeRuns: counts.hr, rbi: counts.rbi, baseOnBalls: counts.bb,
            intentionalWalks: 2, strikeOuts: Math.round(counts.pa * 0.22), hitByPitch: 5, sacBunts: 1, sacFlies: 3,
            groundIntoDoublePlay: 9, groundOuts: 120, airOuts: 130, stolenBases: 4, caughtStealing: 2, stolenBasePercentage: ".667",
            totalBases: counts.totalBases, avg: counts.avg, obp: counts.obp, slg: counts.slg, ops: ".812", babip: counts.babip,
            atBatsPerHomeRun: "18.4", groundOutsToAirouts: "0.92", caughtStealingPercentage: ".500",
          },
          pitching: {},
          fielding: {
            gamesStarted: counts.games, assists: 40, putOuts: 90, errors: 2, chances: 132, fielding: ".985",
            caughtStealing: 3, passedBall: 1, stolenBases: 12, caughtStealingPercentage: ".200",
          },
        },
      };
    });
    side.pitchers.forEach((pitcher, index) => {
      const counts = pitcherCounts(pitcher.id);
      const pitching = {
        gamesPlayed: counts.gamesStarted + 4, gamesStarted: counts.gamesStarted, inningsPitched: counts.ipText,
        wins: 8, losses: 5, earnedRuns: counts.earnedRuns, runs: counts.earnedRuns + 3, hits: Math.round(counts.ip * 0.9),
        baseOnBalls: counts.bb, strikeOuts: counts.k, battersFaced: counts.battersFaced, era: counts.era, whip: "1.12", avg: ".240",
      };
      players[`ID${pitcher.id}`] = {
        person: { id: pitcher.id, fullName: pitcher.fullName, link: `/api/v1/people/${pitcher.id}` },
        jerseyNumber: String(index + 30),
        position: { code: "1", name: "Pitcher", type: "Pitcher", abbreviation: "P" },
        status: { code: "A", description: "Active" },
        parentTeamId: side.team.id,
        gameStatus: { isCurrentBatter: false, isCurrentPitcher: index === 0, isOnBench: index !== 0, isSubstitute: false },
        stats: { batting: {}, pitching },
        seasonStats: {
          batting: { gamesPlayed: 4, plateAppearances: 7, atBats: 6, runs: 0, hits: 1, doubles: 0, triples: 0, homeRuns: 0, rbi: 1, baseOnBalls: 1, strikeOuts: 3, avg: ".167", obp: ".286", slg: ".167", ops: ".453" },
          pitching: {
            ...pitching,
            completeGames: 1, shutouts: 0, saves: 0, blownSaves: 1, holds: 2, hitBatsmen: 3, wildPitches: 2, balks: 0,
            homeRuns: 14, atBats: Math.round(counts.ip * 3.8), groundOuts: 140, airOuts: 120, groundOutsToAirouts: "1.17",
            strikeoutsPer9Inn: (counts.k9).toFixed(2), walksPer9Inn: "2.41", hitsPer9Inn: "8.10", homeRunsPer9: "1.02",
            strikeoutWalkRatio: "3.62", runsScoredPer9: "4.12", inheritedRunners: 0, inheritedRunnersScored: 0, pickoffs: 1,
          },
          fielding: { gamesStarted: counts.gamesStarted, assists: 14, putOuts: 8, errors: 1, chances: 23, fielding: ".957" },
        },
      };
    });
    return {
      team: { id: side.team.id, name: side.team.name, abbreviation: side.team.abbreviation },
      players,
      // A Preview game has no posted order yet, which is what sends the prop
      // board down its roster-proxy lineup path. The bullpen is listed: those
      // are the arms whose props the board can attribute.
      batters: [],
      pitchers: [],
      bullpen: side.pitchers
        .slice(PROP_PITCHERS_PER_TEAM, PROP_PITCHERS_PER_TEAM + PROP_RELIEVERS_PER_TEAM)
        .map((pitcher) => pitcher.id),
      battingOrder: [],
      info: [],
      note: [],
    };
  };

  const feedPlayers: Record<string, unknown> = {};
  let index = 0;
  for (const side of [game.away, game.home]) {
    for (const player of [...side.hitters, ...side.pitchers]) {
      feedPlayers[`ID${player.id}`] = personMeta(player, index);
      index += 1;
    }
  }

  return JSON.stringify({
    copyright: "Copyright 2026 MLB Advanced Media, L.P.",
    gamePk: game.gamePk,
    link: `/api/v1.1/game/${game.gamePk}/feed/live`,
    metaData: { wait: 10, timeStamp: "20261011_190000" },
    gameData: {
      game: { pk: game.gamePk, type: "R", season: String(BENCH_SEASON), gameNumber: 1 },
      status: { abstractGameState: "Preview", codedGameState: "S", detailedState: "Scheduled", statusCode: "S" },
      datetime: { dateTime: game.startTimeISO, dayNight: "night", timeZone: { id: "America/New_York" } },
      venue: { id: game.venueId, name: game.venue, link: `/api/v1/venues/${game.venueId}`, location: { city: game.city } },
      teams: {
        away: { id: game.away.team.id, name: game.away.team.name, abbreviation: game.away.team.abbreviation, link: `/api/v1/teams/${game.away.team.id}` },
        home: { id: game.home.team.id, name: game.home.team.name, abbreviation: game.home.team.abbreviation, link: `/api/v1/teams/${game.home.team.id}` },
      },
      players: feedPlayers,
      probablePitchers: {
        away: { id: game.away.probable.id, fullName: game.away.probable.fullName, link: `/api/v1/people/${game.away.probable.id}` },
        home: { id: game.home.probable.id, fullName: game.home.probable.fullName, link: `/api/v1/people/${game.home.probable.id}` },
      },
      gameInfo: { attendance: 0, firstPitch: "", gameDurationMinutes: 0, delayDurationMinutes: 0 },
      flags: { noHitter: false, perfectGame: false, awayTeamNoHitter: false, homeTeamNoHitter: false },
      alerts: [],
      review: { hasChallenges: false, away: { used: 0, remaining: 1 }, home: { used: 0, remaining: 1 } },
      absChallenges: { hasChallenges: false, away: { used: 0, remaining: 2 }, home: { used: 0, remaining: 2 } },
      moundVisits: { away: { used: 0, remaining: 5 }, home: { used: 0, remaining: 5 } },
      officialVenue: { id: game.venueId, name: game.venue, link: `/api/v1/venues/${game.venueId}` },
      weather: { condition: "Clear", temp: "72", wind: "5 mph, L To R" },
    },
    liveData: {
      plays: { allPlays: [], currentPlay: {}, scoringPlays: [], playsByInning: [] },
      linescore: { currentInning: 1, currentInningOrdinal: "1st", inningState: "Top", isTopInning: true, scheduledInnings: 9, innings: [], teams: { away: {}, home: {} } },
      boxscore: {
        teams: { away: boxSide(game.away), home: boxSide(game.home) },
        officials: [
          { official: { id: 427044, fullName: "Alan Porter", link: "/api/v1/people/427044" }, officialType: "Home Plate" },
          { official: { id: 427045, fullName: "Mark Carlson", link: "/api/v1/people/427045" }, officialType: "First Base" },
        ],
        info: [
          { label: "Balls", value: "0" },
          { label: "Strikes", value: "0" },
          { label: "Weather", value: "72 degrees, Clear." },
          { label: "Wind", value: "5 mph, L To R." },
          { label: "First pitch", value: "Scheduled." },
        ],
        pitchingNotes: [],
      },
      decisions: {},
      leaders: { hitDistance: [], hitSpeed: [], pitchSpeed: [], exitVelocity: [] },
    },
  });
}

/**
 * The team reference a *schedule* row carries. The API's `team` hydrate under
 * the app's field list returns id, name and abbreviation only — no division,
 * league, sport or spring fields — and the local prune model keeps those
 * extras wherever an `id` or `name` leaf appears, which made the served slate
 * twice the size of a real one.
 */
function scheduleTeamRef(team: BenchTeam): Record<string, unknown> {
  return { id: team.id, name: team.name, abbreviation: team.abbreviation };
}

function scheduleGame(game: BenchGame, date: string): Record<string, unknown> {
  return {
    gamePk: game.gamePk,
    link: `/api/v1.1/game/${game.gamePk}/feed/live`,
    gameType: "R",
    season: String(BENCH_SEASON),
    gameDate: game.startTimeISO,
    officialDate: date,
    status: {
      abstractGameState: "Preview",
      codedGameState: "S",
      detailedState: "Scheduled",
      statusCode: "S",
      startTimeTBD: false,
      abstractGameCode: "P",
    },
    teams: {
      away: {
        team: scheduleTeamRef(game.away.team),
        leagueRecord: { wins: 48, losses: 42, pct: ".533" },
        probablePitcher: {
          id: game.away.probable.id,
          fullName: game.away.probable.fullName,
          link: `/api/v1/people/${game.away.probable.id}`,
        },
      },
      home: {
        team: scheduleTeamRef(game.home.team),
        leagueRecord: { wins: 51, losses: 39, pct: ".567" },
        probablePitcher: {
          id: game.home.probable.id,
          fullName: game.home.probable.fullName,
          link: `/api/v1/people/${game.home.probable.id}`,
        },
      },
    },
    venue: {
      id: game.venueId,
      name: game.venue,
      link: `/api/v1/venues/${game.venueId}`,
      location: { city: game.city, state: "", country: "USA" },
      timeZone: { id: "America/New_York", offset: -4, tz: "EDT" },
      fieldInfo: { capacity: 40000, turfType: "Grass", roofType: "Open", leftLine: 330, center: 400, rightLine: 330 },
    },
    content: { link: `/api/v1/game/${game.gamePk}/content` },
    isTie: false,
    gameNumber: 1,
    publicFacing: true,
    doubleHeader: "N",
    gamedayType: "P",
    tiebreaker: "N",
    calendarEventID: `14-${game.gamePk}-2026`,
    seasonDisplay: "2026",
    dayNight: "night",
    scheduledInnings: 9,
    gamesInSeries: 3,
    seriesGameNumber: 1,
    seriesDescription: "Regular Season",
    recordSource: "unknown",
    ifNecessary: "N",
    ifNecessaryDescription: "Normal Game",
    description: "Preview",
    linescore: { scheduledInnings: 9, innings: [], teams: { away: {}, home: {} } },
    decisions: {},
  };
}

export function scheduleBody(games: BenchGame[], date: string): string {
  const raw = games.map((game) => scheduleGame(game, date));
  return JSON.stringify({
    copyright: "Copyright 2026 MLB Advanced Media, L.P.",
    totalItems: raw.length,
    totalEvents: 0,
    totalGames: raw.length,
    totalGamesInProgress: 0,
    dates: [{ date, totalItems: raw.length, totalEvents: 0, totalGames: raw.length, totalGamesInProgress: 0, games: raw }],
  });
}

/**
 * The two teams' completed regular-season meetings, as `getHeadToHead` reads
 * them: `gamePk`, `gameType`, a Final status and both sides' scores and
 * winners. The reader keeps only decided meetings, so a slate of Preview games
 * would leave the series empty.
 */
export function seasonSeriesBody(
  teamAId: number,
  teamBId: number,
  season: number,
  round?: string,
): string {
  const meetings = 6;
  const raw = [];
  // The body's own team refs only have to carry the ids `tallySeries` matches
  // on; the display names come from the caller's `TeamRef`s.
  const ref = (id: number) => ({ id, name: `Bench Team ${id}`, abbreviation: "BEN" });
  const [first, second] = [teamAId, teamBId];
  for (let i = 0; i < meetings; i += 1) {
    // Alternate the venue, as a real season series does.
    const away = ref(i % 2 === 0 ? first : second);
    const home = ref(i % 2 === 0 ? second : first);
    const awayScore = 2 + (hash32(first * 31 + i * 17) % 7);
    const homeScore = 1 + (hash32(second * 71 + i * 29 + 5) % 7);
    const month = 4 + i; // April through September
    const date = `${season}-${String(month).padStart(2, "0")}-1${i % 9}`;
    raw.push({
      gamePk: 700000 + (first % 1000) + i,
      gameType: "R",
      season: String(season),
      gameDate: `${date}T23:05:00Z`,
      officialDate: date,
      status: { abstractGameState: "Final", detailedState: "Final" },
      teams: {
        away: {
          team: away,
          leagueRecord: { wins: 48, losses: 42, pct: ".533" },
          score: awayScore,
          isWinner: awayScore > homeScore,
        },
        home: {
          team: home,
          leagueRecord: { wins: 51, losses: 39, pct: ".567" },
          score: homeScore,
          isWinner: homeScore > awayScore,
        },
      },
    });
  }
  if (round) {
    // The round's games so far, as the same query returns them for a
    // postseason matchup.
    const awayScore = 3 + (hash32(first * 13 + 7) % 5);
    const homeScore = 2 + (hash32(second * 17 + 11) % 5);
    const date = `${season}-10-0${1 + (first % 6)}`;
    raw.push({
      gamePk: 800000 + (first % 1000),
      gameType: round,
      season: String(season),
      gameDate: `${date}T23:05:00Z`,
      officialDate: date,
      status: { abstractGameState: "Final", detailedState: "Final" },
      teams: {
        away: {
          team: ref(first),
          leagueRecord: { wins: 48, losses: 42, pct: ".533" },
          score: awayScore,
          isWinner: awayScore > homeScore,
        },
        home: {
          team: ref(second),
          leagueRecord: { wins: 51, losses: 39, pct: ".567" },
          score: homeScore,
          isWinner: homeScore > awayScore,
        },
      },
    });
  }
  return JSON.stringify({ dates: raw.map((g) => ({ date: g.officialDate, games: [g] })) });
}

/**
 * Active-roster response, hydrated with season hitting stats — what
 * `getRosterWithSeasonStats` reads (it drops pitchers, sorts by PA).
 */
export function rosterBody(side: BenchSide, season: number, hydrate: boolean): string {
  // A roster entry's person carries id, fullName and the hydrated stats — not
  // the feed's `batSide`/`pitchHand`, and not a `group` beside `type`. The
  // entry itself has no `status` and its position has no `code`.
  const rosterPerson = (id: number, stats: unknown[]) => ({ id, fullName: playerNameById(id), stats });
  const entries: unknown[] = [];
  side.hitters.forEach((player, i) => {
    const counts = hitterCounts(player.id);
    const pa = 520 - i * 37 - (side.team.id % 3) * 11;
    entries.push({
      person: rosterPerson(
        player.id,
        hydrate
          ? [
              {
                type: { displayName: "season" },
                exemptions: [],
                splits: [splitEnvelope(season, seasonHittingStat({ ...counts, pa }))],
              },
            ]
          : [],
      ),
      jerseyNumber: String(i + 1),
      position: { name: "Outfielder", type: "Outfielder", abbreviation: "OF" },
      parentTeamId: side.team.id,
    });
  });
  side.pitchers.forEach((player, i) => {
    const counts = pitcherCounts(player.id);
    entries.push({
      person: rosterPerson(
        player.id,
        hydrate
          ? [
              {
                type: { displayName: "season" },
                exemptions: [],
                splits: [splitEnvelope(season, seasonPitchingStat(counts))],
              },
            ]
          : [],
      ),
      jerseyNumber: String(i + 30),
      position: { name: "Pitcher", type: "Pitcher", abbreviation: i === 0 ? "SP" : "RP" },
      parentTeamId: side.team.id,
      role: { code: i === 0 ? "SP" : "RP", name: i === 0 ? "Starter" : "Relief" },
    });
  });
  return JSON.stringify({ roster: entries, link: `/api/v1/teams/${side.team.id}/roster` });
}

function seasonHittingStat(counts: HitterCounts): Record<string, unknown> {
  // Field set mirrors a real response (34 fields; the readers use ten of them).
  return {
    age: 27,
    gamesPlayed: counts.games,
    plateAppearances: counts.pa,
    atBats: counts.ab,
    runs: Math.round(counts.games * 0.55),
    hits: counts.h,
    doubles: Math.round(counts.h * 0.18),
    triples: 1,
    homeRuns: counts.hr,
    rbi: counts.rbi,
    baseOnBalls: counts.bb,
    intentionalWalks: 2,
    strikeOuts: Math.round(counts.pa * 0.22),
    hitByPitch: 4,
    sacBunts: 1,
    sacFlies: 3,
    groundIntoDoublePlay: 9,
    groundOuts: Math.round(counts.ab * 0.42),
    airOuts: Math.round(counts.ab * 0.38),
    totalBases: counts.totalBases,
    leftOnBase: Math.round(counts.pa * 0.24),
    numberOfPitches: Math.round(counts.pa * 3.9),
    avg: counts.avg,
    obp: counts.obp,
    slg: counts.slg,
    ops: (Number(counts.obp) + Number(counts.slg)).toFixed(3).replace(/^0/, ""),
    babip: counts.babip,
    stolenBases: 5,
    caughtStealing: 2,
    stolenBasePercentage: ".714",
    caughtStealingPercentage: ".286",
    groundOutsToAirouts: "1.11",
    atBatsPerHomeRun: "21.4",
    catchersInterference: 0,
  };
}

function seasonPitchingStat(counts: PitcherCounts): Record<string, unknown> {
  return {
    age: 29,
    gamesPlayed: counts.gamesPlayed,
    gamesStarted: counts.gamesStarted,
    wins: 9,
    losses: 7,
    completeGames: 1,
    shutouts: 0,
    saves: 0,
    holds: 3,
    blownSaves: 2,
    inningsPitched: counts.ipText,
    strikeOuts: counts.k,
    baseOnBalls: counts.bb,
    battersFaced: counts.battersFaced,
    runs: counts.earnedRuns + 3,
    earnedRuns: counts.earnedRuns,
    homeRuns: 15,
    hitBatsmen: 3,
    wildPitches: 2,
    balks: 0,
    pickoffs: 1,
    totalBases: Math.round(counts.ip * 1.3),
    groundOuts: Math.round(counts.battersFaced * 0.35),
    airOuts: Math.round(counts.battersFaced * 0.3),
    leftOnBase: Math.round(counts.battersFaced * 0.2),
    numberOfPitches: Math.round(counts.ip * 15.5),
    inheritedRunners: 0,
    inheritedRunnersScored: 0,
    era: counts.era,
    whip: "1.14",
    avg: ".238",
    strikeoutsPer9Inn: counts.k9.toFixed(2),
    walksPer9Inn: "2.41",
    hitsPer9Inn: "8.10",
    homeRunsPer9: "1.02",
    strikeoutWalkRatio: "3.62",
    runsScoredPer9: "4.12",
    groundOutsToAirouts: "1.17",
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
  // A starter works every fourth or fifth day, so a month holds about five
  // outings; a reliever appears every few days. Modelling only the starter's
  // cadence left relievers with no recent form at all.
  const reliever = counts.gamesStarted === 0;
  const daysAgo = reliever ? [1, 3, 5, 8, 11, 14, 18, 22, 26, 29] : [4, 9, 17, 24, 30];
  const splits = daysAgo.map((days, i) => {
    const date = new Date(`${BENCH_DATE}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - days);
    return {
      date: date.toISOString().slice(0, 10),
      season: String(season),
      stat: reliever
        ? {
            inningsPitched: `${hash32(id + i * 23) % 3}.${hash32(id + i * 3) % 3}`,
            earnedRuns: hash32(id + i * 5) % 2,
            battersFaced: 3 + (hash32(id + i * 7) % 5),
            baseOnBalls: hash32(id + i * 11) % 2,
            strikeOuts: hash32(id + i * 13) % 3,
            gamesStarted: 0,
            numberOfPitches: 12 + (hash32(id + i * 17) % 18),
          }
        : {
            inningsPitched: `${5 + (hash32(id + i) % 3)}.${hash32(id + i * 3) % 3}`,
            earnedRuns: hash32(id + i * 5) % 5,
            battersFaced: 22 + (hash32(id + i * 7) % 8),
            baseOnBalls: hash32(id + i * 11) % 4,
            strikeOuts: 3 + (hash32(id + i * 13) % 8),
            gamesStarted: 1,
            numberOfPitches: 78 + (hash32(id + i * 17) % 30),
          },
    };
  });
  return splits.filter((_, i) => counts.gamesPlayed > 0 && i < daysAgo.length);
}

/**
 * The envelope a real `splits[]` entry carries around its stat block (player,
 * team, league, sport, game type). The readers take `splits[0].stat`; the rest
 * is the bulk a real response pays for.
 */
/**
 * One split. The API returns `season`, `stat`, `gameType` and `isHome` for a
 * hydrated stat group; it does *not* embed team, player, league and sport
 * objects, which an earlier version of this fixture carried and the local prune
 * model then kept. Nothing reads them.
 */
function splitEnvelope(season: number, stat: Record<string, unknown>): Record<string, unknown> {
  return {
    season: String(season),
    stat,
    gameType: "R",
    isHome: true,
  };
}

/** The metadata a real person record carries (38 fields; the readers use two). */
function personEnvelope(id: number, stats: unknown[]): Record<string, unknown> {
  const name = playerNameById(id);
  const [first, ...rest] = name.split(" ");
  const last = rest.join(" ") || first;
  return {
    id,
    fullName: name,
    link: `/api/v1/people/${id}`,
    firstName: first,
    lastName: last,
    primaryNumber: String((id % 60) + 1),
    birthDate: `199${id % 10}-0${(id % 9) + 1}-1${id % 9}`,
    currentAge: 22 + (id % 14),
    birthCity: "Springfield",
    birthStateProvince: "MO",
    birthCountry: "USA",
    height: `${5 + (id % 2)}' ${8 + (id % 4)}"`,
    weight: 180 + (id % 60),
    active: true,

    useName: first,
    useLastName: last,
    middleName: "",
    boxscoreName: last,
    nickName: first,
    gender: "M",
    isPlayer: true,
    isVerified: true,
    draftYear: 2012 + (id % 10),
    pronunciation: "",
    mlbDebutDate: "2018-04-01",
    batSide: { code: "R", description: "Right" },
    pitchHand: { code: id % 3 === 0 ? "L" : "R", description: "Right" },
    nameFirstLast: name,
    nameSlug: name.toLowerCase().replace(/[^a-z]+/g, "-"),
    firstLastName: `${first[0]}. ${last}`,
    lastFirstName: `${last}, ${first}`,
    lastInitName: `${last[0]}. ${first}`,
    initLastName: `${first[0]}. ${last}`,
    fullFMLName: name,
    fullLFMName: `${last} ${first}`,
    strikeZoneTop: 3.4,
    strikeZoneBottom: 1.6,
    stats,
  };
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
            exemptions: [],
            splits: [
              splitEnvelope(season, group === "pitching" ? seasonPitchingStat(pitcherCounts(id)) : seasonHittingStat(hitterCounts(id))),
            ],
          },
        ];
        break;
      case "sabermetrics":
        stats = [
          {
            type: { displayName: "sabermetrics" },
            group: { displayName: group },
            splits: [splitEnvelope(season, sabermetricStat(id, group))],
          },
        ];
        break;
      case "statSplits":
        stats = [
          {
            type: { displayName: "statSplits" },
            group: { displayName: group },
            splits: [
              splitEnvelope(season, group === "pitching"
                  ? splitPitchingStat(id, query.sitCodes === "h" ? 31 : 41)
                  : splitHittingStat(id, query.sitCodes === "vl" ? 51 : 61),
              ),
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
              splitEnvelope(season, vsPlayerStat(id, pitcherId)),
              splitEnvelope(season - 1, vsPlayerStat(id + 3, pitcherId)),
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
    return personEnvelope(id, stats);
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
