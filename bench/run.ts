/**
 * One benchmark process: request cycles, reported as the mean per cycle.
 *
 * A cycle is a cold pass over the two surfaces that do betting line analysis
 * (the slate-wide leans API and the props page) plus the server render of the
 * pages they feed. Caches are bypassed (see `preload.ts`), so every cycle pays
 * the work a cache miss pays in production.
 *
 * The first cycles are untimed: they absorb the JIT warm-up and the fixture's
 * own first-request serialization, neither of which is application work. The
 * timed cycles are then averaged, because a single ~20 ms pass is dominated by
 * GC and scheduler noise. Invariants pin the shape of the work — each timed
 * cycle must read upstream exactly as often as every other, and must still read
 * the odds board — so a "win" that comes from caching the workload away rather
 * than doing it faster fails here.
 *
 * `autoresearch.sh` runs this in a fresh process a few times and takes the
 * median, so nothing process-local can decide the score.
 *
 * Exit 0 when every cycle runs and every invariant holds, 1 when an invariant
 * fails (a fast but wrong result), 2 when the pass itself throws.
 */

import { GAMES, LEAN_GAME_COUNT, PROPS_GAME, expectedMatchedProps } from "./fixture";
import { installUpstream } from "./upstream";
import { checkInvariants, runCycle, type WorkloadResult } from "./workload";

/** Untimed cycles: JIT warm-up plus the fixture's own first-request work. */
const WARMUP_CYCLES = 3;
/** Timed cycles, averaged into the reported per-cycle cost. */
const TIMED_CYCLES = 20;

// A configured primary provider key, so the SportsGameOdds path runs instead of
// failing closed. The value is irrelevant (the stub never authenticates) but it
// must not depend on the machine's environment.
process.env.SPORTSGAMEODDS_API_KEY = "bench-sportsgameodds-key";

function meanOf(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

async function main(): Promise<number> {
  const upstream = installUpstream();
  const cycles: WorkloadResult[] = [];
  const callsPerCycle: number[] = [];

  for (let i = 0; i < WARMUP_CYCLES + TIMED_CYCLES; i += 1) {
    const before = upstream.calls.length;
    cycles.push(await runCycle());
    callsPerCycle.push(upstream.calls.length - before);
  }

  const timed = cycles.slice(WARMUP_CYCLES);
  const timedCalls = callsPerCycle.slice(WARMUP_CYCLES);
  const lastCallCount = timedCalls[timedCalls.length - 1];
  const failures = checkInvariants(timed[timed.length - 1], {
    calls: upstream.calls.slice(-lastCallCount),
    unexpected: upstream.unexpected,
  });

  for (const cycle of cycles) {
    if (cycle.digest !== cycles[0].digest) {
      failures.push(`workload is not deterministic: digest ${cycle.digest} != ${cycles[0].digest}`);
      break;
    }
  }
  if (new Set(timedCalls).size !== 1) {
    failures.push(`timed cycles read upstream unevenly: ${timedCalls.join(", ")}`);
  }
  const lastCycleCalls = upstream.calls.slice(-lastCallCount);
  const lastCycleUrls = lastCycleCalls.map((call) => call.url);
  if (!lastCycleUrls.some((url) => url.startsWith("https://api.sportsgameodds.com/"))) {
    failures.push("a timed cycle never read the odds board");
  }
  if (!lastCycleUrls.some((url) => url.startsWith("https://statsapi.mlb.com/api/v1/schedule"))) {
    failures.push("a timed cycle never read the MLB schedule");
  }
  if (!lastCycleUrls.some((url) => /\/api\/v1\/game\/\d+\/boxscore/.test(url))) {
    failures.push("a timed cycle never read a postseason boxscore");
  }
  if (!lastCycleUrls.some((url) => url.startsWith("https://statsapi.mlb.com/api/v1/standings"))) {
    failures.push("a timed cycle never read the standings");
  }

  const totals = timed.map((cycle) => cycle.timings.totalMs);
  // Per-process numbers are means over the timed cycles; the aggregation across
  // processes (and the choice of estimator) belongs to autoresearch.sh.
  const metrics: [string, number][] = [
    ["slate_ms", meanOf(totals)],
    ["leans_ms", meanOf(timed.map((cycle) => cycle.timings.leansMs))],
    ["props_ms", meanOf(timed.map((cycle) => cycle.timings.propsMs))],
    ["render_ms", meanOf(timed.map((cycle) => cycle.timings.renderMs))],
    ["live_ms", meanOf(timed.map((cycle) => cycle.timings.liveMs))],
    ["bullpen_ms", meanOf(timed.map((cycle) => cycle.timings.bullpenMs))],
    ["bullpen_rows", timed[0].bullpen.rows],
    ["bullpen_last3_pitches", timed[0].bullpen.last3],
    ["bullpen_html_bytes", timed[0].bullpen.htmlBytes],
    ["offseason_ms", meanOf(timed.map((cycle) => cycle.timings.offseasonMs))],
    ["offseason_series", timed[0].offseason.series],
    ["offseason_teams", timed[0].offseason.teams],
    ["offseason_html_bytes", timed[0].offseason.htmlBytes],
    ["live_innings", timed[0].live.innings],
    ["live_plays", timed[0].live.plays],
    ["upstream_bytes", lastCycleCalls.reduce((sum, call) => sum + call.bytes, 0)],
    ["props_matched", timed[0].matchedProps],
    ["leans_returned", timed[0].leans.length],
    ["board_html_bytes", timed[0].boardHtml.length],
    ["slate_html_bytes", timed[0].slateHtml.length],
    ["upstream_calls", timedCalls[0]],
  ];

  console.log(
    `# bench: ${GAMES.length} games, ${LEAN_GAME_COUNT} lean games, ${expectedMatchedProps(PROPS_GAME)} matched props/game, ` +
      `${timedCalls[0]} upstream reads/cycle, ${TIMED_CYCLES} timed cycles, digest ${timed[0].digest}`,
  );
  console.log(`# warmup_ms: ${cycles.slice(0, WARMUP_CYCLES).map((cycle) => cycle.timings.totalMs.toFixed(1)).join(" ")}`);
  console.log(`# timed_ms:  ${totals.map((value) => value.toFixed(1)).join(" ")}`);
  for (const [name, value] of metrics) {
    console.log(`METRIC ${name}=${value.toFixed(3)}`);
  }

  if (failures.length > 0) {
    for (const failure of failures) console.error(`invariant failed: ${failure}`);
    return 1;
  }
  return 0;
}

try {
  process.exit(await main());
} catch (error) {
  console.error("bench run threw:", error);
  process.exit(2);
}
