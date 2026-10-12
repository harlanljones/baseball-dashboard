import type {
  GameFeed,
  PitcherRecentForm,
  PitcherSplitLine,
  PlayerRef,
  SplitLine,
  TeamRef,
  VsPlayerLine,
} from "@/lib/mlb/types";
import type { GameWeather } from "@/lib/weather/types";
import { getGamePlayerProps } from "@/lib/odds/props";
import { indexByNormalizedName, normalizePlayerName } from "@/lib/odds/playerMatch";
import { matchupEvidence, scoreProp, type MatchupContext, type StatContext } from "@/lib/odds/highlight";
import type { PlayerProp, ScoredProp } from "@/lib/odds/types";
import { easternDateOf } from "@/lib/mlb/client";
import { buildMatchups } from "@/lib/mlb/matchup";
import {
  getRosterWithSeasonStats,
  getPitcherPropStatsBatch,
  getPitcherRecentFormBatch,
  getPitcherSituationalSplitBatch,
  type PitcherPropStats,
  type RosterHitter,
  type SeasonHittingBasic,
} from "@/lib/mlb/players";
import type { PropGameContext, PropPlayerGroup, PropTeamGroup } from "@/lib/odds/board";
import { safe } from "@/lib/safe";

interface RosterEntry {
  player: PlayerRef;
  team: TeamRef;
}

/** Per-player matchup evidence for one game; see {@link loadPropGroups}. */
interface EvidenceLookups {
  matchups: Awaited<ReturnType<typeof buildMatchups>> | null;
  pitcherRecentFormById: Map<number, PitcherRecentForm>;
  pitcherHomeAwayById: Map<number, PitcherSplitLine>;
}

/**
 * Scored prop board for one game, grouped by team then player.
 *
 * `game` carries everything the board itself needs. `feed` is optional and buys
 * exactly one thing: the per-player matchup evidence lines (batter-vs-starter,
 * platoon, pitcher recent form and home/road split), which cost several
 * upstream lookups per game. Callers that render that evidence pass the feed;
 * the slate-wide leans, which show only the score, omit it and skip the work.
 * Scores are identical either way — `scoreProp` never reads matchup context.
 *
 * `weather` may be a promise: it is only read at scoring time, so a caller can
 * start the forecast alongside everything here instead of ahead of it. Pass
 * one that resolves `null` on failure; it goes unread when a game has no odds.
 *
 * `pitcherStats` is the same idea for the probable starters' season lines: a
 * caller that already batched them for several games (the slate-wide leans)
 * passes that lookup — as a promise, so it runs alongside this game's other
 * work rather than in front of it.
 */
export async function loadPropGroups({
  game,
  season,
  weather,
  feed = null,
  pitcherStats = null,
}: {
  game: PropGameContext;
  season: number;
  weather: GameWeather | null | Promise<GameWeather | null>;
  feed?: GameFeed | null;
  pitcherStats?: Map<number, PitcherPropStats> | Promise<Map<number, PitcherPropStats>> | null;
}): Promise<PropTeamGroup[]> {
  const starterEntries: RosterEntry[] = (
    [
      [game.probablePitchers.away, game.away],
      [game.probablePitchers.home, game.home],
    ] as const
  )
    .filter((pair): pair is [PlayerRef, TeamRef] => pair[0] != null)
    .map(([player, team]) => ({ player, team }));
  // The provider posts strikeout/outs props for bullpen arms as well, so they
  // are attributed alongside the starters when the context carries them. Their
  // season line, recent form and home/road split come from the same lookups.
  const pitcherEntries: RosterEntry[] = [
    ...starterEntries,
    ...(game.bullpenPitchers?.away ?? []).map((player) => ({ player, team: game.away })),
    ...(game.bullpenPitchers?.home ?? []).map((player) => ({ player, team: game.home })),
  ];
  const pitcherIds = pitcherEntries.map((e) => e.player.id);
  const pitcherIsHomeById = new Map(
    pitcherEntries.map((e) => [e.player.id, e.team.id === game.home.id]),
  );

  // None of these MLB lookups depend on the odds: rosters, pitcher stats and
  // evidence key off the teams and probable starters alone.
  const startLookups = () => {
    const awayRoster = safe(getRosterWithSeasonStats(game.away.id, season));
    const homeRoster = safe(getRosterWithSeasonStats(game.home.id, season));
    const rosters = Promise.all([awayRoster, homeRoster]);
    const pitcherStatsLookup = pitcherStats
      ? Promise.resolve(pitcherStats)
      : safe(getPitcherPropStatsBatch(pitcherIds, season)).then((m) => m ?? new Map());
    // Matchup evidence — reuses the same lookups as the game page's "Matchups"
    // section (batter vs today's starter) and probable-starter cards (pitcher
    // recent form / home-road split); Next's fetch cache dedupes the repeats.
    // Only when a feed was supplied: these are the most expensive lookups here,
    // and a caller that doesn't render evidence shouldn't pay for them.
    const evidence: Promise<EvidenceLookups | null> = feed
      ? loadEvidence(feed, game, season, pitcherIds, pitcherIsHomeById, { away: awayRoster, home: homeRoster })
      : Promise.resolve(null);
    return { rosters, pitcherStats: pitcherStatsLookup, evidence };
  };

  // With a feed (the props page, where a reader is waiting) the lookups run
  // alongside the odds, so the board's latency hides theirs. Without a feed
  // (the slate-wide leans) everything waits for the odds, so a game with no
  // lines costs no MLB lookups at all. Every lookup is fail-soft, so an early
  // return below leaves nothing to reject unobserved.
  //
  // Batter scoring stats ride on the rosters themselves
  // ({@link getRosterWithSeasonStats} hydrates each hitter's season line), so no
  // separate per-player stats request is needed — for either caller.
  const early = feed ? startLookups() : null;

  const props =
    (await safe(
      getGamePlayerProps(game.away.name, game.home.name, game.startTime),
    )) ?? [];
  if (props.length === 0) return [];

  const lookups = early ?? startLookups();
  const [[awayRoster, homeRoster], pitcherStatsById, evidence, weatherNow] = await Promise.all([
    lookups.rosters,
    lookups.pitcherStats,
    lookups.evidence,
    weather,
  ]);

  const batterEntries: RosterEntry[] = [
    ...(awayRoster ?? []).map((r) => ({ player: r.player, team: game.away })),
    ...(homeRoster ?? []).map((r) => ({ player: r.player, team: game.home })),
  ];

  // One index per roster, so resolving a board's worth of provider names costs
  // one normalization per name instead of one per name per roster entry.
  const pitcherIndex = indexByNormalizedName(pitcherEntries, (entry) => entry.player.fullName);
  const batterIndex = indexByNormalizedName(batterEntries, (entry) => entry.player.fullName);

  const matched: { prop: PlayerProp; entry: RosterEntry; isPitcher: boolean }[] = [];
  for (const prop of props) {
    const isPitcher =
      prop.marketKey === "pitcher_strikeouts" || prop.marketKey === "pitcher_outs";
    const entry = (isPitcher ? pitcherIndex : batterIndex).get(normalizePlayerName(prop.playerName));
    if (entry) matched.push({ prop, entry, isPitcher });
  }

  const batterIds = [...new Set(matched.filter((m) => !m.isPitcher).map((m) => m.entry.player.id))];
  // Each matched batter's season line came down with the roster, so the board
  // scores without a second request per player.
  const batterStatsById = new Map<number, SeasonHittingBasic>();
  for (const roster of [awayRoster, homeRoster]) {
    for (const hitter of roster ?? []) {
      if (hitter.season) batterStatsById.set(hitter.player.id, hitter.season);
    }
  }
  const matchups = evidence?.matchups ?? null;
  const pitcherRecentFormById = evidence?.pitcherRecentFormById ?? new Map<number, PitcherRecentForm>();
  const pitcherHomeAwayById = evidence?.pitcherHomeAwayById ?? new Map<number, PitcherSplitLine>();

  const batterMatchupById = new Map<
    number,
    { vsPitcher: VsPlayerLine; platoon: SplitLine; vsHand: "L" | "R" | undefined }
  >();
  if (matchups) {
    for (const side of [matchups.awayPitching, matchups.homePitching]) {
      for (const row of side.rows) {
        batterMatchupById.set(row.batter.id, {
          vsPitcher: row,
          platoon: row.platoon,
          vsHand: side.pitcherHand ?? undefined,
        });
      }
    }
  }

  // Without a feed there is no matchup evidence to attach, and every group's
  // `evidence` stays empty rather than carrying half-populated contexts.
  const matchupById = new Map<number, MatchupContext>();
  if (feed) {
    for (const id of pitcherIds) {
      matchupById.set(id, {
        kind: "pitcher",
        recentForm: pitcherRecentFormById.get(id) ?? undefined,
        homeAway: pitcherHomeAwayById.get(id) ?? undefined,
        isHome: pitcherIsHomeById.get(id),
      });
    }
  }
  for (const id of batterIds) {
    const m = batterMatchupById.get(id);
    if (m) {
      matchupById.set(id, { kind: "batter", vsPitcher: m.vsPitcher, platoon: m.platoon, vsHand: m.vsHand });
    }
  }

  const scoredByTeam = new Map<number, ScoredProp[]>([
    [game.away.id, []],
    [game.home.id, []],
  ]);

  for (const { prop, entry, isPitcher } of matched) {
    let stats: StatContext | null = null;
    if (isPitcher) {
      const p = pitcherStatsById.get(entry.player.id);
      if (p) {
        stats = { kind: "pitcher", k9: p.k9, outsPerStart: p.outsPerStart, gamesStarted: p.gamesStarted };
      }
    } else {
      const h = batterStatsById.get(entry.player.id);
      if (h && h.games > 0) {
        stats = {
          kind: "batter",
          hitsPerGame: h.h / h.games,
          totalBasesPerGame: h.totalBases / h.games,
          hrPerGame: h.hr / h.games,
          rbiPerGame: h.rbi / h.games,
          bbPerGame: h.bb / h.games,
          games: h.games,
        };
      }
    }
    scoredByTeam.get(entry.team.id)!.push(scoreProp(prop, entry.player, stats, weatherNow));
  }

  function buildTeamGroup(team: TeamRef, teamProps: ScoredProp[]): PropTeamGroup {
    const byPlayer = new Map<number, PropPlayerGroup>();
    for (const p of teamProps) {
      const g = byPlayer.get(p.player.id) ?? {
        player: p.player,
        evidence: matchupEvidence(matchupById.get(p.player.id) ?? null),
        props: [],
      };
      g.props.push(p);
      byPlayer.set(p.player.id, g);
    }
    return { team, players: [...byPlayer.values()] };
  }

  const groups: PropTeamGroup[] = [
    buildTeamGroup(game.away, scoredByTeam.get(game.away.id) ?? []),
    buildTeamGroup(game.home, scoredByTeam.get(game.home.id) ?? []),
  ].filter((g) => g.players.length > 0);

  return groups;
}

/**
 * The matchup evidence lookups behind {@link loadPropGroups}: batter vs today's
 * starter and platoon lines, plus each probable starter's recent form and the
 * home/road split that matches this game. Fail-soft throughout.
 */
async function loadEvidence(
  feed: GameFeed,
  game: PropGameContext,
  season: number,
  pitcherIds: number[],
  pitcherIsHomeById: Map<number, boolean>,
  rosters: { away: Promise<RosterHitter[] | null>; home: Promise<RosterHitter[] | null> },
): Promise<EvidenceLookups> {
  const gameDate = easternDateOf(game.startTime || new Date());
  const [matchups, pitcherRecentFormById, pitcherHomeAwayById] = await Promise.all([
    safe(buildMatchups(feed, season, rosters)),
    safe(getPitcherRecentFormBatch(pitcherIds, gameDate)).then((m) => m ?? new Map()),
    // Each pitcher gets whichever home/road split matches this game — group
    // by side so the batched lookups stay one request per split code.
    Promise.all(
      [true, false].map(async (isHome) => {
        const ids = pitcherIds.filter(
          (id) => (pitcherIsHomeById.get(id) ?? false) === isHome,
        );
        return ids.length > 0
          ? ((await safe(getPitcherSituationalSplitBatch(ids, isHome ? "h" : "a", season))) ??
              new Map())
          : new Map<number, PitcherSplitLine>();
      }),
    ).then(([homeMap, roadMap]) => new Map([...homeMap, ...roadMap])),
  ]);
  return { matchups, pitcherRecentFormById, pitcherHomeAwayById };
}
