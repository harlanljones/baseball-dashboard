import { mlbFetch, TTL } from "./client";
import type {
  PlayerRef,
  SaberHitting,
  SaberPitching,
  VsPlayerLine,
} from "./types";

// --- Raw stats shapes --------------------------------------------------------

interface RawStatSplit {
  stat?: Record<string, unknown>;
  batter?: { id: number; fullName: string };
  pitcher?: { id: number; fullName: string };
}

interface RawStatGroup {
  type?: { displayName?: string };
  group?: { displayName?: string };
  splits?: RawStatSplit[];
}

interface RawStatsResponse {
  stats?: RawStatGroup[];
}

function pickGroup(
  res: RawStatsResponse,
  type: string,
): Record<string, unknown> | undefined {
  const group = res.stats?.find((g) => g.type?.displayName === type);
  return group?.splits?.[0]?.stat;
}

function n(v: unknown): number | undefined {
  if (v == null) return undefined;
  const parsed = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function s(v: unknown): string | undefined {
  return v == null || v === "" ? undefined : String(v);
}

// --- Sabermetrics ------------------------------------------------------------

/**
 * Hitter sabermetrics (wOBA / wRC+ / WAR) plus BABIP, which lives in the plain
 * season group rather than the sabermetrics group — so we fetch both at once.
 */
export async function getSaberHitting(
  personId: number,
  season: number,
): Promise<SaberHitting | null> {
  const res = await mlbFetch<RawStatsResponse>(
    `/api/v1/people/${personId}/stats`,
    { stats: "sabermetrics,season", group: "hitting", season },
    TTL.playerStats,
  );
  const saber = pickGroup(res, "sabermetrics");
  const seasonStat = pickGroup(res, "season");
  if (!saber && !seasonStat) return null;
  return {
    woba: n(saber?.woba),
    wrcPlus: n(saber?.wRcPlus),
    war: n(saber?.war),
    babip: s(seasonStat?.babip),
  };
}

/** Pitcher sabermetrics (WAR / FIP / xFIP / ERA-). */
export async function getSaberPitching(
  personId: number,
  season: number,
): Promise<SaberPitching | null> {
  const res = await mlbFetch<RawStatsResponse>(
    `/api/v1/people/${personId}/stats`,
    { stats: "sabermetrics", group: "pitching", season },
    TTL.playerStats,
  );
  const saber = pickGroup(res, "sabermetrics");
  if (!saber) return null;
  return {
    war: n(saber.war),
    fip: n(saber.fip),
    xfip: n(saber.xfip),
    eraMinus: n(saber.eraMinus),
  };
}

// --- Batter vs pitcher -------------------------------------------------------

/**
 * Career batter-vs-pitcher line. A pairing that has never met returns a row
 * with `hasHistory: false` (rendered as an em-dash line) — that is expected,
 * not an error.
 */
export async function getVsPlayer(
  batter: PlayerRef,
  pitcher: PlayerRef,
): Promise<VsPlayerLine> {
  const res = await mlbFetch<RawStatsResponse>(
    `/api/v1/people/${batter.id}/stats`,
    {
      stats: "vsPlayer",
      group: "hitting",
      opposingPlayerId: pitcher.id,
    },
    TTL.playerStats,
  );

  const stat = res.stats?.[0]?.splits?.find(
    (sp) => sp.stat?.plateAppearances != null,
  )?.stat;

  if (!stat) {
    return {
      batter,
      pitcher,
      hasHistory: false,
      pa: 0,
      h: 0,
      hr: 0,
      bb: 0,
      k: 0,
      avg: "-",
      obp: "-",
      slg: "-",
    };
  }

  return {
    batter,
    pitcher,
    hasHistory: true,
    pa: n(stat.plateAppearances) ?? 0,
    h: n(stat.hits) ?? 0,
    hr: n(stat.homeRuns) ?? 0,
    bb: n(stat.baseOnBalls) ?? 0,
    k: n(stat.strikeOuts) ?? 0,
    avg: s(stat.avg) ?? "-",
    obp: s(stat.obp) ?? "-",
    slg: s(stat.slg) ?? "-",
  };
}

// --- Roster proxy (Preview games) --------------------------------------------

interface RawRosterEntry {
  person: {
    id: number;
    fullName: string;
    stats?: RawStatGroup[];
  };
  position?: { type?: string };
}

interface RawRosterResponse {
  roster?: RawRosterEntry[];
}

/** A likely-starting hitter, used to proxy a lineup before it is posted. */
export interface RosterHitter {
  player: PlayerRef;
  pa: number;
}

/**
 * Active-roster position players hydrated with season hitting stats, sorted by
 * plate appearances (descending). Used as a proxy lineup for Preview games,
 * whose real batting order is not yet available.
 */
export async function getRosterWithSeasonStats(
  teamId: number,
  season: number,
): Promise<RosterHitter[]> {
  const res = await mlbFetch<RawRosterResponse>(
    `/api/v1/teams/${teamId}/roster`,
    {
      rosterType: "active",
      hydrate: `person(stats(type=season,season=${season},group=hitting))`,
    },
    TTL.roster,
  );

  const hitters: RosterHitter[] = [];
  for (const entry of res.roster ?? []) {
    if (entry.position?.type === "Pitcher") continue;
    const stat = entry.person.stats?.[0]?.splits?.[0]?.stat;
    hitters.push({
      player: { id: entry.person.id, fullName: entry.person.fullName },
      pa: n(stat?.plateAppearances) ?? 0,
    });
  }

  hitters.sort((a, b) => b.pa - a.pa);
  return hitters;
}
