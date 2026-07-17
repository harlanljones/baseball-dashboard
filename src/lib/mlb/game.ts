import { mlbFetch, MlbApiError, TTL } from "./client";
import { mapGameState } from "./schedule";
import type {
  BoxscoreBatter,
  BoxscorePitcher,
  BullpenPitcher,
  GameFeed,
  InningLine,
  PlayerRef,
  TeamBoxscore,
  TeamRef,
} from "./types";

// --- Raw feed shapes (only the fields we read) -------------------------------

interface RawPersonRef {
  id: number;
  fullName: string;
}

interface RawBoxPlayer {
  person: RawPersonRef;
  position?: { abbreviation?: string };
  battingOrder?: string;
  stats?: {
    batting?: Record<string, unknown>;
    pitching?: Record<string, unknown>;
  };
  seasonStats?: {
    pitching?: Record<string, unknown>;
  };
}

interface RawBoxTeam {
  team: { id: number; name: string; abbreviation?: string };
  players: Record<string, RawBoxPlayer>;
  batters: number[];
  pitchers: number[];
  bullpen?: number[];
  battingOrder: number[];
}

interface RawInning {
  num: number;
  ordinalNum: string;
  home?: { runs?: number; hits?: number; errors?: number };
  away?: { runs?: number; hits?: number; errors?: number };
}

interface RawFeed {
  gamePk: number;
  gameData: {
    status: { abstractGameState?: string; detailedState?: string };
    datetime?: { dateTime?: string };
    venue?: { id?: number; name?: string; location?: { city?: string } };
    weather?: { condition?: string; temp?: string; wind?: string };
    teams: {
      away: { id: number; name: string; abbreviation?: string };
      home: { id: number; name: string; abbreviation?: string };
    };
    probablePitchers?: {
      away?: RawPersonRef;
      home?: RawPersonRef;
    };
  };
  liveData: {
    linescore: {
      scheduledInnings?: number;
      innings: RawInning[];
      teams: {
        home: { runs?: number; hits?: number; errors?: number };
        away: { runs?: number; hits?: number; errors?: number };
      };
    };
    boxscore: { teams: { away: RawBoxTeam; home: RawBoxTeam } };
    decisions?: {
      winner?: RawPersonRef;
      loser?: RawPersonRef;
      save?: RawPersonRef;
    };
  };
}

// --- Mapping helpers ---------------------------------------------------------

function num(v: unknown): number {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
}

function str(v: unknown, fallback = "-"): string {
  return v == null || v === "" ? fallback : String(v);
}

function mapBatter(p: RawBoxPlayer): BoxscoreBatter {
  const b = p.stats?.batting ?? {};
  return {
    id: p.person.id,
    name: p.person.fullName,
    position: p.position?.abbreviation ?? "",
    battingOrder: p.battingOrder ? parseInt(p.battingOrder, 10) : 0,
    ab: num(b.atBats),
    r: num(b.runs),
    h: num(b.hits),
    rbi: num(b.rbi),
    bb: num(b.baseOnBalls),
    k: num(b.strikeOuts),
    avg: str(b.avg),
  };
}

function mapPitcher(p: RawBoxPlayer): BoxscorePitcher {
  const s = p.stats?.pitching ?? {};
  return {
    id: p.person.id,
    name: p.person.fullName,
    ip: str(s.inningsPitched, "0.0"),
    h: num(s.hits),
    r: num(s.runs),
    er: num(s.earnedRuns),
    bb: num(s.baseOnBalls),
    k: num(s.strikeOuts),
    era: str(s.era),
  };
}

function mapBullpenPitcher(p: RawBoxPlayer): BullpenPitcher {
  const s = p.seasonStats?.pitching ?? {};
  return {
    id: p.person.id,
    name: p.person.fullName,
    ip: str(s.inningsPitched, "0.0"),
    era: s.era ? str(s.era) : undefined,
    k: num(s.strikeOuts),
  };
}

function mapBoxTeam(t: RawBoxTeam): TeamBoxscore {
  const player = (id: number) => t.players[`ID${id}`];
  const batters = t.batters
    .map(player)
    .filter((p): p is RawBoxPlayer => Boolean(p))
    .map(mapBatter);
  const pitchers = t.pitchers
    .map(player)
    .filter((p): p is RawBoxPlayer => Boolean(p))
    .map(mapPitcher);
  const bullpen = (t.bullpen ?? [])
    .map(player)
    .filter((p): p is RawBoxPlayer => Boolean(p))
    .map(mapBullpenPitcher);
  return {
    team: { id: t.team.id, name: t.team.name, abbreviation: t.team.abbreviation },
    batters,
    pitchers,
    bullpen,
    battingOrderIds: t.battingOrder ?? [],
    pitcherIds: t.pitchers ?? [],
  };
}

function mapProbable(p?: RawPersonRef): PlayerRef | undefined {
  return p ? { id: p.id, fullName: p.fullName } : undefined;
}

function collectNames(...teams: RawBoxTeam[]): Record<number, string> {
  const names: Record<number, string> = {};
  for (const t of teams) {
    for (const key of Object.keys(t.players)) {
      const p = t.players[key];
      names[p.person.id] = p.person.fullName;
    }
  }
  return names;
}

// --- Public API --------------------------------------------------------------

/**
 * Full live feed for one game: status, linescore, boxscore, and probables.
 * A bad `gamePk` yields a 404 from the API (surfaced as {@link MlbApiError}),
 * which callers translate into `notFound()`.
 */
export async function getLiveFeed(gamePk: number): Promise<GameFeed> {
  const feed = await mlbFetch<RawFeed>(
    `/api/v1.1/game/${gamePk}/feed/live`,
    {},
    TTL.live,
  );

  // Unknown gamePks return HTTP 200 with an empty skeleton (gamePk 0, team
  // id 0). Treat that as a 404 so callers can render notFound() cleanly.
  if (!feed.gamePk || feed.gameData?.teams?.away?.id === 0) {
    throw new MlbApiError(404, `/api/v1.1/game/${gamePk}/feed/live`, "Game not found");
  }

  const gd = feed.gameData;
  const ld = feed.liveData;
  const away = gd.teams.away;
  const home = gd.teams.home;

  const innings: InningLine[] = (ld.linescore.innings ?? []).map((i) => ({
    num: i.num,
    ordinal: i.ordinalNum,
    home: { runs: i.home?.runs, hits: i.home?.hits, errors: i.home?.errors },
    away: { runs: i.away?.runs, hits: i.away?.hits, errors: i.away?.errors },
  }));

  const awayBox = mapBoxTeam(ld.boxscore.teams.away);
  const homeBox = mapBoxTeam(ld.boxscore.teams.home);

  const mapRef = (t: { id: number; name: string; abbreviation?: string }): TeamRef => ({
    id: t.id,
    name: t.name,
    abbreviation: t.abbreviation,
  });

  return {
    gamePk: feed.gamePk,
    state: mapGameState(gd.status.abstractGameState),
    detailedState: gd.status.detailedState ?? "",
    startTime: gd.datetime?.dateTime ?? "",
    venue: gd.venue?.name,
    venueCity: gd.venue?.location?.city,
    venueId: gd.venue?.id,
    weather: gd.weather
      ? { condition: gd.weather.condition, tempF: gd.weather.temp, wind: gd.weather.wind }
      : undefined,
    away: { team: mapRef(away), score: ld.linescore.teams.away.runs },
    home: { team: mapRef(home), score: ld.linescore.teams.home.runs },
    linescore: {
      innings,
      away: {
        runs: ld.linescore.teams.away.runs,
        hits: ld.linescore.teams.away.hits,
        errors: ld.linescore.teams.away.errors,
      },
      home: {
        runs: ld.linescore.teams.home.runs,
        hits: ld.linescore.teams.home.hits,
        errors: ld.linescore.teams.home.errors,
      },
      scheduledInnings: ld.linescore.scheduledInnings ?? 9,
    },
    boxscore: { away: awayBox, home: homeBox },
    probablePitchers: {
      away: mapProbable(gd.probablePitchers?.away),
      home: mapProbable(gd.probablePitchers?.home),
    },
    decisions: ld.decisions
      ? {
          winner: mapProbable(ld.decisions.winner),
          loser: mapProbable(ld.decisions.loser),
          save: mapProbable(ld.decisions.save),
        }
      : undefined,
    playerNames: collectNames(ld.boxscore.teams.away, ld.boxscore.teams.home),
  };
}
