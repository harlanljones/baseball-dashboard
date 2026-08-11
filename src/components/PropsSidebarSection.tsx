import type { GameFeed, PlayerRef, TeamRef } from "@/lib/mlb/types";
import type { GameWeather } from "@/lib/weather/types";
import { findOddsEvent } from "@/lib/odds/events";
import { getPlayerProps } from "@/lib/odds/props";
import { matchPlayerName } from "@/lib/odds/playerMatch";
import { scoreProp, type StatContext } from "@/lib/odds/highlight";
import type { PlayerProp, ScoredProp } from "@/lib/odds/types";
import {
  getRosterWithSeasonStats,
  getPitcherPropStats,
  getSeasonHittingBasic,
} from "@/lib/mlb/players";
import PropsSidebar, { type PropTeamGroup } from "./PropsSidebar";

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

  const groups: PropTeamGroup[] = [
    { team: feed.away.team, props: scoredByTeam.get(feed.away.team.id) ?? [] },
    { team: feed.home.team, props: scoredByTeam.get(feed.home.team.id) ?? [] },
  ].filter((g) => g.props.length > 0);

  return <PropsSidebar groups={groups} />;
}
