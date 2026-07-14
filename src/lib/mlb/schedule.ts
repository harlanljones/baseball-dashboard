import { easternToday, mlbFetch, TTL } from "./client";
import type {
  GameState,
  HeadToHead,
  LeagueRecord,
  PlayerRef,
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

interface RawGame {
  gamePk: number;
  gameDate: string;
  status: RawStatus;
  venue?: { name?: string; location?: { city?: string } };
  teams: { away: RawTeamSide; home: RawTeamSide };
  linescore?: RawLinescore;
}

interface RawSchedule {
  dates?: { date: string; games: RawGame[] }[];
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

function mapGame(g: RawGame): ScheduleGame {
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
 */
export async function getHeadToHead(
  teamA: TeamRef,
  teamB: TeamRef,
  season: number,
): Promise<HeadToHead> {
  const data = await mlbFetch<RawSchedule>(
    "/api/v1/schedule",
    {
      sportId: 1,
      teamId: teamA.id,
      opponentId: teamB.id,
      startDate: `${season}-01-01`,
      endDate: `${season}-12-31`,
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

  let aWins = 0;
  let bWins = 0;
  const meetings: SeriesMeeting[] = [];

  for (const g of byPk.values()) {
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

  return { teamA, teamB, aWins, bWins, meetings };
}
