import { MlbApiError, mlbFetch, shiftDate, TTL } from "./client";
import type {
  PitcherRecentForm,
  PitcherSplitLine,
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

// --- Batched people-stats lookups ---------------------------------------------
//
// The game page fans out dozens of per-player stat lookups, and Workers
// environments cap subrequests per invocation (50 on the free plan). Anything
// batchable therefore goes through `/api/v1/people?personIds=...&hydrate=...`:
// one request per distinct query for many players at once.
//
// Verified statsapi.mlb.com behaviors this relies on:
// - `personIds` accepts a comma-separated list on /api/v1/people and is honored.
// - `hydrate=stats(type=<t>,group=<g>,...)` supports types: `season`,
//   `sabermetrics`, `statSplits`, `vsPlayer`, `gameLog`.
// - Only the FIRST `sitCodes` value is honored — one request per split code.
// - A `vsPlayer` hydrate returns both the `vsPlayerTotal` (career) group and
//   the per-season `vsPlayer` breakdown for every requested batter.

interface RawPersonEntry {
  id?: number;
  fullName?: string;
  stats?: RawStatGroup[];
}

interface RawPeopleResponse {
  people?: RawPersonEntry[];
}

const PEOPLE_BATCH_SIZE = 25;

async function fetchPeopleStats(
  personIds: number[],
  hydrate: string,
  ttl: number = TTL.playerStats,
): Promise<Map<number, RawStatGroup[]>> {
  const unique = [...new Set(personIds)].filter(
    (id) => Number.isInteger(id) && id > 0,
  );
  const byId = new Map<number, RawStatGroup[]>();
  for (let i = 0; i < unique.length; i += PEOPLE_BATCH_SIZE) {
    const chunk = unique.slice(i, i + PEOPLE_BATCH_SIZE);
    const res = await mlbFetch<RawPeopleResponse>(
      "/api/v1/people",
      { personIds: chunk.join(","), hydrate },
      ttl,
    );
    for (const person of res.people ?? []) {
      if (person.id != null) byId.set(person.id, person.stats ?? []);
    }
  }
  return byId;
}

// --- Sabermetrics ------------------------------------------------------------

/**
 * Hitter sabermetrics (wOBA / wRC+ / WAR) plus BABIP and season stats (PA, BB%, K%).
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

  const pa = n(seasonStat?.plateAppearances) ?? 0;
  const bb = n(seasonStat?.baseOnBalls) ?? 0;
  const k = n(seasonStat?.strikeOuts) ?? 0;

  return {
    woba: n(saber?.woba),
    wrcPlus: n(saber?.wRcPlus),
    war: n(saber?.war),
    babip: s(seasonStat?.babip),
    pa,
    bbPct: pct(bb, pa),
    kPct: pct(k, pa),
    xwoba: n(saber?.xwoba),
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

/**
 * Pitcher sabermetrics (WAR / FIP / xFIP / ERA-) plus season stats (IP / ERA / BB% / K%).
 */
export async function getSaberPitchingWithSeasonStats(
  personId: number,
  season: number,
): Promise<SaberPitching | null> {
  const res = await mlbFetch<RawStatsResponse>(
    `/api/v1/people/${personId}/stats`,
    { stats: "sabermetrics,season", group: "pitching", season },
    TTL.playerStats,
  );
  const saber = pickGroup(res, "sabermetrics");
  const seasonStat = pickGroup(res, "season");
  if (!saber && !seasonStat) return null;

  const bb = n(seasonStat?.baseOnBalls) ?? 0;
  const k = n(seasonStat?.strikeOuts) ?? 0;
  const bf = n(seasonStat?.battersFaced) ?? 1; // Avoid division by zero

  const bbPctVal = bf > 0 ? bb / bf : 0;
  const kPctVal = bf > 0 ? k / bf : 0;

  return {
    war: n(saber?.war),
    fip: n(saber?.fip),
    xfip: n(saber?.xfip),
    eraMinus: n(saber?.eraMinus),
    ip: s(seasonStat?.inningsPitched),
    era: s(seasonStat?.era),
    bbPct: pct(bb, bf),
    kPct: pct(k, bf),
    kMinusBbPct: kPctVal - bbPctVal, // Raw decimal for sorting
  };
}

/**
 * Batched {@link getSaberHitting}: one request per stat group for the whole
 * set of hitters. Players without a usable record are simply absent from the
 * returned map (callers treat a miss like the single-player `null`).
 */
export async function getSaberHittingBatch(
  personIds: number[],
  season: number,
): Promise<Map<number, SaberHitting>> {
  const [saberById, seasonById] = await Promise.all([
    fetchPeopleStats(personIds, `stats(type=sabermetrics,season=${season},group=hitting)`),
    fetchPeopleStats(personIds, `stats(type=season,season=${season},group=hitting)`),
  ]);

  const byId = new Map<number, SaberHitting>();
  for (const [id, groups] of seasonById) {
    const saber = pickGroup({ stats: saberById.get(id) ?? [] }, "sabermetrics");
    const seasonStat = pickGroup({ stats: groups }, "season");
    if (!saber && !seasonStat) continue;

    const pa = n(seasonStat?.plateAppearances) ?? 0;
    const bb = n(seasonStat?.baseOnBalls) ?? 0;
    const k = n(seasonStat?.strikeOuts) ?? 0;

    byId.set(id, {
      woba: n(saber?.woba),
      wrcPlus: n(saber?.wRcPlus),
      war: n(saber?.war),
      babip: s(seasonStat?.babip),
      pa,
      bbPct: pct(bb, pa),
      kPct: pct(k, pa),
      xwoba: n(saber?.xwoba),
    });
  }
  return byId;
}

/**
 * Batched {@link getSaberPitchingWithSeasonStats}: one request per stat group
 * for the whole set of pitchers.
 */
export async function getSaberPitchingWithSeasonStatsBatch(
  personIds: number[],
  season: number,
): Promise<Map<number, SaberPitching>> {
  const [saberById, seasonById] = await Promise.all([
    fetchPeopleStats(personIds, `stats(type=sabermetrics,season=${season},group=pitching)`),
    fetchPeopleStats(personIds, `stats(type=season,season=${season},group=pitching)`),
  ]);

  const byId = new Map<number, SaberPitching>();
  for (const [id, groups] of seasonById) {
    const saber = pickGroup({ stats: saberById.get(id) ?? [] }, "sabermetrics");
    const seasonStat = pickGroup({ stats: groups }, "season");
    if (!saber && !seasonStat) continue;

    const bb = n(seasonStat?.baseOnBalls) ?? 0;
    const k = n(seasonStat?.strikeOuts) ?? 0;
    const bf = n(seasonStat?.battersFaced) ?? 1; // Avoid division by zero

    const bbPctVal = bf > 0 ? bb / bf : 0;
    const kPctVal = bf > 0 ? k / bf : 0;

    byId.set(id, {
      war: n(saber?.war),
      fip: n(saber?.fip),
      xfip: n(saber?.xfip),
      eraMinus: n(saber?.eraMinus),
      ip: s(seasonStat?.inningsPitched),
      era: s(seasonStat?.era),
      bbPct: pct(bb, bf),
      kPct: pct(k, bf),
      kMinusBbPct: kPctVal - bbPctVal, // Raw decimal for sorting
    });
  }
  return byId;
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

const EMPTY_SPLIT: SplitLine = { pa: 0, obp: "-", ops: "-", bbPct: "-", kPct: "-" };

/**
 * Batched {@link getVsPlayer}: career lines for many batters against one
 * pitcher in a single request.
 */
export async function getVsPlayerBatch(
  batters: PlayerRef[],
  pitcher: PlayerRef,
): Promise<Map<number, VsPlayerLine>> {
  if (batters.length === 0) return new Map();
  const statsById = await fetchPeopleStats(
    batters.map((b) => b.id),
    `stats(type=vsPlayer,opposingPlayerId=${pitcher.id},group=hitting)`,
  );

  const byId = new Map<number, VsPlayerLine>();
  for (const batter of batters) {
    const groups = statsById.get(batter.id) ?? [];
    const total = pickGroup({ stats: groups }, "vsPlayerTotal");
    byId.set(batter.id, { batter, pitcher, ...parseVsPlayerStat(total) });
  }
  return byId;
}

/**
 * Batched {@link getPlatoonSplit}: one request for every batter's line against
 * a single arm side (the MLB API only honors the first `sitCodes` value, so
 * both hands require two calls).
 */
export async function getPlatoonSplitBatch(
  batters: PlayerRef[],
  vsHand: "L" | "R",
  season: number,
): Promise<Map<number, SplitLine>> {
  if (batters.length === 0) return new Map();
  const sitCode = vsHand === "L" ? "vl" : "vr";
  const statsById = await fetchPeopleStats(
    batters.map((b) => b.id),
    `stats(type=statSplits,sitCodes=${sitCode},season=${season},group=hitting)`,
  );

  const byId = new Map<number, SplitLine>();
  for (const batter of batters) {
    const stat = (statsById.get(batter.id) ?? [])[0]?.splits?.[0]?.stat;
    byId.set(batter.id, stat ? parseSplitStat(stat) : EMPTY_SPLIT);
  }
  return byId;
}

/**
 * Batched {@link getHomeAwaySplit}: one request for every batter's home or
 * road line.
 */
export async function getHomeAwaySplitBatch(
  batters: PlayerRef[],
  isHome: boolean,
  season: number,
): Promise<Map<number, SplitLine>> {
  if (batters.length === 0) return new Map();
  const sitCode = isHome ? "h" : "a";
  const statsById = await fetchPeopleStats(
    batters.map((b) => b.id),
    `stats(type=statSplits,sitCodes=${sitCode},season=${season},group=hitting)`,
  );

  const byId = new Map<number, SplitLine>();
  for (const batter of batters) {
    const stat = (statsById.get(batter.id) ?? [])[0]?.splits?.[0]?.stat;
    byId.set(batter.id, stat ? parseSplitStat(stat) : EMPTY_SPLIT);
  }
  return byId;
}

/**
 * A pitcher's rate line for one MLB Stats API `sitCodes` split (`h`/`a` for
 * home/road, `vl`/`vr` for vs-hand). `era` is only present on `h`/`a` splits —
 * MLB's API doesn't compute ERA broken out by opposing batter hand.
 */
function parsePitcherSplitStat(stat?: Record<string, unknown>): PitcherSplitLine {
  const bf = n(stat?.battersFaced) ?? 0;
  const bb = n(stat?.baseOnBalls) ?? 0;
  const k = n(stat?.strikeOuts) ?? 0;
  return {
    ip: s(stat?.inningsPitched) ?? "0.0",
    era: s(stat?.era),
    bbPct: pct(bb, bf),
    kPct: pct(k, bf),
  };
}

/**
 * A pitcher's current-season line for one `sitCodes` split. Mirrors
 * {@link fetchSituationalSplit} but for the `pitching` stat group.
 */
async function fetchPitcherSituationalSplit(
  pitcherId: number,
  sitCode: string,
  season: number,
): Promise<PitcherSplitLine> {
  const res = await mlbFetch<RawStatsResponse>(
    `/api/v1/people/${pitcherId}/stats`,
    { stats: "statSplits", sitCodes: sitCode, group: "pitching", season },
    TTL.playerStats,
  );
  return parsePitcherSplitStat(res.stats?.[0]?.splits?.[0]?.stat);
}

/**
 * Batched pitcher situational splits: one request for every pitcher's line for
 * a single `sitCodes` split (`h`/`a` for home/road, `vl`/`vr` for vs-hand).
 */
export async function getPitcherSituationalSplitBatch(
  pitcherIds: number[],
  sitCode: string,
  season: number,
): Promise<Map<number, PitcherSplitLine>> {
  if (pitcherIds.length === 0) return new Map();
  const statsById = await fetchPeopleStats(
    pitcherIds,
    `stats(type=statSplits,sitCodes=${sitCode},season=${season},group=pitching)`,
  );

  const byId = new Map<number, PitcherSplitLine>();
  for (const id of new Set(pitcherIds)) {
    const stat = (statsById.get(id) ?? [])[0]?.splits?.[0]?.stat;
    byId.set(id, parsePitcherSplitStat(stat));
  }
  return byId;
}

/**
 * A probable starter's current-season home or road split. Used on the game
 * page's probable-starters card, picking whichever split matches this game.
 */
export async function getPitcherHomeAwaySplit(
  pitcherId: number,
  isHome: boolean,
  season: number,
): Promise<PitcherSplitLine> {
  return fetchPitcherSituationalSplit(pitcherId, isHome ? "h" : "a", season);
}

/**
 * A probable starter's current-season split facing left- or right-handed
 * batters.
 */
export async function getPitcherPlatoonSplit(
  pitcherId: number,
  vsBatterHand: "L" | "R",
  season: number,
): Promise<PitcherSplitLine> {
  return fetchPitcherSituationalSplit(
    pitcherId,
    vsBatterHand === "L" ? "vl" : "vr",
    season,
  );
}

/**
 * A pitcher's trailing-`days`-day form as of `asOfDate`, excluding `asOfDate`
 * itself — same day-before convention as {@link getBullpenWorkload}, since a
 * probable starter obviously hasn't pitched in today's not-yet-played game.
 *
 * Derived from the batched `gameLog` fetch shared with {@link getBullpenWorkload}
 * (the MLB API's hydrate layer doesn't support the `byDateRange` stat type), so
 * both sections share one upstream request per pitcher set.
 */
export async function getPitcherRecentFormBatch(
  pitcherIds: number[],
  asOfDate: string,
  days = 30,
): Promise<Map<number, PitcherRecentForm>> {
  if (pitcherIds.length === 0) return new Map();
  const logsById = await getGameLogsBatch(pitcherIds, new Date(asOfDate).getUTCFullYear());

  const endDate = shiftDate(asOfDate, -1);
  const windowStart = shiftDate(endDate, -(days - 1));

  const byId = new Map<number, PitcherRecentForm>();
  for (const id of new Set(pitcherIds)) {
    byId.set(id, summarizeGameLogWindow(logsById.get(id) ?? [], windowStart, endDate));
  }
  return byId;
}

/** Single-pitcher form line, backed by the batched gameLog lookup. */
export async function getPitcherRecentForm(
  pitcherId: number,
  asOfDate: string,
  days = 30,
): Promise<PitcherRecentForm> {
  const byId = await getPitcherRecentFormBatch([pitcherId], asOfDate, days);
  return (
    byId.get(pitcherId) ?? {
      ip: "0.0",
      bbPct: "-",
      kPct: "-",
      starts: 0,
    }
  );
}

/**
 * Aggregates a season gameLog into one {@link PitcherRecentForm} line for the
 * games played between `windowStart` and `endDate` (inclusive).
 */
function summarizeGameLogWindow(
  splits: RawGameLogSplit[],
  windowStart: string,
  endDate: string,
): PitcherRecentForm {
  let outs = 0;
  let earnedRuns = 0;
  let battersFaced = 0;
  let baseOnBalls = 0;
  let strikeOuts = 0;
  let starts = 0;

  for (const split of splits) {
    if (!split.date || split.date < windowStart || split.date > endDate) continue;
    outs += outsOfInningsPitched(s(split.stat?.inningsPitched) ?? "0.0");
    earnedRuns += n(split.stat?.earnedRuns) ?? 0;
    battersFaced += n(split.stat?.battersFaced) ?? 0;
    baseOnBalls += n(split.stat?.baseOnBalls) ?? 0;
    strikeOuts += n(split.stat?.strikeOuts) ?? 0;
    if ((n(split.stat?.gamesStarted) ?? 0) > 0) starts += 1;
  }

  const ip = inningsPitchedFromOuts(outs);
  return {
    ip,
    era: outs > 0 ? ((earnedRuns * 9) / (outs / 3)).toFixed(2) : undefined,
    bbPct: pct(baseOnBalls, battersFaced),
    kPct: pct(strikeOuts, battersFaced),
    starts,
  };
}

/** Converts MLB's innings notation ("6.1" = 6⅓, "6.2" = 6⅔) to outs. */
function outsOfInningsPitched(ip: string): number {
  const [whole, frac] = ip.split(".").map(Number);
  return (whole || 0) * 3 + (frac === 1 ? 1 : frac === 2 ? 2 : 0);
}

/** Converts outs back to MLB innings notation ("20" → "6.2"). */
function inningsPitchedFromOuts(outs: number): string {
  return `${Math.floor(outs / 3)}.${outs % 3}`;
}

// --- Roster proxy (Preview games) --------------------------------------------

interface RawRosterEntry {
  person: {
    id: number;
    fullName: string;
    stats?: RawStatGroup[];
  };
  position?: { type?: string };
  role?: { name?: string };
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

/** Active roster with position info for all players (hitters + pitchers). */
export interface RosterPlayer {
  player: PlayerRef;
  position: string; // e.g. "C", "Pitcher", "Outfielder", "Infielder"
  role?: string; // e.g. "Starter", "Relief" (if available in roster endpoint)
}

/**
 * Full active roster (hitters + pitchers) with basic position info.
 * Does not fetch stats — only IDs, names, positions.
 */
export async function getActiveRoster(teamId: number): Promise<RosterPlayer[]> {
  const res = await mlbFetch<RawRosterResponse>(
    `/api/v1/teams/${teamId}/roster`,
    { rosterType: "active" },
    TTL.roster,
  );

  const players: RosterPlayer[] = [];
  for (const entry of res.roster ?? []) {
    players.push({
      player: { id: entry.person.id, fullName: entry.person.fullName },
      position: entry.position?.type ?? "Unknown",
      role: entry.role?.name,
    });
  }

  return players;
}

// --- Bullpen workload ---------------------------------------------------------

interface RawGameLogSplit {
  date?: string;
  stat?: Record<string, unknown>;
}

/**
 * Season gameLog pitching splits for many pitchers in a single request.
 * Note: the hydrate layer doesn't accept `gameType`, so this is regular-season
 * only (the per-pitcher endpoint's default) — postseason appearances won't
 * appear in workload/form windows.
 */
async function getGameLogsBatch(
  pitcherIds: number[],
  season: number,
): Promise<Map<number, RawGameLogSplit[]>> {
  if (pitcherIds.length === 0) return new Map();
  const statsById = await fetchPeopleStats(
    pitcherIds,
    `stats(type=gameLog,season=${season},group=pitching)`,
    TTL.pitcherLog,
  );

  const byId = new Map<number, RawGameLogSplit[]>();
  for (const id of new Set(pitcherIds)) {
    byId.set(id, (statsById.get(id) ?? [])[0]?.splits ?? []);
  }
  return byId;
}

/**
 * Recent pitch-count workload for a set of bullpen arms, derived from each
 * pitcher's `gameLog` splits (there's no direct "recent workload" stat).
 * `asOfDate` is the game's date (`YYYY-MM-DD`, Eastern) — the window looks back
 * from the day before it, since bullpen arms haven't pitched in today's game yet.
 */
export async function getBullpenWorkload(
  pitcherIds: number[],
  season: number,
  asOfDate: string,
): Promise<Map<number, { yesterday: number; last3: number }>> {
  const yesterday = shiftDate(asOfDate, -1);
  const windowStart = shiftDate(asOfDate, -3);
  const logsById = await getGameLogsBatch(pitcherIds, season);

  const workload = new Map<number, { yesterday: number; last3: number }>();
  for (const id of new Set(pitcherIds)) {
    let yesterdayPitches = 0;
    let last3Pitches = 0;
    for (const split of logsById.get(id) ?? []) {
      if (!split.date || split.date < windowStart || split.date > yesterday) continue;
      const pitches = n(split.stat?.numberOfPitches) ?? 0;
      last3Pitches += pitches;
      if (split.date === yesterday) yesterdayPitches += pitches;
    }
    workload.set(id, { yesterday: yesterdayPitches, last3: last3Pitches });
  }
  return workload;
}

/**
 * Real season pitching lines for a set of bullpen arms. The `feed/live`
 * boxscore's embedded `seasonStats.pitching` looks like a season line but, for
 * `Preview`-state games, MLB's API only populates it for the two probable
 * starters — every other bullpen pitcher gets a zeroed stub. This hits the
 * same reliable stats endpoints `getSaberPitching`/`getRosterWithSeasonStats`
 * already use instead of trusting that embedded field.
 */
export async function getBullpenSeasonPitching(
  pitcherIds: number[],
  season: number,
): Promise<Map<number, { ip: string; era?: string; fip?: number; k: number }>> {
  const [seasonById, saberById] = await Promise.all([
    fetchPeopleStats(pitcherIds, `stats(type=season,season=${season},group=pitching)`),
    fetchPeopleStats(pitcherIds, `stats(type=sabermetrics,season=${season},group=pitching)`),
  ]);

  const stats = new Map<number, { ip: string; era?: string; fip?: number; k: number }>();
  for (const id of new Set(pitcherIds)) {
    const seasonStat = pickGroup({ stats: seasonById.get(id) ?? [] }, "season");
    if (!seasonStat) continue;
    const saber = pickGroup({ stats: saberById.get(id) ?? [] }, "sabermetrics");
    stats.set(id, {
      ip: s(seasonStat?.inningsPitched) ?? "0.0",
      era: s(seasonStat?.era),
      fip: n(saber?.fip),
      k: n(seasonStat?.strikeOuts) ?? 0,
    });
  }
  return stats;
}

/** A single person's ref, used for the vs-pitcher drill-down page header.
 * An unknown id (upstream 404) yields `null` rather than throwing, so callers
 * can render a 404 — crawlers probe made-up ids constantly. */
export async function getPerson(id: number): Promise<PlayerRef | null> {
  try {
    const res = await mlbFetch<{ people?: { id: number; fullName: string }[] }>(
      `/api/v1/people/${id}`,
      {},
      TTL.roster,
    );
    const person = res.people?.[0];
    return person ? { id: person.id, fullName: person.fullName } : null;
  } catch (err) {
    if (err instanceof MlbApiError && err.status === 404) return null;
    throw err;
  }
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

// --- Player-prop scoring stats ------------------------------------------------

/** Converts MLB's innings-pitched notation ("123.1" = 123⅓, "123.2" = 123⅔) to a float. */
export function ipToFloat(ip: string): number {
  const [whole, frac] = ip.split(".").map(Number);
  const fracInnings = frac === 1 ? 1 / 3 : frac === 2 ? 2 / 3 : 0;
  return (whole || 0) + fracInnings;
}

export interface PitcherPropStats {
  k9: number;
  outsPerStart: number;
  ip: number;
  gamesStarted: number;
}

/**
 * Season K/9 and outs-per-start for pitcher prop scoring. Returns `null` if
 * the player has no innings pitched this season (rookies, injured, or a
 * two-way/position player with no pitching record).
 */
export async function getPitcherPropStats(
  personId: number,
  season: number,
): Promise<PitcherPropStats | null> {
  const res = await mlbFetch<RawStatsResponse>(
    `/api/v1/people/${personId}/stats`,
    { stats: "season", group: "pitching", season },
    TTL.playerStats,
  );
  const stat = pickGroup(res, "season");
  if (!stat) return null;

  const ip = ipToFloat(s(stat.inningsPitched) ?? "0.0");
  if (ip <= 0) return null;

  const k = n(stat.strikeOuts) ?? 0;
  const gamesStarted = n(stat.gamesStarted) ?? 0;

  return {
    k9: (k * 9) / ip,
    outsPerStart: gamesStarted > 0 ? (ip * 3) / gamesStarted : 0,
    ip,
    gamesStarted,
  };
}

export interface SeasonHittingBasic {
  avg: string;
  obp: string;
  slg: string;
  h: number;
  hr: number;
  rbi: number;
  bb: number;
  totalBases: number;
  pa: number;
  games: number;
}

/** Season counting/rate stats for batter prop scoring. Returns `null` if the API has no season hitting record for this player. */
export async function getSeasonHittingBasic(
  personId: number,
  season: number,
): Promise<SeasonHittingBasic | null> {
  const res = await mlbFetch<RawStatsResponse>(
    `/api/v1/people/${personId}/stats`,
    { stats: "season", group: "hitting", season },
    TTL.playerStats,
  );
  const stat = pickGroup(res, "season");
  if (!stat) return null;

  return {
    avg: s(stat.avg) ?? "-",
    obp: s(stat.obp) ?? "-",
    slg: s(stat.slg) ?? "-",
    h: n(stat.hits) ?? 0,
    hr: n(stat.homeRuns) ?? 0,
    rbi: n(stat.rbi) ?? 0,
    bb: n(stat.baseOnBalls) ?? 0,
    totalBases: n(stat.totalBases) ?? 0,
    pa: n(stat.plateAppearances) ?? 0,
    games: n(stat.gamesPlayed) ?? 0,
  };
}

/**
 * Batched {@link getPitcherPropStats}: one request for every prop pitcher.
 * Players with no innings this season are omitted (callers treat a miss like
 * the single-player `null`).
 */
export async function getPitcherPropStatsBatch(
  personIds: number[],
  season: number,
): Promise<Map<number, PitcherPropStats>> {
  if (personIds.length === 0) return new Map();
  const statsById = await fetchPeopleStats(
    personIds,
    `stats(type=season,season=${season},group=pitching)`,
  );

  const byId = new Map<number, PitcherPropStats>();
  for (const id of new Set(personIds)) {
    const stat = pickGroup({ stats: statsById.get(id) ?? [] }, "season");
    if (!stat) continue;
    const ip = ipToFloat(s(stat.inningsPitched) ?? "0.0");
    if (ip <= 0) continue;
    const k = n(stat.strikeOuts) ?? 0;
    const gamesStarted = n(stat.gamesStarted) ?? 0;
    byId.set(id, {
      k9: (k * 9) / ip,
      outsPerStart: gamesStarted > 0 ? (ip * 3) / gamesStarted : 0,
      ip,
      gamesStarted,
    });
  }
  return byId;
}

/**
 * Batched {@link getSeasonHittingBasic}: one request for every prop batter.
 * Players without a season hitting record are omitted.
 */
export async function getSeasonHittingBasicBatch(
  personIds: number[],
  season: number,
): Promise<Map<number, SeasonHittingBasic>> {
  if (personIds.length === 0) return new Map();
  const statsById = await fetchPeopleStats(
    personIds,
    `stats(type=season,season=${season},group=hitting)`,
  );

  const byId = new Map<number, SeasonHittingBasic>();
  for (const id of new Set(personIds)) {
    const stat = pickGroup({ stats: statsById.get(id) ?? [] }, "season");
    if (!stat) continue;
    byId.set(id, {
      avg: s(stat.avg) ?? "-",
      obp: s(stat.obp) ?? "-",
      slg: s(stat.slg) ?? "-",
      h: n(stat.hits) ?? 0,
      hr: n(stat.homeRuns) ?? 0,
      rbi: n(stat.rbi) ?? 0,
      bb: n(stat.baseOnBalls) ?? 0,
      totalBases: n(stat.totalBases) ?? 0,
      pa: n(stat.plateAppearances) ?? 0,
      games: n(stat.gamesPlayed) ?? 0,
    });
  }
  return byId;
}
