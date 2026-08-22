import ProbableStarterCard from "./ProbableStarterCard";
import { easternDateOf } from "@/lib/mlb/client";
import {
  getPitchHand,
  getPitcherSituationalSplitBatch,
  getPitcherRecentFormBatch,
  getSaberPitchingWithSeasonStatsBatch,
} from "@/lib/mlb/players";
import type {
  GameFeed,
  PitcherRecentForm,
  PitcherSplitLine,
  PlayerRef,
  SaberPitching,
  TeamRef,
} from "@/lib/mlb/types";

async function safe<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch {
    return null;
  }
}

interface StarterData {
  hand: "L" | "R" | null;
  seasonStats: SaberPitching | null;
  homeAway: PitcherSplitLine | null;
  vsLeft: PitcherSplitLine | null;
  vsRight: PitcherSplitLine | null;
  recentForm: PitcherRecentForm | null;
}

const NO_DATA: StarterData = {
  hand: null,
  seasonStats: null,
  homeAway: null,
  vsLeft: null,
  vsRight: null,
  recentForm: null,
};

function StarterCard({
  pitcher,
  team,
  isHome,
  data,
}: {
  pitcher: PlayerRef | undefined;
  team: TeamRef;
  isHome: boolean;
  data: StarterData;
}) {
  return (
    <ProbableStarterCard
      pitcher={pitcher ?? null}
      team={team}
      hand={data.hand}
      season={data.seasonStats}
      homeAway={data.homeAway}
      vsLeft={data.vsLeft}
      vsRight={data.vsRight}
      recentForm={data.recentForm}
      homeAwayLabel={isHome ? "Home" : "Road"}
    />
  );
}

export default async function ProbableStartersSection({
  feed,
  season,
}: {
  feed: GameFeed;
  season: number;
}) {
  const away = feed.probablePitchers.away;
  const home = feed.probablePitchers.home;

  if (!away && !home) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <StarterCard pitcher={undefined} team={feed.away.team} isHome={false} data={NO_DATA} />
        <StarterCard pitcher={undefined} team={feed.home.team} isHome={true} data={NO_DATA} />
      </div>
    );
  }

  const ids = [away?.id, home?.id].filter((id): id is number => id != null);

  // Batched upstream lookups — one request per split/stat group for both
  // starters instead of ~6 per card.
  const [seasonStatsById, recentFormById, vsLeftById, vsRightById, homeAwayMaps] =
    await Promise.all([
      safe(getSaberPitchingWithSeasonStatsBatch(ids, season)),
      safe(getPitcherRecentFormBatch(ids, easternDateOf(feed.startTime || new Date()))),
      safe(getPitcherSituationalSplitBatch(ids, "vl", season)),
      safe(getPitcherSituationalSplitBatch(ids, "vr", season)),
      Promise.all(
        [true, false].map(async (isHome) => {
          const sideIds = [away, home]
            .filter((p): p is PlayerRef => p != null)
            .map((p) => p.id)
            .filter((id) => (isHome ? id === home?.id : id === away?.id));
          return sideIds.length > 0
            ? ((await safe(getPitcherSituationalSplitBatch(sideIds, isHome ? "h" : "a", season))) ??
                new Map<number, PitcherSplitLine>())
            : new Map<number, PitcherSplitLine>();
        }),
      ).then(([roadMap, homeMap]) => new Map([...roadMap, ...homeMap])),
    ]);

  async function dataFor(pitcher: PlayerRef | undefined): Promise<StarterData> {
    if (!pitcher) return NO_DATA;
    const [hand] = await Promise.all([safe(getPitchHand(pitcher.id))]);
    return {
      hand,
      seasonStats: seasonStatsById?.get(pitcher.id) ?? null,
      homeAway: homeAwayMaps.get(pitcher.id) ?? null,
      vsLeft: vsLeftById?.get(pitcher.id) ?? null,
      vsRight: vsRightById?.get(pitcher.id) ?? null,
      recentForm: recentFormById?.get(pitcher.id) ?? null,
    };
  }

  const [awayData, homeData] = await Promise.all([dataFor(away), dataFor(home)]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <StarterCard pitcher={away} team={feed.away.team} isHome={false} data={awayData} />
      <StarterCard pitcher={home} team={feed.home.team} isHome={true} data={homeData} />
    </div>
  );
}
