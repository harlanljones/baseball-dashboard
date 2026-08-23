import type { GameFeed, SaberHitting, SaberPitching, TeamRef } from "@/lib/mlb/types";
import { MlbApiError } from "@/lib/mlb/client";
import { getLiveFeed, seasonOf } from "@/lib/mlb/game";
import {
  getActiveRoster,
  getSaberHittingBatch,
  getSaberPitchingWithSeasonStatsBatch,
  type RosterPlayer,
} from "@/lib/mlb/players";

// --- Payload shapes -----------------------------------------------------------

interface PlayerWithStats {
  player: { id: number; fullName: string };
  position: string;
  stats: SaberHitting | SaberPitching | null;
}

export interface TeamStatsPayload {
  team: TeamRef;
  /** `null` when the active roster itself could not be loaded. */
  hitters: PlayerWithStats[] | null;
  pitchers: PlayerWithStats[] | null;
}

/**
 * Season sabermetric lines for both teams' active rosters.
 *
 * Served separately from the page render so its upstream fan-out gets a
 * dedicated Workers invocation — the game page's own render already spends
 * close to the platform's per-invocation subrequest budget, which is what
 * knocked this section out when it streamed inline.
 */

// --- Roster enrichment (mirrors the former inline server section) --------------

function normalizePosition(rosterPos: string, role?: string): string {
  // Pitchers are split into SP / RP based on their roster role.
  if (rosterPos === "Pitcher") {
    return role && /start/i.test(role) ? "SP" : "RP";
  }

  // Map API position names to MLB abbreviations
  const posMap: Record<string, string> = {
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

// Spec position order: SP, RP, C, 1B, 2B, 3B, SS, LF, CF, RF (others trail).
const POSITION_ORDER = [
  "SP",
  "RP",
  "C",
  "1B",
  "2B",
  "3B",
  "SS",
  "LF",
  "CF",
  "RF",
];

function positionRank(pos: string): number {
  const idx = POSITION_ORDER.indexOf(pos);
  return idx === -1 ? POSITION_ORDER.length : idx;
}

async function safe<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch {
    return null;
  }
}

async function enrichRoster(
  roster: RosterPlayer[],
  season: number,
  isHitter: boolean,
): Promise<PlayerWithStats[]> {
  const ids = roster.map((r) => r.player.id);

  // One batched request per stat group instead of one per player.
  const statsById = await safe(
    isHitter
      ? getSaberHittingBatch(ids, season)
      : getSaberPitchingWithSeasonStatsBatch(ids, season),
  );
  if (!statsById) return [];

  const enriched: PlayerWithStats[] = [];
  for (const { player, position, role } of roster) {
    const stats = statsById.get(player.id);
    if (stats) {
      enriched.push({
        player,
        position: normalizePosition(position, role),
        stats,
      });
    }
  }

  // Sort by spec position order (SP, RP, C, 1B, 2B, 3B, SS, LF, CF, RF).
  enriched.sort((a, b) => positionRank(a.position) - positionRank(b.position));

  return enriched;
}

async function teamStats(
  team: TeamRef,
  season: number,
): Promise<TeamStatsPayload> {
  const roster = await safe(getActiveRoster(team.id));
  if (!roster || roster.length === 0) {
    return { team, hitters: null, pitchers: null };
  }

  const hitterRoster = roster.filter((p) => p.position !== "Pitcher");
  const pitcherRoster = roster.filter((p) => p.position === "Pitcher");

  const [hitters, pitchers] = await Promise.all([
    enrichRoster(hitterRoster, season, true),
    enrichRoster(pitcherRoster, season, false),
  ]);

  return { team, hitters, pitchers };
}

// --- Handler --------------------------------------------------------------------

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ gamePk: string }> },
) {
  const { gamePk } = await params;
  const id = Number(gamePk);
  if (!Number.isInteger(id) || id <= 0) {
    return Response.json({ error: "Invalid gamePk" }, { status: 400 });
  }

  try {
    const feed: GameFeed = await getLiveFeed(id);
    const [away, home] = await Promise.all([
      teamStats(feed.away.team, seasonOf(feed)),
      teamStats(feed.home.team, seasonOf(feed)),
    ]);
    return Response.json(
      { away, home },
      {
        headers: {
          // Season stats barely move intraday; keep repeat views cheap.
          "Cache-Control": "public, max-age=300, stale-while-revalidate=21600",
        },
      },
    );
  } catch (e) {
    if (e instanceof MlbApiError && e.status === 404) {
      return Response.json({ error: "Game not found" }, { status: 404 });
    }
    return Response.json({ error: "Upstream MLB API failure" }, { status: 502 });
  }
}
