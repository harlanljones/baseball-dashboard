import { mlbFetch, shiftDate, TTL } from "./client";
import type {
  PlayerRef,
  SaberHitting,
  SaberPitching,
  SplitLine,
  VsPlayerLine,
  VsPlayerSeasonLine,
} from "./types";

// --- Raw stats shapes --------------------------------------------------------

interface RawStatSplit {
  stat?: Record<string, unknown>;
  batter?: { id: number; fullName: string };
  pitcher?: { id: number; fullName: string };
  /** Present on `vsPlayer` (per-season breakdown) splits; absent on `vsPlayerTotal`. */
  season?: string;
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

/** Splits for a named stat group (e.g. `vsPlayer`'s per-season breakdown). */
function pickGroupSplits(
  res: RawStatsResponse,
  type: string,
): RawStatSplit[] | undefined {
  return res.stats?.find((g) => g.type?.displayName === type)?.splits;
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

function parseVsPlayerStat(
  stat?: Record<string, unknown>,
): Omit<VsPlayerLine, "batter" | "pitcher"> {
  if (!stat) {
    return { hasHistory: false, pa: 0, h: 0, hr: 0, bb: 0, k: 0, avg: "-", obp: "-", slg: "-" };
  }
  return {
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

/**
 * Fetches the raw `vsPlayer` response once. The MLB Stats API's `season` query
 * param has no filtering effect on this stat type — every call returns the
 * same two groups regardless of what (or whether) a season is passed: a
 * `vsPlayerTotal` group (one split, the full career line) and a `vsPlayer`
 * group (one split per season the pair has actually met, each carrying its
 * own `season` field). The two groups' order in `stats[]` is not stable, so
 * callers must select by `type.displayName`, never by array position.
 */
async function fetchVsPlayer(
  batter: PlayerRef,
  pitcher: PlayerRef,
): Promise<RawStatsResponse> {
  return mlbFetch<RawStatsResponse>(
    `/api/v1/people/${batter.id}/stats`,
    {
      stats: "vsPlayer",
      group: "hitting",
      opposingPlayerId: pitcher.id,
    },
    TTL.playerStats,
  );
}

/**
 * Career batter-vs-pitcher line. A pairing that has never met returns a row
 * with `hasHistory: false` (rendered as an em-dash line) — that is expected,
 * not an error.
 */
export async function getVsPlayer(
  batter: PlayerRef,
  pitcher: PlayerRef,
): Promise<VsPlayerLine> {
  const res = await fetchVsPlayer(batter, pitcher);
  const stat = pickGroup(res, "vsPlayerTotal");
  return { batter, pitcher, ...parseVsPlayerStat(stat) };
}

/**
 * Season-by-season batter-vs-pitcher history (the MLB Stats API has no
 * per-plate-appearance "vs one pitcher" log, only per-season aggregates).
 * One request returns the full breakdown regardless of `seasons` — see
 * {@link fetchVsPlayer} — so each requested year is matched against the
 * breakdown split whose own `season` field equals it. Years with no plate
 * appearances against that pitcher are dropped.
 */
export async function getVsPlayerSeasons(
  batter: PlayerRef,
  pitcher: PlayerRef,
  seasons: number[],
): Promise<VsPlayerSeasonLine[]> {
  const res = await fetchVsPlayer(batter, pitcher);
  const breakdown = pickGroupSplits(res, "vsPlayer") ?? [];

  return seasons
    .map((season) => {
      const stat = breakdown.find((sp) => sp.season === String(season))?.stat;
      return { batter, pitcher, season, ...parseVsPlayerStat(stat) };
    })
    .filter((line) => line.hasHistory)
    .sort((a, b) => b.season - a.season);
}

/** A percentage rate formatted like `"8.5%"`, or `"-"` when there's no denominator. */
function pct(part: number | undefined, whole: number): string {
  if (!whole) return "-";
  return `${(((part ?? 0) / whole) * 100).toFixed(1)}%`;
}

function parseSplitStat(stat?: Record<string, unknown>): SplitLine {
  const pa = n(stat?.plateAppearances) ?? 0;
  return {
    pa,
    obp: s(stat?.obp) ?? "-",
    ops: s(stat?.ops) ?? "-",
    bbPct: pct(n(stat?.baseOnBalls), pa),
    kPct: pct(n(stat?.strikeOuts), pa),
  };
}

/**
 * A batter's current-season rate line for one MLB Stats API `sitCodes` split
 * (e.g. `vl`/`vr` for platoon, `h`/`a` for home/road).
 */
async function fetchSituationalSplit(
  batter: PlayerRef,
  sitCode: string,
  season: number,
): Promise<SplitLine> {
  const res = await mlbFetch<RawStatsResponse>(
    `/api/v1/people/${batter.id}/stats`,
    { stats: "statSplits", sitCodes: sitCode, group: "hitting", season },
    TTL.playerStats,
  );
  return parseSplitStat(res.stats?.[0]?.splits?.[0]?.stat);
}

/**
 * A batter's current-season line against pitchers throwing `vsHand`. Used for
 * the game page's platoon split, alongside (not instead of) the head-to-head
 * `vsPlayer` line — a batter can have no history against today's specific
 * pitcher but a well-established platoon split against that arm side.
 */
export async function getPlatoonSplit(
  batter: PlayerRef,
  vsHand: "L" | "R",
  season: number,
): Promise<SplitLine> {
  return fetchSituationalSplit(batter, vsHand === "L" ? "vl" : "vr", season);
}

/**
 * A batter's current-season home or road split. Used in place of the
 * vs-pitcher matchup table when no probable starter has been announced yet.
 */
export async function getHomeAwaySplit(
  batter: PlayerRef,
  isHome: boolean,
  season: number,
): Promise<SplitLine> {
  return fetchSituationalSplit(batter, isHome ? "h" : "a", season);
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

// --- Bullpen workload ---------------------------------------------------------

interface RawGameLogSplit {
  date?: string;
  stat?: Record<string, unknown>;
}

interface RawGameLogResponse {
  stats?: { splits?: RawGameLogSplit[] }[];
}

/**
 * Recent pitch-count workload for a set of bullpen arms, derived from each
 * pitcher's `gameLog` splits (there's no direct "recent workload" stat).
 * `asOfDate` is the game's date (`YYYY-MM-DD`, Eastern) — the window looks back
 * from the day before it, since bullpen arms haven't pitched in today's game yet.
 * Individual pitcher lookups fail independently so one bad id doesn't drop the rest.
 */
export async function getBullpenWorkload(
  pitcherIds: number[],
  season: number,
  asOfDate: string,
): Promise<Map<number, { yesterday: number; last3: number }>> {
  const yesterday = shiftDate(asOfDate, -1);
  const windowStart = shiftDate(asOfDate, -3);

  const settled = await Promise.allSettled(
    pitcherIds.map(async (id) => {
      const res = await mlbFetch<RawGameLogResponse>(
        `/api/v1/people/${id}/stats`,
        // gameLog defaults to gameType=R (regular season) only, so a reliever's
        // postseason outings otherwise vanish from the recent-workload window.
        { stats: "gameLog", group: "pitching", season, gameType: "R,F,D,L,W" },
        TTL.pitcherLog,
      );
      const splits = res.stats?.[0]?.splits ?? [];
      let yesterdayPitches = 0;
      let last3Pitches = 0;
      for (const split of splits) {
        if (!split.date || split.date < windowStart || split.date > yesterday) continue;
        const pitches = n(split.stat?.numberOfPitches) ?? 0;
        last3Pitches += pitches;
        if (split.date === yesterday) yesterdayPitches += pitches;
      }
      return [id, { yesterday: yesterdayPitches, last3: last3Pitches }] as const;
    }),
  );

  const workload = new Map<number, { yesterday: number; last3: number }>();
  for (const r of settled) {
    if (r.status === "fulfilled") workload.set(r.value[0], r.value[1]);
  }
  return workload;
}

/**
 * Real season pitching lines for a set of bullpen arms, fetched per-pitcher
 * from `/people/{id}/stats`. The `feed/live` boxscore's embedded
 * `seasonStats.pitching` looks like a season line but, for `Preview`-state
 * games, MLB's API only populates it for the two probable starters — every
 * other bullpen pitcher gets a zeroed stub. This hits the same reliable
 * per-player endpoint `getSaberPitching`/`getRosterWithSeasonStats` already
 * use instead of trusting that embedded field. Individual pitcher lookups
 * fail independently so one bad id doesn't drop the rest.
 */
export async function getBullpenSeasonPitching(
  pitcherIds: number[],
  season: number,
): Promise<Map<number, { ip: string; era: string; whip: string; k: number }>> {
  const settled = await Promise.allSettled(
    pitcherIds.map(async (id) => {
      const res = await mlbFetch<RawStatsResponse>(
        `/api/v1/people/${id}/stats`,
        { stats: "season", group: "pitching", season },
        TTL.playerStats,
      );
      const stat = res.stats?.[0]?.splits?.[0]?.stat;
      return [
        id,
        {
          ip: s(stat?.inningsPitched) ?? "0.0",
          era: s(stat?.era) ?? "-.--",
          whip: s(stat?.whip) ?? "-",
          k: n(stat?.strikeOuts) ?? 0,
        },
      ] as const;
    }),
  );

  const stats = new Map<number, { ip: string; era: string; whip: string; k: number }>();
  for (const r of settled) {
    if (r.status === "fulfilled") stats.set(r.value[0], r.value[1]);
  }
  return stats;
}

/** A single person's ref, used for the vs-pitcher drill-down page header. */
export async function getPerson(id: number): Promise<PlayerRef | null> {
  const res = await mlbFetch<{ people?: { id: number; fullName: string }[] }>(
    `/api/v1/people/${id}`,
    {},
    TTL.roster,
  );
  const person = res.people?.[0];
  return person ? { id: person.id, fullName: person.fullName } : null;
}

/** A pitcher's throwing hand, used to pick the batter platoon split to show. */
export async function getPitchHand(id: number): Promise<"L" | "R" | null> {
  const res = await mlbFetch<{ people?: { pitchHand?: { code?: string } }[] }>(
    `/api/v1/people/${id}`,
    {},
    TTL.roster,
  );
  const code = res.people?.[0]?.pitchHand?.code;
  return code === "L" || code === "R" ? code : null;
}
