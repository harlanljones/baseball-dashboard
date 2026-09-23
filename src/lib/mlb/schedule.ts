import { easternToday, mlbFetch, TTL } from "./client";
import type {
  GameState,
  HeadToHead,
  LeagueRecord,
  PlayerRef,
  PostseasonSeries,
  ScheduleDay,
  ScheduleGame,
  SeriesMeeting,
  TeamRef,
} from "./types";

// --- Raw API shapes (only the fields we read) --------------------------------

interface RawStatus {
  abstractGameState?: string;
  detailedState?: string;
}

interface RawTeamSide {
  score?: number;
  isWinner?: boolean;
  leagueRecord?: { wins: number; losses: number; pct: string };
  team: { id: number; name: string; abbreviation?: string };
  probablePitcher?: { id: number; fullName: string };
}

interface RawLinescore {
  currentInning?: number;
  currentInningOrdinal?: string;
  inningState?: string;
  isTopInning?: boolean;
}

export interface RawGame {
  gamePk: number;
  gameDate: string;
  /** `YYYY-MM-DD` date the game counts toward (Eastern). */
  officialDate?: string;
  gameType?: string;
  status: RawStatus;
  venue?: { name?: string; location?: { city?: string } };
  teams: { away: RawTeamSide; home: RawTeamSide };
  linescore?: RawLinescore;
}

interface RawSchedule {
  dates?: { date: string; games: RawGame[] }[];
}

// --- Game types --------------------------------------------------------------

/** MLB postseason game type codes, in round order, with display names. */
const POSTSEASON_ROUNDS: Record<string, string> = {
  F: "Wild Card Series",
  D: "Division Series",
  L: "Championship Series",
  W: "World Series",
};

/** Comma-joined postseason game types, for `gameType` query params. */
export const POSTSEASON_GAME_TYPES = Object.keys(POSTSEASON_ROUNDS).join(",");

/** True for Wild Card, Division, League Championship and World Series games. */
export function isPostseason(gameType?: string): boolean {
  return gameType != null && gameType in POSTSEASON_ROUNDS;
}

// --- Mapping helpers ---------------------------------------------------------

export function mapGameState(abstract?: string): GameState {
  switch (abstract) {
    case "Preview":
      return "Preview";
    case "Live":
      return "Live";
    case "Final":
      return "Final";
    default:
      return "Other";
  }
}

function mapTeamRef(t: RawTeamSide["team"]): TeamRef {
  return { id: t.id, name: t.name, abbreviation: t.abbreviation };
}

function mapRecord(r?: RawTeamSide["leagueRecord"]): LeagueRecord | undefined {
  return r ? { wins: r.wins, losses: r.losses, pct: r.pct } : undefined;
}

function mapProbable(p?: { id: number; fullName: string }): PlayerRef | undefined {
  return p ? { id: p.id, fullName: p.fullName } : undefined;
}

export function mapGame(g: RawGame): ScheduleGame {
  const state = mapGameState(g.status.abstractGameState);
  return {
    gamePk: g.gamePk,
    gameDate: g.gameDate,
    state,
    detailedState: g.status.detailedState ?? state,
    venue: g.venue?.name,
    venueCity: g.venue?.location?.city,
    away: {
      team: mapTeamRef(g.teams.away.team),
      score: g.teams.away.score,
      record: mapRecord(g.teams.away.leagueRecord),
      probablePitcher: mapProbable(g.teams.away.probablePitcher),
      isWinner: g.teams.away.isWinner,
    },
    home: {
      team: mapTeamRef(g.teams.home.team),
      score: g.teams.home.score,
      record: mapRecord(g.teams.home.leagueRecord),
      probablePitcher: mapProbable(g.teams.home.probablePitcher),
      isWinner: g.teams.home.isWinner,
    },
    inning: g.linescore
      ? {
          current: g.linescore.currentInning,
          ordinal: g.linescore.currentInningOrdinal,
          state: g.linescore.inningState,
          isTop: g.linescore.isTopInning,
        }
      : undefined,
  };
}

// --- Public API --------------------------------------------------------------

/**
 * Today's (or a given date's) MLB scoreboard.
 *
 * Past dates are effectively immutable, so they get a long cache TTL; today and
 * future dates use the short live TTL. An off-day returns an empty `games`.
 */
export async function getSchedule(date?: string): Promise<ScheduleDay> {
  const today = easternToday();
  const target = date ?? today;
  const isPast = target < today;

  const data = await mlbFetch<RawSchedule>(
    "/api/v1/schedule",
    {
      sportId: 1,
      date: target,
      hydrate: "team,linescore,probablePitcher(note),decisions,venue(location)",
    },
    isPast ? TTL.roster : TTL.live,
  );

  const rawGames = data.dates?.[0]?.games ?? [];
  const games = rawGames.map(mapGame);
  return {
    date: target,
    games,
    hasLiveGame: games.some((g) => g.state === "Live"),
  };
}

/**
 * Season series between two teams, with a derived win-loss split from completed
 * meetings.
 *
 * Pass the viewed game's `gameType` so a postseason game also gets its round's
 * games (e.g. the Division Series so far) as `postseason`; the top-level
 * record and meetings always stay regular season only.
 */
export async function getHeadToHead(
  teamA: TeamRef,
  teamB: TeamRef,
  season: number,
  gameType?: string,
): Promise<HeadToHead> {
  const round = isPostseason(gameType) ? gameType : undefined;
  const data = await mlbFetch<RawSchedule>(
    "/api/v1/schedule",
    {
      sportId: 1,
      teamId: teamA.id,
      opponentId: teamB.id,
      startDate: `${season}-01-01`,
      endDate: `${season}-12-31`,
      // Without this, MLB tags Spring Training games with the *upcoming*
      // season's year, so a bare date-range query pulls exhibition games
      // (and their sometimes-Cancelled-but-abstractGameState=Final entries)
      // into what should be the regular-season series.
      gameType: round ? `R,${round}` : "R",
      hydrate: "team,linescore",
    },
    TTL.headToHead,
  );

  const rawGames = (data.dates ?? []).flatMap((d) => d.games);

  // A rescheduled game can appear twice — a stale "Postponed" stub and the
  // real makeup — under the same gamePk. Keep the entry with a decided result.
  const decided = (g: RawGame) =>
    g.teams.away.isWinner === true ||
    g.teams.home.isWinner === true ||
    (g.teams.away.score != null && g.teams.home.score != null);
  const byPk = new Map<number, RawGame>();
  for (const g of rawGames) {
    const existing = byPk.get(g.gamePk);
    if (!existing || (!decided(existing) && decided(g))) byPk.set(g.gamePk, g);
  }

  // Filter on each game's own type too, rather than trusting the query alone;
  // a game missing the field counts as regular season, the query's base type.
  const games = [...byPk.values()];
  const regular = tallySeries(
    games.filter((g) => (g.gameType ?? "R") === "R"),
    teamA,
    teamB,
  );

  let postseason: PostseasonSeries | undefined;
  if (round) {
    postseason = {
      gameType: round,
      name: POSTSEASON_ROUNDS[round],
      ...tallySeries(
        games.filter((g) => g.gameType === round),
        teamA,
        teamB,
      ),
    };
  }

  return { teamA, teamB, ...regular, ...(postseason ? { postseason } : {}) };
}

/** Win-loss split and meeting list for a set of games between two teams. */
function tallySeries(
  games: RawGame[],
  teamA: TeamRef,
  teamB: TeamRef,
): { aWins: number; bWins: number; meetings: SeriesMeeting[] } {
  let aWins = 0;
  let bWins = 0;
  const meetings: SeriesMeeting[] = [];

  for (const g of games) {
    const state = mapGameState(g.status.abstractGameState);
    const away = g.teams.away;
    const home = g.teams.home;

    if (state === "Final") {
      const winnerId = away.isWinner
        ? away.team.id
        : home.isWinner
          ? home.team.id
          : away.score != null && home.score != null
            ? away.score > home.score
              ? away.team.id
              : home.team.id
            : undefined;
      if (winnerId === teamA.id) aWins++;
      else if (winnerId === teamB.id) bWins++;
    }

    meetings.push({
      gamePk: g.gamePk,
      date: g.gameDate,
      state,
      away: { team: mapTeamRef(away.team), score: away.score },
      home: { team: mapTeamRef(home.team), score: home.score },
    });
  }

  return { aWins, bWins, meetings };
}
