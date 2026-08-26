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
import { loadGamePlayerProps } from "@/lib/odds/props";
import { matchPlayerName } from "@/lib/odds/playerMatch";
import { matchupEvidence, scoreProp, type MatchupContext, type StatContext } from "@/lib/odds/highlight";
import type { PlayerProp, ScoredProp } from "@/lib/odds/types";
import { easternDateOf } from "@/lib/mlb/client";
import { buildMatchups } from "@/lib/mlb/matchup";
import {
  getRosterWithSeasonStats,
  getPitcherPropStatsBatch,
  getSeasonHittingBasicBatch,
  getPitcherRecentFormBatch,
  getPitcherSituationalSplitBatch,
} from "@/lib/mlb/players";
import type { PropGameContext, PropPlayerGroup, PropTeamGroup } from "@/lib/odds/board";

async function safe<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch {
    return null;
  }
}

interface RosterEntry {
  player: PlayerRef;
  team: TeamRef;
}

function findEntry(name: string, entries: RosterEntry[]): RosterEntry | null {
  const matched = matchPlayerName(
    name,
    entries.map((e) => e.player),
  );
  if (!matched) return null;
  return entries.find((e) => e.player.id === matched.id) ?? null;
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
 */
export async function loadPropGroups({
  game,
  season,
  weather,
  feed = null,
}: {
  game: PropGameContext;
  season: number;
  weather: GameWeather | null;
  feed?: GameFeed | null;
}): Promise<PropTeamGroup[]> {
  const props =
    (await safe(
      loadGamePlayerProps(game.away.name, game.home.name, game.startTime),
    )) ?? [];
  if (props.length === 0) return [];

  const [awayRoster, homeRoster] = await Promise.all([
    safe(getRosterWithSeasonStats(game.away.id, season)),
    safe(getRosterWithSeasonStats(game.home.id, season)),
  ]);

  const pitcherEntries: RosterEntry[] = (
    [
      [game.probablePitchers.away, game.away],
      [game.probablePitchers.home, game.home],
    ] as const
  )
    .filter((pair): pair is [PlayerRef, TeamRef] => pair[0] != null)
    .map(([player, team]) => ({ player, team }));

  const batterEntries: RosterEntry[] = [
    ...(awayRoster ?? []).map((r) => ({ player: r.player, team: game.away })),
    ...(homeRoster ?? []).map((r) => ({ player: r.player, team: game.home })),
  ];

  const matched: { prop: PlayerProp; entry: RosterEntry; isPitcher: boolean }[] = [];
  for (const prop of props) {
    const isPitcher =
      prop.marketKey === "pitcher_strikeouts" || prop.marketKey === "pitcher_outs";
    const entry = findEntry(prop.playerName, isPitcher ? pitcherEntries : batterEntries);
    if (entry) matched.push({ prop, entry, isPitcher });
  }

  const pitcherIds = [...new Set(matched.filter((m) => m.isPitcher).map((m) => m.entry.player.id))];
  const batterIds = [...new Set(matched.filter((m) => !m.isPitcher).map((m) => m.entry.player.id))];

  const [pitcherStatsById, batterStatsById] = await Promise.all([
    safe(getPitcherPropStatsBatch(pitcherIds, season)).then((m) => m ?? new Map()),
    safe(getSeasonHittingBasicBatch(batterIds, season)).then((m) => m ?? new Map()),
  ]);

  // Matchup evidence — reuses the same lookups as the game page's "Matchups"
  // section (batter vs today's starter) and probable-starter cards (pitcher
  // recent form / home-road split); Next's fetch cache dedupes the repeats.
  // Computed once per player (not per prop) since it doesn't vary by market.
  //
  // Only when a feed was supplied: these are the most expensive lookups here,
  // and a caller that doesn't render evidence shouldn't pay for them.
  const gameDate = easternDateOf(game.startTime || new Date());
  const pitcherIsHomeById = new Map(
    pitcherEntries.map((e) => [e.player.id, e.team.id === game.home.id]),
  );

  const [matchups, pitcherRecentFormById, pitcherHomeAwayById] = feed
    ? await Promise.all([
        safe(buildMatchups(feed, season)),
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
      ])
    : [
        null,
        new Map<number, PitcherRecentForm>(),
        new Map<number, PitcherSplitLine>(),
      ];

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
    scoredByTeam.get(entry.team.id)!.push(scoreProp(prop, entry.player, stats, weather));
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
