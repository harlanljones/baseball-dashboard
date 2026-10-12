/**
 * The benchmark workload: one cold pass over the two surfaces that do betting
 * line analysis, plus the server render of the pages they feed.
 *
 * Every step goes through the real application code (`getBestLeans`,
 * `loadPropGroups`, the React components) against the fixture upstream, so a
 * regression in shaping, matching, scoring or rendering shows up either as a
 * slower number or as a failed invariant.
 *
 * "Cold" is deliberate: `unstable_cache` is stubbed to the identity (what Next
 * does on a cache miss) and React's `cache` does not memoize outside a render,
 * so the pass measures the work behind a cache miss — the work an optimisation
 * can actually change. Production pays it on every TTL rollover, every new
 * game, and on every server render, none of which are cached.
 */

import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import BestLeansSection from "@/components/BestLeansSection";
import Bullpen from "@/components/Bullpen";
import OpeningDayCountdown from "@/components/OpeningDayCountdown";
import SeasonRecap from "@/components/SeasonRecap";
import StandingsTables from "@/components/StandingsTables";
import BoxscoreTables from "@/components/BoxscoreTables";
import GameCard from "@/components/GameCard";
import GameLog from "@/components/GameLog";
import HeadToHead from "@/components/HeadToHead";
import Linescore from "@/components/Linescore";
import PlayerPropsBoard from "@/components/PlayerPropsBoard";
import { loadPropGroups } from "@/components/PropsSidebarSection";
import type { PropTeamGroup } from "@/lib/odds/board";
import { propContextFromFeed } from "@/lib/odds/board";
import { getBestLeans, type SlateLean } from "@/lib/odds/leans";
import type { ScoredProp } from "@/lib/odds/types";
import { easternDateOf } from "@/lib/mlb/client";
import { getGamePlays, getLiveFeed, withBullpenStats } from "@/lib/mlb/game";
import { getBullpenSeasonPitching, getBullpenWorkload } from "@/lib/mlb/players";
import { getHeadToHead, getSchedule, isPostseason } from "@/lib/mlb/schedule";
import { getOffseasonContext, getOpeningDay, getSeasonRecap } from "@/lib/mlb/season";
import { getStandings } from "@/lib/mlb/standings";
import type { GameFeed } from "@/lib/mlb/types";
import { safe } from "@/lib/safe";
import { getGameWeather } from "@/lib/weather/report";

import { CAPTURED_FEED_PK } from "./upstream";
import type { GameWeather } from "@/lib/weather/types";

import {
  BENCH_DATE,
  BENCH_SEASON,
  OFFSEASON_DATE,
  GAMES,
  PHANTOM_NAMES,
  BATTER_MARKETS,
  PITCHER_MARKETS,
  PROPS_GAME,
  expectedMatchedProps,
  relieverIds,
} from "./fixture";

/** The props page's feed, built straight from the fixture game (Preview state). */
export interface PhaseTimings {
  leansMs: number;
  propsMs: number;
  renderMs: number;
  liveMs: number;
  bullpenMs: number;
  offseasonMs: number;
  totalMs: number;
}

export interface WorkloadResult {
  timings: PhaseTimings;
  leans: SlateLean[];
  groups: PropTeamGroup[];
  scored: ScoredProp[];
  feed: GameFeed;
  matchedProps: number;
  boardHtml: string;
  slateHtml: string;
  /** Innings, plays and rendered bytes of the game page's feed-derived core. */
  live: { innings: number; plays: number; htmlBytes: number };
  /** The season series: the last read the game page makes that the cycle did not cover. */
  headToHead: { meetings: number; postseason?: string; htmlBytes: number };
  /** Arms listed, rendered bytes, and total trailing-3-day pitches of the bullpen section. */
  bullpen: { rows: number; htmlBytes: number; last3: number };
  /** The offseason home view: its three sections and what they produced. */
  offseason: {
    recapSeason: number;
    nextSeason: number;
    series: number;
    divisions: number;
    teams: number;
    champion?: string;
    htmlBytes: number;
  };
  digest: string;
}

function scoredPropsOf(groups: PropTeamGroup[]): ScoredProp[] {
  return groups.flatMap((group) => group.players.flatMap((player) => player.props));
}

/**
 * A canonical fingerprint of everything both surfaces produced. The harness
 * compares it across two passes: equal means the fixture upstream plus the
 * app's shaping are deterministic, which is the premise of every timing here.
 */
function digestOf(
  leans: SlateLean[],
  scored: ScoredProp[],
  boardHtml: string,
  slateHtml: string,
  bullpenSummary: string,
  offseasonSummary: string,
  headToHeadSummary: string,
): string {
  const lines = [
    ...leans.map((lean) => `L|${lean.gamePk}|${lean.playerId}|${lean.marketKey}|${lean.line}|${lean.direction}|${lean.price}|${lean.score.toFixed(4)}`),
    ...scored.map(
      (prop) =>
        `P|${prop.player.id}|${prop.marketKey}|${prop.line}|${prop.tier}|${prop.direction}|${prop.factors.completeness}|${prop.factors.cumulative?.toFixed(4) ?? "-"}|${prop.evidence.join("~")}`,
    ),
    `H|${boardHtml.length}|${slateHtml.length}`,
    `B|${bullpenSummary}`,
    `O|${offseasonSummary}`,
    `S|${headToHeadSummary}`,
  ];
  let hash = 0x811c9dc5;
  for (const line of lines) {
    for (let i = 0; i < line.length; i += 1) {
      hash ^= line.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
  }
  return hash.toString(16);
}

/**
 * One request cycle: the two betting surfaces, the render of the pages they
 * feed, and the game page's own feed read. Each cycle is a fresh "request" — no
 * scope or cache is shared with the previous one.
 */
export async function runCycle(): Promise<WorkloadResult> {
  const started = performance.now();

  // Phase 1 — the slate-wide leans API: one schedule read, then a provider-wide
  // odds board shared across games via the odds scope, per-game roster/stats
  // lookups and player-name matching, scoring, ranking.
  const leansStart = performance.now();
  const leans = await getBestLeans(BENCH_DATE);
  const leansMs = performance.now() - leansStart;

  // Phase 2 — the props page: the same board plus the per-player matchup
  // evidence (career vs-starter, platoon split, pitcher form and home/road).
  const propsStart = performance.now();
  // The page reads the game's live feed itself; fetching and shaping it is part
  // of the work being measured, not something the harness hands over for free.
  const feed = await getLiveFeed(PROPS_GAME.gamePk);
  const weather: Promise<GameWeather | null> = safe(
    getGameWeather({
      venueId: feed.venueId,
      startTimeISO: feed.startTime,
      observed: feed.weather ?? null,
    }),
  );
  const groups = await loadPropGroups({
    game: propContextFromFeed(feed),
    season: BENCH_SEASON,
    weather,
    feed,
  });
  const propsMs = performance.now() - propsStart;

  // Phase 3 — server render of the props board and of the home slate.
  const renderStart = performance.now();
  const boardHtml = renderToStaticMarkup(
    createElement(PlayerPropsBoard, { groups, gameHref: `/games/${feed.gamePk}` }),
  );
  const day = await getSchedule(BENCH_DATE);
  const slateHtml = renderToStaticMarkup(
    createElement(
      Fragment,
      null,
      ...day.games.map((game) => createElement(GameCard, { key: game.gamePk, game })),
      createElement(BestLeansSection, { date: BENCH_DATE, hasPreviewGames: true }),
    ),
  );
  const renderMs = performance.now() - renderStart;

  // Phase 4 — the game page's data path: its largest single upstream read (a
  // full feed, ~715 KB before the request narrows it) and the sections that read
  // from it, none of which cost an extra request.
  const liveStart = performance.now();
  const liveFeed = await getLiveFeed(CAPTURED_FEED_PK);
  const livePlays = await getGamePlays(CAPTURED_FEED_PK);
  const liveHtml = renderToStaticMarkup(
    createElement(
      Fragment,
      null,
      createElement(Linescore, { feed: liveFeed }),
      createElement(BoxscoreTables, {
        away: liveFeed.boxscore.away,
        home: liveFeed.boxscore.home,
        isLive: true,
      }),
      createElement(GameLog, { plays: livePlays }),
    ),
  );
  // The season series is the game page's other read — a schedule query scoped
  // to the two teams across the season, narrowed to the same field list.
  const h2h = await getHeadToHead(liveFeed.away.team, liveFeed.home.team, BENCH_SEASON, liveFeed.gameType);
  const h2hHtml = renderToStaticMarkup(createElement(HeadToHead, { h2h }));
  const headToHead = {
    meetings: h2h.meetings.length,
    postseason: h2h.postseason?.name,
    htmlBytes: h2hHtml.length,
  };
  const liveMs = performance.now() - liveStart;

  // Phase 5 — the game page's bullpen section, off the same feed: per-arm season
  // pitching plus recent workload. On a postseason game the workload lookup reads
  // the team's last three days of boxscores — 169 KB each before the request
  // narrows them to ~12 KB — which is the only place those reads happen.
  const bullpenStart = performance.now();
  const gameDate = easternDateOf(liveFeed.startTime || new Date());
  const awayIds = liveFeed.boxscore.away.bullpen.map((p) => p.id);
  const homeIds = liveFeed.boxscore.home.bullpen.map((p) => p.id);
  const postseason = isPostseason(liveFeed.gameType);
  const [awayWorkload, homeWorkload, awaySeasonPitching, homeSeasonPitching] = await Promise.all([
    getBullpenWorkload(awayIds, BENCH_SEASON, gameDate, postseason ? liveFeed.away.team.id : undefined),
    getBullpenWorkload(homeIds, BENCH_SEASON, gameDate, postseason ? liveFeed.home.team.id : undefined),
    getBullpenSeasonPitching(awayIds, BENCH_SEASON),
    getBullpenSeasonPitching(homeIds, BENCH_SEASON),
  ]);
  const bullpenHtml = renderToStaticMarkup(
    createElement(Bullpen, {
      away: withBullpenStats(liveFeed.boxscore.away, awayWorkload, awaySeasonPitching),
      home: withBullpenStats(liveFeed.boxscore.home, homeWorkload, homeSeasonPitching),
    }),
  );
  const bullpenMs = performance.now() - bullpenStart;
  const bullpen = {
    rows: awayIds.length + homeIds.length,
    htmlBytes: bullpenHtml.length,
    last3: [...awayWorkload.values(), ...homeWorkload.values()].reduce((sum, w) => sum + w.last3, 0),
  };

  // Phase 6 — the offseason home view: a winter date has no games, so the page
  // renders three independent sections instead — the opening-day countdown, the
  // previous season's postseason recap, and that season's final standings. Each
  // awaits its own endpoint (a 1.18 MB opening-day schedule, 110 KB of
  // standings, 290 KB of postseason series before the requests narrow them).
  const offseasonStart = performance.now();
  const context = await getOffseasonContext(OFFSEASON_DATE);
  if (!context) throw new Error("harness: no offseason context for the winter fixture date");
  const [recap, divisions, openingDay] = await Promise.all([
    getSeasonRecap(context.recapSeason),
    getStandings(context.recapSeason),
    getOpeningDay(context.nextSeason),
  ]);
  const offseasonHtml = renderToStaticMarkup(
    createElement(
      Fragment,
      null,
      openingDay ? createElement(OpeningDayCountdown, { openingDay, today: OFFSEASON_DATE }) : null,
      recap.series.length > 0 ? createElement(SeasonRecap, { recap }) : null,
      divisions.length > 0 ? createElement(StandingsTables, { season: context.recapSeason, divisions }) : null,
    ),
  );
  const offseasonMs = performance.now() - offseasonStart;
  const offseason = {
    recapSeason: context.recapSeason,
    nextSeason: context.nextSeason,
    series: recap.series.length,
    divisions: divisions.length,
    teams: divisions.reduce((sum, division) => sum + division.teams.length, 0),
    champion: recap.champion?.name,
    htmlBytes: offseasonHtml.length,
  };

  const scored = scoredPropsOf(groups);
  return {
    timings: { leansMs, propsMs, renderMs, liveMs, bullpenMs, offseasonMs, totalMs: performance.now() - started },
    leans,
    groups,
    scored,
    feed,
    matchedProps: scored.length,
    boardHtml,
    slateHtml,
    live: {
      innings: liveFeed.linescore.innings.length,
      plays: livePlays.length,
      htmlBytes: liveHtml.length,
    },
    headToHead,
    bullpen,
    offseason,
    digest: digestOf(
      leans,
      scored,
      boardHtml,
      slateHtml,
      `${bullpen.rows}|${bullpen.htmlBytes}|${bullpen.last3}`,
      `${offseason.recapSeason}|${offseason.series}|${offseason.divisions}|${offseason.teams}|${offseason.champion ?? "-"}|${offseason.htmlBytes}`,
      `${headToHead.meetings}|${headToHead.postseason ?? "-"}|${headToHead.htmlBytes}`,
    ),
  };
}

// --- Invariants --------------------------------------------------------------
//
// These pin the *behaviour* the numbers are supposed to measure: a faster run
// that silently stops matching props, drops the weather nudge, or renders an
// empty board fails here instead of scoring well.

const TIER_ORDER = ["strong-under", "lean-under", "neutral", "lean-over", "strong-over"];

/** The tier band a season-average/line ratio falls in, per the published thresholds. */
function bandIndex(ratio: number): number {
  if (ratio >= 1.3) return 4;
  if (ratio >= 1.1) return 3;
  if (ratio <= 1 / 1.3) return 0;
  if (ratio <= 1 / 1.1) return 1;
  return 2;
}

/**
 * Structural checks on one scored prop. The evidence line is the app's own
 * published reasoning, so the tier has to agree with it: same line, same
 * direction, and a tier within one step of the ratio band (one step of slack
 * because the evidence average is rounded to a tenth before we read it, and
 * another only when a weather nudge is named).
 */
function checkScoredProp(prop: ScoredProp, teamId: number, failures: string[]): void {
  const label = `${teamId}/${prop.player.id}/${prop.marketKey}`;
  if (prop.evidence.length === 0) failures.push(`${label}: no evidence lines`);
  if (!(prop.line > 0)) failures.push(`${label}: non-positive line ${prop.line}`);
  if (!Number.isFinite(prop.overPrice) || !Number.isFinite(prop.underPrice)) {
    failures.push(`${label}: non-finite prices`);
  }
  const partial = prop.factors.modelConfidence == null || prop.factors.statisticalEdge == null;
  if ((prop.factors.completeness === "partial") !== partial) failures.push(`${label}: completeness mismatch`);

  const seasonLine = /^Season avg: ([\d.]+) \(line ([\d.]+)\)$/.exec(prop.evidence[0]);
  if (!seasonLine) {
    if (prop.evidence[0] !== "No stats available") failures.push(`${label}: unexpected first evidence "${prop.evidence[0]}"`);
    if (prop.tier !== "neutral") failures.push(`${label}: ungraded prop is ${prop.tier}`);
    return;
  }
  const seasonAvg = Number(seasonLine[1]);
  const line = Number(seasonLine[2]);
  if (line !== prop.line) failures.push(`${label}: evidence line ${line} != prop line ${prop.line}`);

  // Direction is decided on the unrounded average, which the evidence rounds to
  // a tenth — so only check it once the two are clearly apart.
  if (Math.abs(seasonAvg - line) > 0.051) {
    const expectedDirection = seasonAvg >= line ? "over" : "under";
    if (prop.direction !== expectedDirection) {
      failures.push(`${label}: direction ${prop.direction} disagrees with season avg ${seasonAvg} vs line ${line}`);
    }
  }

  const band = bandIndex(seasonAvg / line);
  const actual = TIER_ORDER.indexOf(prop.tier);
  if (actual < 0) {
    failures.push(`${label}: unknown tier ${prop.tier}`);
    return;
  }
  const weatherLine = prop.evidence.find((text) => /favors the (over|under)/.test(text));
  const allowed = weatherLine ? 2 : 1;
  if (Math.abs(actual - band) > allowed) {
    failures.push(
      `${label}: tier ${prop.tier} is ${actual - band} steps from its band (avg ${seasonAvg} line ${line})`,
    );
    return;
  }
  if (weatherLine) {
    // A named nudge must point the tier the way the evidence says.
    const step = weatherLine.includes("favors the over") ? 1 : -1;
    if ((actual - band) * step < 0) failures.push(`${label}: weather nudge moved ${prop.tier} against "${weatherLine}"`);
  }
}

export function checkInvariants(
  result: WorkloadResult,
  upstream: { calls: { url: string; status: number }[]; unexpected: string[] },
): string[] {
  const failures: string[] = [];

  if (upstream.unexpected.length > 0) failures.push(`unexpected upstream calls: ${upstream.unexpected.join("; ")}`);
  const badStatus = upstream.calls.filter((call) => call.status !== 200);
  if (badStatus.length > 0) failures.push(`non-200 upstream responses: ${badStatus.map((c) => c.url).join("; ")}`);
  if (upstream.calls.length === 0) failures.push("no upstream requests were made");

  // Slate leans: one entry per returned row, ranked, capped at five.
  if (result.leans.length !== Math.min(5, GAMES.length)) {
    failures.push(`expected 5 slate leans, got ${result.leans.length}`);
  }
  for (let i = 1; i < result.leans.length; i += 1) {
    if (result.leans[i - 1].score < result.leans[i].score) failures.push("slate leans are not sorted by score");
  }
  for (const lean of result.leans) {
    if (!GAMES.some((game) => game.gamePk === lean.gamePk)) failures.push(`lean references unknown game ${lean.gamePk}`);
    const expectedAnchor = `lean-${lean.playerId}-${lean.marketKey}-${String(lean.line).replace(/\./g, "_")}`;
    if (lean.anchor !== expectedAnchor) failures.push(`lean anchor ${lean.anchor} != ${expectedAnchor}`);
    if (!(lean.score > 0)) failures.push(`lean for ${lean.playerName} has score ${lean.score}`);
  }

  // Props board: both teams present, every posted prop that names a roster
  // player resolved exactly once.
  if (result.groups.length !== 2) failures.push(`expected 2 team groups, got ${result.groups.length}`);
  const expectedTeams = [PROPS_GAME.away.team.id, PROPS_GAME.home.team.id].sort((a, b) => a - b);
  const gotTeams = result.groups.map((group) => group.team.id).sort((a, b) => a - b);
  if (expectedTeams.join(",") !== gotTeams.join(",")) {
    failures.push(`board teams ${gotTeams.join(",")} != slate game teams ${expectedTeams.join(",")}`);
  }
  const expectedProps = expectedMatchedProps(PROPS_GAME);
  if (result.matchedProps !== expectedProps) {
    failures.push(`expected ${expectedProps} matched props, got ${result.matchedProps}`);
  }
  const seen = new Set<string>();
  for (const group of result.groups) {
    for (const playerGroup of group.players) {
      for (const prop of playerGroup.props) {
        const key = `${prop.player.id}|${prop.marketKey}|${prop.line}`;
        if (seen.has(key)) failures.push(`duplicate scored prop ${key}`);
        seen.add(key);
        checkScoredProp(prop, group.team.id, failures);
      }
    }
  }

  // The evidence path the props page exists for: matchup lines attach to the
  // projected lineup, and the weather nudge fired for the open-air fixture park.
  // Every prop-carrying pitcher in the fixture has a served season line, so a
  // pitcher prop that comes back ungraded means the evidence basis failed to
  // resolve for that pitcher — which is what a reliever looked like before the
  // per-appearance basis existed.
  const ungradedPitchers = result.scored.filter(
    (prop) =>
      (prop.marketKey === "pitcher_strikeouts" || prop.marketKey === "pitcher_outs") &&
      prop.evidence[0] === "No stats available",
  );
  if (ungradedPitchers.length > 0) {
    failures.push(`${ungradedPitchers.length} pitcher props came back ungraded`);
  }

  // Confidence grows with the sample behind the line. Every prop-carrying
  // pitcher in the fixture has innings behind him, so sitting on the floor
  // means the sample was read from the wrong field (starts, for a reliever).
  const flooredPitchers = result.scored.filter(
    (prop) =>
      prop.marketKey.startsWith("pitcher_") &&
      prop.factors.modelConfidence != null &&
      prop.factors.modelConfidence <= 60,
  );
  if (flooredPitchers.length > 0) {
    failures.push(`${flooredPitchers.length} pitcher props sit on the confidence floor`);
  }

  // A reliever's form and home/road lines are measured over appearances, so
  // saying "starts" about one is a role-wording bug, not a wording choice.
  const arms = new Set(relieverIds(PROPS_GAME));
  const relieverStarts = result.groups
    .flatMap((group) => group.players)
    .filter((entry) => arms.has(entry.player.id))
    .flatMap((entry) => entry.evidence)
    .filter((line) => line.includes("starts"));
  if (relieverStarts.length > 0) {
    failures.push(`a reliever's evidence is worded in starts: ${relieverStarts[0]}`);
  }

  // Sanity guards for the board's shape, not its content: a board that leans
  // one way only, or that has lost a tracked market, means the scoring or the
  // shaping broke rather than the fixture's data happening to fall that way.
  const directions = new Set(result.scored.map((prop) => prop.direction));
  if (directions.size < 2) failures.push("every scored prop leans the same way");
  const scoredMarkets = new Set(result.scored.map((prop) => prop.marketKey));
  for (const market of [...BATTER_MARKETS, ...PITCHER_MARKETS]) {
    if (!scoredMarkets.has(market)) failures.push(`no scored prop for the tracked market ${market}`);
  }

  const evidenceLines = result.groups.flatMap((group) => group.players.flatMap((player) => player.evidence));
  if (evidenceLines.length === 0) failures.push("no matchup evidence attached to any player");
  const nudged = result.scored.filter((prop) => prop.evidence.some((text) => /favors the (over|under)/.test(text)));
  if (nudged.length === 0) failures.push("weather nudge never fired for the open-air fixture game");

  // The game page's feed-derived core: the captured feed must actually shape
  // (a fixture the parser cannot read would otherwise render nothing) and its
  // sections must produce markup.
  if (result.live.innings < 9) failures.push(`captured feed shaped only ${result.live.innings} innings`);
  if (result.live.plays < 5) failures.push(`captured feed shaped only ${result.live.plays} significant plays`);
  if (result.live.htmlBytes < 2000) failures.push(`game-page sections rendered only ${result.live.htmlBytes} bytes`);
  if (result.headToHead.meetings === 0) failures.push("the season series came back with no meetings");
  if (result.headToHead.htmlBytes < 200) failures.push(`season series rendered only ${result.headToHead.htmlBytes} bytes`);
  // The captured feed is a postseason game, so its series carries that round.
  if (!result.headToHead.postseason) failures.push("the season series lost its postseason round");
  if (result.bullpen.rows === 0) failures.push("captured feed listed no bullpen arms");
  if (result.bullpen.htmlBytes < 1000) failures.push(`bullpen section rendered only ${result.bullpen.htmlBytes} bytes`);
  // The trailing-3-day totals can only be non-zero if the postseason schedule
  // read resolved to the right window and every boxscore in it shaped.
  if (result.bullpen.last3 <= 0) failures.push("postseason pitch counts came back empty");
  if (result.offseason.divisions !== 6) failures.push(`offseason standings has ${result.offseason.divisions} divisions`);
  if (result.offseason.teams !== 30) failures.push(`offseason standings has ${result.offseason.teams} teams`);
  if (result.offseason.series === 0) failures.push("offseason recap has no series");
  if (!result.offseason.champion) failures.push("offseason recap has no champion");
  if (result.offseason.htmlBytes < 2000) failures.push(`offseason sections rendered only ${result.offseason.htmlBytes} bytes`);

  // Render: every scored prop has its anchor, the slate renders, and nothing
  // from a name the roster cannot resolve leaked into the board.
  if (result.boardHtml.length === 0) failures.push("props board rendered empty");
  if (result.slateHtml.length === 0) failures.push("slate rendered empty");
  // Every row renders only its first evidence line until the reader expands it,
  // and the product promises each lean exposes the statistical edge versus the
  // posted line — so that line, not the matchup context, has to lead.
  const firstLines = [...result.boardHtml.matchAll(/class="prop-row"[\s\S]*?<p class="prop-evidence">([^<]*)<\/p>/g)].map(
    (match) => match[1],
  );
  const misordered = firstLines.filter(
    (line) => !line.startsWith("Season avg:") && line !== "No stats available",
  );
  if (firstLines.length === 0) failures.push("no prop row carries a leading evidence line");
  if (misordered.length > 0) {
    failures.push(`${misordered.length} prop rows lead with matchup evidence: ${misordered[0]}`);
  }

  const anchors = result.boardHtml.match(/id="lean-/g)?.length ?? 0;
  if (anchors !== result.matchedProps) failures.push(`board HTML has ${anchors} prop anchors for ${result.matchedProps} props`);
  for (const phantom of PHANTOM_NAMES) {
    if (result.boardHtml.includes(phantom) || result.boardHtml.includes(phantom.toUpperCase())) {
      failures.push(`unmatched provider name "${phantom}" reached the board`);
    }
  }
  for (const game of GAMES) {
    if (!result.slateHtml.includes(game.home.team.name)) failures.push(`slate HTML is missing ${game.home.team.name}`);
  }
  return failures;
}
