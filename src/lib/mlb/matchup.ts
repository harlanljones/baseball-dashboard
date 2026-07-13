import { getRosterWithSeasonStats, getVsPlayer } from "./players";
import type {
  GameFeed,
  MatchupSide,
  PlayerRef,
  TeamBoxscore,
  TeamRef,
  VsPlayerLine,
} from "./types";

/** Max batters we look up per pitching side (a standard lineup). */
const LINEUP_SIZE = 9;

function ref(id: number, names: Record<number, string>): PlayerRef {
  return { id, fullName: names[id] ?? `#${id}` };
}

/** The starting pitcher for a side: the boxscore starter, else the probable. */
function resolvePitcher(
  feed: GameFeed,
  box: TeamBoxscore,
  probable: PlayerRef | undefined,
): PlayerRef | null {
  if (feed.state === "Live" || feed.state === "Final") {
    const starterId = box.pitcherIds[0];
    if (starterId) return ref(starterId, feed.playerNames);
  }
  return probable ?? null;
}

/** The batting side's lineup: real batting order when posted, else a proxy. */
async function resolveBatters(
  feed: GameFeed,
  battingBox: TeamBoxscore,
  season: number,
): Promise<{ batters: PlayerRef[]; isProxy: boolean }> {
  if (
    (feed.state === "Live" || feed.state === "Final") &&
    battingBox.battingOrderIds.length > 0
  ) {
    return {
      batters: battingBox.battingOrderIds
        .slice(0, LINEUP_SIZE)
        .map((id) => ref(id, feed.playerNames)),
      isProxy: false,
    };
  }

  // Preview (or missing order): proxy with the roster's top hitters by PA.
  const roster = await getRosterWithSeasonStats(battingBox.team.id, season);
  return {
    batters: roster.slice(0, LINEUP_SIZE).map((h) => h.player),
    isProxy: true,
  };
}

async function buildSide(
  feed: GameFeed,
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

  const awayPitcher = resolvePitcher(
    feed,
    feed.boxscore.away,
    feed.probablePitchers.away,
  );
  const homePitcher = resolvePitcher(
    feed,
    feed.boxscore.home,
    feed.probablePitchers.home,
  );

  const [homeLineup, awayLineup] = await Promise.all([
    resolveBatters(feed, feed.boxscore.home, season),
    resolveBatters(feed, feed.boxscore.away, season),
  ]);

  const [awayPitching, homePitching] = await Promise.all([
    // Away team pitching -> faces the home lineup.
    buildSide(
      feed,
      awayTeam,
      homeTeam,
      awayPitcher,
      homeLineup.batters,
      homeLineup.isProxy,
    ),
    // Home team pitching -> faces the away lineup.
    buildSide(
      feed,
      homeTeam,
      awayTeam,
      homePitcher,
      awayLineup.batters,
      awayLineup.isProxy,
    ),
  ]);

  return { awayPitching, homePitching };
}
