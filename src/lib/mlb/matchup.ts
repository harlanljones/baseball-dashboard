import { getRosterWithSeasonStats, getVsPlayer } from "./players";
import type {
  GameFeed,
  MatchupSide,
  PlayerRef,
  TeamRef,
  VsPlayerLine,
} from "./types";

/** Max batters we look up per pitching side (a standard lineup). */
const LINEUP_SIZE = 9;

type Side = "away" | "home";

function ref(id: number, names: Record<number, string>): PlayerRef {
  return { id, fullName: names[id] ?? `#${id}` };
}

/**
 * The starting pitcher for a side: the boxscore starter once the game is
 * underway, otherwise the announced probable (or null if TBD).
 */
export function startingPitcherFor(feed: GameFeed, side: Side): PlayerRef | null {
  if (feed.state === "Live" || feed.state === "Final") {
    const starterId = feed.boxscore[side].pitcherIds[0];
    if (starterId) return ref(starterId, feed.playerNames);
  }
  return feed.probablePitchers[side] ?? null;
}

/**
 * A side's batting order: the real order once posted, otherwise a proxy built
 * from the active roster's top hitters by plate appearances (Preview games).
 */
export async function lineupFor(
  feed: GameFeed,
  side: Side,
  season: number,
): Promise<{ batters: PlayerRef[]; isProxy: boolean }> {
  const box = feed.boxscore[side];
  if (
    (feed.state === "Live" || feed.state === "Final") &&
    box.battingOrderIds.length > 0
  ) {
    return {
      batters: box.battingOrderIds
        .slice(0, LINEUP_SIZE)
        .map((id) => ref(id, feed.playerNames)),
      isProxy: false,
    };
  }

  const roster = await getRosterWithSeasonStats(box.team.id, season);
  return {
    batters: roster.slice(0, LINEUP_SIZE).map((h) => h.player),
    isProxy: true,
  };
}

async function buildSide(
  pitchingTeam: TeamRef,
  battingTeam: TeamRef,
  pitcher: PlayerRef | null,
  batters: PlayerRef[],
  isProxy: boolean,
): Promise<MatchupSide> {
  let rows: VsPlayerLine[] = [];
  if (pitcher && batters.length > 0) {
    const settled = await Promise.allSettled(
      batters.map((b) => getVsPlayer(b, pitcher)),
    );
    rows = settled
      .filter(
        (r): r is PromiseFulfilledResult<VsPlayerLine> =>
          r.status === "fulfilled",
      )
      .map((r) => r.value);
  }
  return { pitcher, pitchingTeam, battingTeam, rows, isProxy };
}

/**
 * Build both batter-vs-pitcher tables for a game: the away pitcher against the
 * home lineup, and the home pitcher against the away lineup. Lookups fan out in
 * parallel and tolerate individual failures (a dropped row degrades gracefully).
 */
export async function buildMatchups(
  feed: GameFeed,
  season: number,
): Promise<{ awayPitching: MatchupSide; homePitching: MatchupSide }> {
  const awayTeam = feed.away.team;
  const homeTeam = feed.home.team;

  const awayPitcher = startingPitcherFor(feed, "away");
  const homePitcher = startingPitcherFor(feed, "home");

  const [homeLineup, awayLineup] = await Promise.all([
    lineupFor(feed, "home", season),
    lineupFor(feed, "away", season),
  ]);

  const [awayPitching, homePitching] = await Promise.all([
    // Away team pitching -> faces the home lineup.
    buildSide(awayTeam, homeTeam, awayPitcher, homeLineup.batters, homeLineup.isProxy),
    // Home team pitching -> faces the away lineup.
    buildSide(homeTeam, awayTeam, homePitcher, awayLineup.batters, awayLineup.isProxy),
  ]);

  return { awayPitching, homePitching };
}
