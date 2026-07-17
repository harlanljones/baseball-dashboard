/** Domain types — the shapes our components consume, mapped from raw API JSON. */

/** Coarse game state derived from `status.abstractGameState`. */
export type GameState = "Preview" | "Live" | "Final" | "Other";

export interface TeamRef {
  id: number;
  name: string;
  abbreviation?: string;
}

export interface PlayerRef {
  id: number;
  fullName: string;
}

export interface LeagueRecord {
  wins: number;
  losses: number;
  pct: string;
}

/** Runs / hits / errors for one team in a linescore (inning or total). */
export interface RunsHitsErrors {
  runs?: number;
  hits?: number;
  errors?: number;
  leftOnBase?: number;
}

// ---------------------------------------------------------------------------
// Schedule / scoreboard
// ---------------------------------------------------------------------------

export interface ScheduleTeamSide {
  team: TeamRef;
  score?: number;
  record?: LeagueRecord;
  probablePitcher?: PlayerRef;
  isWinner?: boolean;
}

export interface ScheduleGame {
  gamePk: number;
  gameDate: string; // ISO timestamp
  state: GameState;
  /** Human-facing status, e.g. "Final", "Postponed", "Warmup", "7:05 PM". */
  detailedState: string;
  /** Ballpark name, e.g. "PNC Park". */
  venue?: string;
  /** Ballpark's city, e.g. "Pittsburgh". */
  venueCity?: string;
  away: ScheduleTeamSide;
  home: ScheduleTeamSide;
  inning?: {
    current?: number;
    ordinal?: string;
    state?: string; // "Top" / "Bottom" / "Middle" / "End"
    isTop?: boolean;
  };
}

export interface ScheduleDay {
  date: string; // YYYY-MM-DD
  games: ScheduleGame[];
  /** True if any game is currently in progress — gates the live auto-refresh. */
  hasLiveGame: boolean;
}

/** One completed/scheduled meeting in a season series. */
export interface SeriesMeeting {
  gamePk: number;
  date: string;
  state: GameState;
  away: { team: TeamRef; score?: number };
  home: { team: TeamRef; score?: number };
}

export interface HeadToHead {
  teamA: TeamRef;
  teamB: TeamRef;
  /** Wins for teamA / teamB across completed meetings. */
  aWins: number;
  bWins: number;
  meetings: SeriesMeeting[];
}

// ---------------------------------------------------------------------------
// Game feed (v1.1)
// ---------------------------------------------------------------------------

export interface InningLine {
  num: number;
  ordinal: string;
  home: RunsHitsErrors;
  away: RunsHitsErrors;
}

export interface Linescore {
  innings: InningLine[];
  home: RunsHitsErrors;
  away: RunsHitsErrors;
  scheduledInnings: number;
}

export interface BoxscoreBatter {
  id: number;
  name: string;
  position: string;
  /** Batting-order code (e.g. 100, 101 for a pinch hitter); starters end in 00. */
  battingOrder: number;
  ab: number;
  r: number;
  h: number;
  rbi: number;
  bb: number;
  k: number;
  avg: string;
}

export interface BoxscorePitcher {
  id: number;
  name: string;
  ip: string;
  h: number;
  r: number;
  er: number;
  bb: number;
  k: number;
  era: string;
}

/**
 * A bullpen arm with season pitching stats. `ip`/`era`/`fip`/`k` come from a
 * per-pitcher stats lookup ({@link getBullpenSeasonPitching}), not the feed's
 * embedded `seasonStats` — that field is only reliably populated for probable
 * starters while a game is in `Preview` state.
 */
export interface BullpenPitcher {
  id: number;
  name: string;
  ip: string;
  era?: string;
  fip?: number;
  k: number;
  /** Pitches thrown yesterday. Undefined if the workload lookup failed for this pitcher. */
  pitchesYesterday?: number;
  /** Pitches thrown over the trailing 3 days (not including game day). */
  pitchesLast3?: number;
}

export interface TeamBoxscore {
  team: TeamRef;
  batters: BoxscoreBatter[];
  pitchers: BoxscorePitcher[];
  /** Pitchers in the bullpen (i.e. who have not appeared in this game). */
  bullpen: BullpenPitcher[];
  /** Player ids of the nine starting batters, in order. */
  battingOrderIds: number[];
  /** Player ids of pitchers used, in order (index 0 = starter). */
  pitcherIds: number[];
}

export interface GameFeed {
  gamePk: number;
  state: GameState;
  detailedState: string;
  startTime: string; // ISO
  /** Ballpark name, e.g. "PNC Park". */
  venue?: string;
  /** Ballpark's city, e.g. "Pittsburgh". */
  venueCity?: string;
  /** MLB Stats API venue id — keys src/lib/weather's ballpark table. */
  venueId?: number;
  /** MLB's own gametime weather snapshot (present once a game is close to/at first pitch). */
  weather?: { condition?: string; tempF?: string; wind?: string };
  away: { team: TeamRef; score?: number };
  home: { team: TeamRef; score?: number };
  linescore: Linescore;
  boxscore: { away: TeamBoxscore; home: TeamBoxscore };
  probablePitchers: { away?: PlayerRef; home?: PlayerRef };
  decisions?: { winner?: PlayerRef; loser?: PlayerRef; save?: PlayerRef };
  /** Convenience lookup: player id -> full name, spanning both teams. */
  playerNames: Record<number, string>;
}

// ---------------------------------------------------------------------------
// Sabermetrics + batter-vs-pitcher
// ---------------------------------------------------------------------------

export interface SaberHitting {
  woba?: number;
  wrcPlus?: number;
  war?: number;
  babip?: string;
  pa?: number;           // Plate appearances
  bbPct?: string;        // Walk rate (e.g. "8.5%")
  kPct?: string;         // Strikeout rate (e.g. "12.3%")
  xwoba?: number;        // Expected wOBA (may not be available in all API responses)
}

export interface SaberPitching {
  war?: number;
  fip?: number;
  xfip?: number;
  eraMinus?: number;
  ip?: string;           // Innings pitched (e.g. "123.1")
  era?: string;          // Earned run average (e.g. "3.45")
  bbPct?: string;        // Walk rate (e.g. "8.5%")
  kPct?: string;         // Strikeout rate (e.g. "12.3%")
  kMinusBbPct?: number;  // K% - BB% (raw decimal for sorting)
}

export interface VsPlayerLine {
  batter: PlayerRef;
  pitcher: PlayerRef;
  /** False when the pair has never faced each other (an em-dash row, not error). */
  hasHistory: boolean;
  pa: number;
  h: number;
  hr: number;
  bb: number;
  k: number;
  avg: string;
  obp: string;
  slg: string;
}

/** One season's line in a batter's season-by-season history against one pitcher. */
export interface VsPlayerSeasonLine extends VsPlayerLine {
  season: number;
}

/**
 * A batter's current-season rate line for a situational split (platoon, or
 * home/road). MLB's Stats API doesn't expose wRC+/wOBA (or OPS+, which it
 * doesn't have at all) filtered by situation — the sabermetrics stat group
 * ignores `sitCodes` and always returns full-season values — so OBP/OPS plus
 * walk/strikeout rate stand in as the best available situational read.
 */
export interface SplitLine {
  pa: number;
  obp: string;
  ops: string;
  bbPct: string;
  kPct: string;
}

/** One matchup row: career vs this specific pitcher, plus the platoon split. */
export interface MatchupRow extends VsPlayerLine {
  platoon: SplitLine;
}

/**
 * A batting side's home/road split, shown in place of vs-pitcher matchup rows
 * when no probable starter has been announced yet.
 */
export interface HomeAwaySplitRow {
  batter: PlayerRef;
  isHome: boolean;
  split: SplitLine;
}

/** A batting side's matchups against one opposing starting/probable pitcher. */
export interface MatchupSide {
  pitcher: PlayerRef | null;
  /** The pitcher's throwing hand, when known — drives the platoon-split columns. */
  pitcherHand: "L" | "R" | null;
  pitchingTeam: TeamRef;
  battingTeam: TeamRef;
  rows: MatchupRow[];
  /** True when batters came from the active-roster proxy (Preview games). */
  isProxy: boolean;
  /** Home/road split rows for the batting team — populated only when `pitcher` is null. */
  noPitcherRows: HomeAwaySplitRow[];
}

// ---------------------------------------------------------------------------
// Game log (play-by-play events)
// ---------------------------------------------------------------------------

export type ScoringPlayEventType =
  | "home_run"
  | "single"
  | "double"
  | "triple"
  | "stolen_base"
  | "caught_stealing"
  | "error"
  | "sacrifice_bunt"
  | "sacrifice_fly"
  | "wild_pitch"
  | "passed_ball"
  | "balk";

export interface ScoringPlay {
  inning: number;           // 1-based
  ordinal: string;          // "Top" | "Bottom"
  batter?: PlayerRef;       // Who was batting
  pitcher?: PlayerRef;      // Who was pitching
  description: string;      // Event description from API
  eventType: ScoringPlayEventType;
  awayScore: number;        // Score after this play
  homeScore: number;
}
