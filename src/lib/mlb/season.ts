/**
 * Season-level context for the offseason home page: key season dates, the
 * postseason recap, next Opening Day, and which two seasons ("recap" and
 * "next") an off-day home page should talk about.
 */

import { mlbFetch, TTL } from "./client";
import { mapGame, type RawGame } from "./schedule";
import type {
  OffseasonContext,
  OpeningDay,
  PostseasonSeries,
  SeasonRecap,
  TeamRef,
} from "./types";

// --- Raw API shapes (only the fields we read) --------------------------------

interface RawSeasonEntry {
  springStartDate?: string;
  regularSeasonStartDate?: string;
  regularSeasonEndDate?: string;
}

interface RawSeasonsResponse {
  seasons?: RawSeasonEntry[];
}

/**
 * A postseason schedule game. The `/schedule/postseason/series` endpoint has
 * no `seriesStatus` (even when hydrated), so the series winner and won-loss
 * status are derived below from `Final` games instead.
 */
interface RawPostseasonGame extends RawGame {
  seriesDescription?: string;
  gamesInSeries?: number;
}

interface RawSeriesEntry {
  series: { id: string; gameType: string; sortNumber?: number };
  games: RawPostseasonGame[];
}

interface RawPostseasonResponse {
  series?: RawSeriesEntry[];
}

interface RawScheduleDatesOnly {
  dates?: { date: string }[];
}

// --- Mapping helpers ---------------------------------------------------------

function mapTeamRef(t: { id: number; name: string; abbreviation?: string }): TeamRef {
  return { id: t.id, name: t.name, abbreviation: t.abbreviation };
}

/** A rescheduled game can appear twice under the same gamePk — a stale stub
 * and the real makeup. Keep the entry with a decided result, as in
 * {@link getHeadToHead}'s dedupe. */
function dedupeGames(games: RawPostseasonGame[]): RawPostseasonGame[] {
  const decided = (g: RawPostseasonGame) =>
    g.teams.away.isWinner === true || g.teams.home.isWinner === true;
  const byPk = new Map<number, RawPostseasonGame>();
  for (const g of games) {
    const existing = byPk.get(g.gamePk);
    if (!existing || (!decided(existing) && decided(g))) byPk.set(g.gamePk, g);
  }
  return [...byPk.values()].sort((a, b) => a.gameDate.localeCompare(b.gameDate));
}

/** The series winner and a "Won N-M" status, once one side has won a
 * majority of `gamesInSeries`. Undecided/in-progress series get neither. */
function seriesResult(games: RawPostseasonGame[]): { winner?: TeamRef; status?: string } {
  const wins = new Map<number, { team: TeamRef; wins: number }>();
  for (const g of games) {
    if (g.status.abstractGameState !== "Final") continue;
    const winnerSide = g.teams.away.isWinner
      ? g.teams.away
      : g.teams.home.isWinner
        ? g.teams.home
        : undefined;
    if (!winnerSide) continue;
    const entry = wins.get(winnerSide.team.id) ?? { team: mapTeamRef(winnerSide.team), wins: 0 };
    entry.wins += 1;
    wins.set(winnerSide.team.id, entry);
  }
  if (wins.size === 0) return {};

  const seriesLength = Math.max(0, ...games.map((g) => g.gamesInSeries ?? 0));
  const [leader, trailer] = [...wins.values()].sort((a, b) => b.wins - a.wins);
  if (seriesLength === 0 || leader.wins <= seriesLength / 2) return {};

  return {
    winner: leader.team,
    status: `Won ${leader.wins}-${trailer?.wins ?? 0}`,
  };
}

// --- Public API --------------------------------------------------------------

export interface SeasonDates {
  springStartDate?: string;
  regularSeasonStartDate?: string;
  regularSeasonEndDate?: string;
}

/** Key dates for a season: spring training start, regular season start/end. */
export async function getSeasonDates(season: number): Promise<SeasonDates | null> {
  try {
    const data = await mlbFetch<RawSeasonsResponse>(
      `/api/v1/seasons/${season}`,
      { sportId: 1 },
      TTL.roster,
    );
    const s = data.seasons?.[0];
    if (!s) return null;
    return {
      springStartDate: s.springStartDate,
      regularSeasonStartDate: s.regularSeasonStartDate,
      regularSeasonEndDate: s.regularSeasonEndDate,
    };
  } catch {
    return null;
  }
}

/**
 * The postseason recap for a season: every series (World Series first, then
 * LCS, Division Series, Wild Card), the champion once decided, and the latest
 * completed game. An empty or missing postseason response (season not yet
 * played, or not yet started) yields an "over-less" empty recap rather than
 * throwing.
 */
export async function getSeasonRecap(season: number): Promise<SeasonRecap> {
  const data = await mlbFetch<RawPostseasonResponse>(
    "/api/v1/schedule/postseason/series",
    { sportId: 1, season, hydrate: "team,linescore" },
    TTL.headToHead,
  );
  const rawSeries = data.series ?? [];
  if (rawSeries.length === 0) return { season, isOver: false, series: [] };

  const typeOrder: Record<string, number> = { W: 0, L: 1, D: 2, F: 3 };
  const ordered = [...rawSeries].sort((a, b) => {
    const typeDiff = (typeOrder[a.series.gameType] ?? 99) - (typeOrder[b.series.gameType] ?? 99);
    return typeDiff !== 0 ? typeDiff : (a.series.sortNumber ?? 0) - (b.series.sortNumber ?? 0);
  });

  const dedupedEntries = ordered.map((entry) => ({
    ...entry,
    games: dedupeGames(entry.games),
  }));

  const series: PostseasonSeries[] = dedupedEntries.map((entry) => {
    const { winner, status } = seriesResult(entry.games);
    const label = entry.games.find((g) => g.seriesDescription)?.seriesDescription ?? entry.series.id;
    return {
      id: entry.series.id,
      gameType: entry.series.gameType,
      label,
      status,
      winner,
      games: entry.games.map(mapGame),
    };
  });

  const champion = series.find((s) => s.gameType === "W")?.winner;

  const allFinals = dedupedEntries
    .flatMap((entry) => entry.games)
    .filter((g) => g.status.abstractGameState === "Final");
  const finalGame = allFinals.length
    ? mapGame(allFinals.reduce((latest, g) => (g.gameDate > latest.gameDate ? g : latest)))
    : undefined;

  return { season, isOver: champion != null, champion, finalGame, series };
}

/**
 * A season's Opening Day: the earliest regular-season date Feb-May (this
 * catches international openers a week ahead of the "true" domestic opener),
 * falling back to the season's official `regularSeasonStartDate` if the
 * schedule lookup comes back empty or fails.
 */
export async function getOpeningDay(season: number): Promise<OpeningDay | null> {
  let date: string | undefined;
  try {
    const data = await mlbFetch<RawScheduleDatesOnly>(
      "/api/v1/schedule",
      {
        sportId: 1,
        gameType: "R",
        startDate: `${season}-02-01`,
        endDate: `${season}-05-31`,
        fields: "dates,date",
      },
      TTL.roster,
    );
    date = data.dates?.[0]?.date;
  } catch {
    // Fall through to the seasons-endpoint fallback below.
  }

  const seasonDates = await getSeasonDates(season);
  date ??= seasonDates?.regularSeasonStartDate;
  if (!date) return null;

  return { season, date, springStart: seasonDates?.springStartDate };
}

/**
 * Which seasons an offseason home page should talk about for a given
 * no-games date (the caller has already confirmed there's nothing scheduled).
 * Returns `null` for an in-season off day, or when a mid-postseason date's
 * World Series hasn't been decided yet. Never throws — the home page must
 * keep working when the MLB API is down.
 */
export async function getOffseasonContext(date: string): Promise<OffseasonContext | null> {
  try {
    const year = Number(date.slice(0, 4));
    const dates = await getSeasonDates(year);
    if (!dates?.springStartDate || !dates.regularSeasonEndDate) return null;

    if (date < dates.springStartDate) {
      return { recapSeason: year - 1, nextSeason: year };
    }

    if (date > dates.regularSeasonEndDate) {
      const recap = await getSeasonRecap(year);
      if (recap.isOver) {
        return { recapSeason: year, nextSeason: year + 1 };
      }
    }

    return null;
  } catch {
    return null;
  }
}
