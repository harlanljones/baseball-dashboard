import ProbableStarterCard from "./ProbableStarterCard";
import { easternDateOf } from "@/lib/mlb/client";
import {
  getPitcherHomeAwaySplit,
  getPitcherPlatoonSplit,
  getPitcherRecentForm,
  getPitchHand,
  getSaberPitchingWithSeasonStats,
} from "@/lib/mlb/players";
import type { GameFeed, PlayerRef, TeamRef } from "@/lib/mlb/types";

async function safe<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch {
    return null;
  }
}

function settled<T>(r: PromiseSettledResult<T>): T | null {
  return r.status === "fulfilled" ? r.value : null;
}

async function StarterCard({
  pitcher,
  team,
  isHome,
  season,
  gameDate,
}: {
  pitcher: PlayerRef | undefined;
  team: TeamRef;
  isHome: boolean;
  season: number;
  gameDate: string;
}) {
  if (!pitcher) {
    return (
      <ProbableStarterCard
        pitcher={null}
        team={team}
        hand={null}
        season={null}
        homeAway={null}
        vsLeft={null}
        vsRight={null}
        recentForm={null}
        homeAwayLabel={isHome ? "Home" : "Road"}
      />
    );
  }

  const [seasonStats, hand, splitResults] = await Promise.all([
    safe(getSaberPitchingWithSeasonStats(pitcher.id, season)),
    safe(getPitchHand(pitcher.id)),
    Promise.allSettled([
      getPitcherHomeAwaySplit(pitcher.id, isHome, season),
      getPitcherPlatoonSplit(pitcher.id, "L", season),
      getPitcherPlatoonSplit(pitcher.id, "R", season),
      getPitcherRecentForm(pitcher.id, gameDate),
    ]),
  ]);

  const [homeAway, vsLeft, vsRight, recentForm] = splitResults;

  return (
    <ProbableStarterCard
      pitcher={pitcher}
      team={team}
      hand={hand}
      season={seasonStats}
      homeAway={settled(homeAway)}
      vsLeft={settled(vsLeft)}
      vsRight={settled(vsRight)}
      recentForm={settled(recentForm)}
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
  const gameDate = easternDateOf(feed.startTime || new Date());
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <StarterCard
        pitcher={feed.probablePitchers.away}
        team={feed.away.team}
        isHome={false}
        season={season}
        gameDate={gameDate}
      />
      <StarterCard
        pitcher={feed.probablePitchers.home}
        team={feed.home.team}
        isHome={true}
        season={season}
        gameDate={gameDate}
      />
    </div>
  );
}
