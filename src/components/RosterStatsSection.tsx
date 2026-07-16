import type { GameFeed, SaberHitting, SaberPitching, TeamRef } from "@/lib/mlb/types";
import {
  getActiveRoster,
  getSaberHitting,
  getSaberPitchingWithSeasonStats,
  type RosterPlayer,
} from "@/lib/mlb/players";
import RosterStatsTable from "./RosterStatsTable";

async function safe<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch {
    return null;
  }
}

function normalizePosition(rosterPos: string): string {
  // Map API position names to MLB abbreviations
  const posMap: Record<string, string> = {
    Pitcher: "RP", // Default pitchers to RP; SP will be inferred from role if needed
    Catcher: "C",
    "First Baseman": "1B",
    "Second Baseman": "2B",
    "Third Baseman": "3B",
    Shortstop: "SS",
    "Left Fielder": "LF",
    "Center Fielder": "CF",
    "Right Fielder": "RF",
    "Designated Hitter": "DH",
    Outfielder: "OF",
    Infielder: "IF",
  };
  return posMap[rosterPos] ?? rosterPos; // Fallback to original if no mapping
}

interface PlayerWithStats {
  player: { id: number; fullName: string };
  position: string;
  stats: SaberHitting | SaberPitching | null;
}

async function enrichRoster(
  roster: RosterPlayer[],
  season: number,
  isHitter: boolean,
): Promise<PlayerWithStats[]> {
  const enriched: PlayerWithStats[] = [];

  const results = await Promise.allSettled(
    roster.map(async (r) => {
      if (isHitter) {
        const stats = await safe(getSaberHitting(r.player.id, season));
        return { ...r, stats };
      } else {
        const stats = await safe(
          getSaberPitchingWithSeasonStats(r.player.id, season),
        );
        return { ...r, stats };
      }
    }),
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      const { player, position, stats } = result.value;
      // Only include players with stats
      if (stats) {
        enriched.push({
          player,
          position: normalizePosition(position),
          stats,
        });
      }
    }
  }

  return enriched;
}

async function TeamRoster({
  team,
  season,
}: {
  team: TeamRef;
  season: number;
}) {
  const roster = await safe(getActiveRoster(team.id));
  if (!roster || roster.length === 0) {
    return <p className="text-ink/50 text-sm">No roster data available.</p>;
  }

  // Split into hitters and pitchers
  const hitterRoster = roster.filter((p) => p.position !== "Pitcher");
  const pitcherRoster = roster.filter((p) => p.position === "Pitcher");

  // Fetch stats in parallel for hitters and pitchers
  const [hitters, pitchers] = await Promise.all([
    enrichRoster(hitterRoster, season, true),
    enrichRoster(pitcherRoster, season, false),
  ]);

  if (hitters.length === 0 && pitchers.length === 0) {
    return (
      <p className="text-ink/50 text-sm">No season stats available for this team.</p>
    );
  }

  return <RosterStatsTable team={team} hitters={hitters} pitchers={pitchers} />;
}

export default async function RosterStatsSection({
  feed,
  season,
}: {
  feed: GameFeed;
  season: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <TeamRoster team={feed.away.team} season={season} />
      <TeamRoster team={feed.home.team} season={season} />
    </div>
  );
}
