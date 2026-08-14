import type { GameFeed, PlayerRef, TeamRef, VsPlayerLine, SplitLine } from "@/lib/mlb/types";
import type { GameWeather } from "@/lib/weather/types";
import { findOddsEvent } from "@/lib/odds/events";
import { getPlayerProps } from "@/lib/odds/props";
import { matchPlayerName } from "@/lib/odds/playerMatch";
import { matchupEvidence, scoreProp, type MatchupContext, type StatContext } from "@/lib/odds/highlight";
import type { PlayerProp, ScoredProp } from "@/lib/odds/types";
import { easternDateOf } from "@/lib/mlb/client";
import { buildMatchups } from "@/lib/mlb/matchup";
import {
  getRosterWithSeasonStats,
  getPitcherPropStats,
  getSeasonHittingBasic,
  getPitcherRecentForm,
  getPitcherHomeAwaySplit,
} from "@/lib/mlb/players";
import PropsSidebar, { type PropPlayerGroup, type PropTeamGroup } from "./PropsSidebar";

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

export default async function PropsSidebarSection({
  feed,
  season,
  weather,
}: {
  feed: GameFeed;
  season: number;
  weather: GameWeather | null;
}) {
  const eventId = await safe(
    findOddsEvent(feed.away.team.name, feed.home.team.name, feed.startTime),
  );
  if (!eventId) return <PropsSidebar groups={[]} />;

  const props = (await safe(getPlayerProps(eventId))) ?? [];
  if (props.length === 0) return <PropsSidebar groups={[]} />;

  const [awayRoster, homeRoster] = await Promise.all([
    safe(getRosterWithSeasonStats(feed.away.team.id, season)),
    safe(getRosterWithSeasonStats(feed.home.team.id, season)),
  ]);

  const pitcherEntries: RosterEntry[] = (
    [
      [feed.probablePitchers.away, feed.away.team],
      [feed.probablePitchers.home, feed.home.team],
    ] as const
  )
    .filter((pair): pair is [PlayerRef, TeamRef] => pair[0] != null)
    .map(([player, team]) => ({ player, team }));

  const batterEntries: RosterEntry[] = [
    ...(awayRoster ?? []).map((r) => ({ player: r.player, team: feed.away.team })),
    ...(homeRoster ?? []).map((r) => ({ player: r.player, team: feed.home.team })),
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

  const [pitcherStatsList, batterStatsList] = await Promise.all([
    Promise.all(
      pitcherIds.map(async (id) => [id, await safe(getPitcherPropStats(id, season))] as const),
    ),
    Promise.all(
      batterIds.map(async (id) => [id, await safe(getSeasonHittingBasic(id, season))] as const),
    ),
  ]);

  const pitcherStatsById = new Map(pitcherStatsList);
  const batterStatsById = new Map(batterStatsList);

  // Matchup evidence — reuses the same lookups as the game page's "Matchups"
  // section (batter vs today's starter) and probable-starter cards (pitcher
  // recent form / home-road split); Next's fetch cache dedupes the repeats.
  // Computed once per player (not per prop) since it doesn't vary by market.
  const gameDate = easternDateOf(feed.startTime || new Date());
  const pitcherIsHomeById = new Map(
    pitcherEntries.map((e) => [e.player.id, e.team.id === feed.home.team.id]),
  );

  const [matchups, pitcherRecentFormList, pitcherHomeAwayList] = await Promise.all([
    safe(buildMatchups(feed, season)),
    Promise.all(
      pitcherIds.map(async (id) => [id, await safe(getPitcherRecentForm(id, gameDate))] as const),
    ),
    Promise.all(
      pitcherIds.map(
        async (id) =>
          [id, await safe(getPitcherHomeAwaySplit(id, pitcherIsHomeById.get(id) ?? false, season))] as const,
      ),
    ),
  ]);

  const pitcherRecentFormById = new Map(pitcherRecentFormList);
  const pitcherHomeAwayById = new Map(pitcherHomeAwayList);

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

  const matchupById = new Map<number, MatchupContext>();
  for (const id of pitcherIds) {
    matchupById.set(id, {
      kind: "pitcher",
      recentForm: pitcherRecentFormById.get(id) ?? undefined,
      homeAway: pitcherHomeAwayById.get(id) ?? undefined,
      isHome: pitcherIsHomeById.get(id),
    });
  }
  for (const id of batterIds) {
    const m = batterMatchupById.get(id);
    if (m) {
      matchupById.set(id, { kind: "batter", vsPitcher: m.vsPitcher, platoon: m.platoon, vsHand: m.vsHand });
    }
  }

  const scoredByTeam = new Map<number, ScoredProp[]>([
    [feed.away.team.id, []],
    [feed.home.team.id, []],
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
    buildTeamGroup(feed.away.team, scoredByTeam.get(feed.away.team.id) ?? []),
    buildTeamGroup(feed.home.team, scoredByTeam.get(feed.home.team.id) ?? []),
  ].filter((g) => g.players.length > 0);

  return <PropsSidebar groups={groups} />;
}
