import type {
  PitcherRecentForm,
  PitcherSplitLine,
  PlayerRef,
  SplitLine,
  VsPlayerLine,
} from "@/lib/mlb/types";
import type { GameWeather } from "@/lib/weather/types";
import type { PlayerProp, PropMarketKey, PropTier, ScoredProp } from "./types";

export interface PitcherStatContext {
  kind: "pitcher";
  k9: number;
  outsPerStart: number;
  gamesStarted: number;
}

export interface BatterStatContext {
  kind: "batter";
  hitsPerGame: number;
  totalBasesPerGame: number;
  hrPerGame: number;
  rbiPerGame: number;
  bbPerGame: number;
  games: number;
}

export type StatContext = PitcherStatContext | BatterStatContext;

/** Supporting evidence for a batter prop: matchup data against tonight's probable starter. */
export interface BatterMatchupContext {
  kind: "batter";
  /** Head-to-head career history vs tonight's starter, when one is announced. */
  vsPitcher?: VsPlayerLine;
  /** This batter's platoon split vs tonight's starter's throwing hand. */
  platoon?: SplitLine;
  vsHand?: "L" | "R";
}

/** Supporting evidence for a pitcher prop: recent form and home/road tendency. */
export interface PitcherMatchupContext {
  kind: "pitcher";
  recentForm?: PitcherRecentForm;
  homeAway?: PitcherSplitLine;
  isHome?: boolean;
}

export type MatchupContext = BatterMatchupContext | PitcherMatchupContext;

/** Below this many plate appearances, a platoon split is too noisy to cite as evidence. */
const MIN_PA_FOR_PLATOON_EVIDENCE = 15;
/** Below this many plate appearances, head-to-head history is too thin to cite as evidence. */
const MIN_PA_FOR_VS_PITCHER_EVIDENCE = 3;

/** Below this many starts, a pitcher's season rate is too noisy to grade. */
const MIN_GAMES_STARTED_FOR_TIER = 3;
/** Below this many games played, a batter's per-game rate is too noisy to grade. */
const MIN_GAMES_PLAYED_FOR_TIER = 20;

const WEATHER_SENSITIVE_MARKETS: PropMarketKey[] = [
  "batter_home_runs",
  "batter_total_bases",
];

const TIER_ORDER: PropTier[] = [
  "strong-under",
  "lean-under",
  "neutral",
  "lean-over",
  "strong-over",
];

/** The player's season-average count for this market's line, or `null` if the sample is too small / the market has no stat basis for this player kind. */
function seasonAvgFor(marketKey: PropMarketKey, stats: StatContext): number | null {
  if (stats.kind === "pitcher") {
    if (stats.gamesStarted < MIN_GAMES_STARTED_FOR_TIER) return null;
    switch (marketKey) {
      case "pitcher_strikeouts":
        // K/9 times this pitcher's average innings per start (outsPerStart / 3 = IP).
        return (stats.k9 / 9) * (stats.outsPerStart / 3);
      case "pitcher_outs":
        return stats.outsPerStart;
      default:
        return null;
    }
  }

  if (stats.games < MIN_GAMES_PLAYED_FOR_TIER) return null;
  switch (marketKey) {
    case "batter_hits":
      return stats.hitsPerGame;
    case "batter_total_bases":
      return stats.totalBasesPerGame;
    case "batter_home_runs":
      return stats.hrPerGame;
    case "batter_rbis":
      return stats.rbiPerGame;
    case "batter_walks":
      return stats.bbPerGame;
    default:
      return null;
  }
}

function tierFromRatio(seasonAvg: number, line: number): PropTier {
  if (line <= 0) return "neutral";
  const ratio = seasonAvg / line;
  if (ratio >= 1.3) return "strong-over";
  if (ratio >= 1.1) return "lean-over";
  if (ratio <= 1 / 1.3) return "strong-under";
  if (ratio <= 1 / 1.1) return "lean-under";
  return "neutral";
}

/** Describes why the weather nudge fired, matching {@link nudgeForWeather}'s own thresholds. */
function weatherEvidenceLine(weather: GameWeather | null): string | null {
  if (weather?.roof !== "open") return null;
  const hour = weather?.gametime;
  if (!hour) return null;

  const favorsOver = hour.wind.category === "out" || hour.tempF >= 85;
  const favorsUnder = hour.wind.category === "in" || hour.tempF <= 45;
  if (favorsOver === favorsUnder) return null;

  if (favorsOver) {
    return hour.wind.category === "out"
      ? "Wind blowing out favors the over"
      : `Hot day (${hour.tempF}°F) favors the over`;
  }
  return hour.wind.category === "in"
    ? "Wind blowing in favors the under"
    : `Cold day (${hour.tempF}°F) favors the under`;
}

/** Career head-to-head vs tonight's starter, when the sample is big enough to be worth citing. */
function vsPitcherEvidenceLine(vsPitcher: VsPlayerLine | undefined): string | null {
  if (!vsPitcher?.hasHistory || vsPitcher.pa < MIN_PA_FOR_VS_PITCHER_EVIDENCE) return null;
  const hrNote = vsPitcher.hr > 0 ? `, ${vsPitcher.hr} HR` : "";
  return `Career vs ${vsPitcher.pitcher.fullName}: ${vsPitcher.h} H in ${vsPitcher.pa} PA${hrNote}`;
}

/** Season platoon split vs tonight's starter's throwing hand, when the sample is big enough. */
function platoonEvidenceLine(
  platoon: SplitLine | undefined,
  vsHand: "L" | "R" | undefined,
): string | null {
  if (!platoon || !vsHand || platoon.pa < MIN_PA_FOR_PLATOON_EVIDENCE) return null;
  return `vs ${vsHand}HP this year: ${platoon.ops} OPS (${platoon.pa} PA)`;
}

/** Trailing-30-day form, when the pitcher has actually started in that window. */
function recentFormEvidenceLine(recentForm: PitcherRecentForm | undefined): string | null {
  if (!recentForm || recentForm.starts <= 0) return null;
  const parts = [recentForm.era ? `${recentForm.era} ERA` : null, recentForm.kPct ? `${recentForm.kPct} K rate` : null].filter(
    (p): p is string => p != null,
  );
  if (parts.length === 0) return null;
  return `Last 30 days: ${parts.join(", ")} over ${recentForm.starts} start${recentForm.starts === 1 ? "" : "s"}`;
}

/** Season home/road split, when the pitcher has actually pitched in that split. */
function homeAwayEvidenceLine(
  homeAway: PitcherSplitLine | undefined,
  isHome: boolean | undefined,
): string | null {
  if (!homeAway || isHome == null || homeAway.ip === "0.0") return null;
  const parts = [homeAway.era ? `${homeAway.era} ERA` : null, `${homeAway.ip} IP`].filter(
    (p): p is string => p != null,
  );
  return `${isHome ? "Home" : "Road"} starts this year: ${parts.join(", ")}`;
}

function nudgeForWeather(tier: PropTier, weather: GameWeather | null): PropTier {
  // Indoor/retractable-closed parks (or unknown roof state): wind and temp
  // are irrelevant or unreliable, matching BallparkWeather.tsx's `isDomed`
  // logic (roof !== "open" hides the wind diagram there — the props sidebar
  // shouldn't nudge on it either). Only apply the nudge for confirmed
  // open-air parks.
  if (weather?.roof !== "open") return tier;

  const hour = weather?.gametime;
  if (!hour) return tier;

  const favorsOver = hour.wind.category === "out" || hour.tempF >= 85;
  const favorsUnder = hour.wind.category === "in" || hour.tempF <= 45;
  if (favorsOver === favorsUnder) return tier; // both or neither true — no clear signal

  const idx = TIER_ORDER.indexOf(tier);
  if (favorsOver && idx < TIER_ORDER.length - 1) return TIER_ORDER[idx + 1];
  if (favorsUnder && idx > 0) return TIER_ORDER[idx - 1];
  return tier;
}

/**
 * Scores one player prop against their season stats (+ ballpark weather, for
 * HR/total-bases markets only), producing a display-ready tier plus the
 * market-specific basis for it. `stats: null` (fetch failed, or no stat
 * basis for this market/player kind) always yields `"neutral"` with a single
 * "No stats available" evidence line.
 *
 * Player-level matchup context (splits, head-to-head history) is deliberately
 * *not* included here — it's identical across every prop a player has, so
 * callers fetch it once per player via {@link matchupEvidence} instead of
 * repeating it on every row.
 */
export function scoreProp(
  prop: PlayerProp,
  player: PlayerRef,
  stats: StatContext | null,
  weather: GameWeather | null,
): ScoredProp {
  const seasonAvg = stats ? seasonAvgFor(prop.marketKey, stats) : null;

  let tier: PropTier = "neutral";
  const evidence: string[] = [];

  if (seasonAvg != null) {
    tier = tierFromRatio(seasonAvg, prop.line);
    evidence.push(`Season avg: ${seasonAvg.toFixed(1)} (line ${prop.line})`);

    if (WEATHER_SENSITIVE_MARKETS.includes(prop.marketKey)) {
      const nudged = nudgeForWeather(tier, weather);
      if (nudged !== tier) {
        const weatherLine = weatherEvidenceLine(weather);
        if (weatherLine) evidence.push(weatherLine);
      }
      tier = nudged;
    }
  } else {
    evidence.push("No stats available");
  }

  return {
    player,
    marketKey: prop.marketKey,
    line: prop.line,
    overPrice: prop.overPrice,
    underPrice: prop.underPrice,
    tier,
    evidence,
  };
}

/**
 * Player-level matchup evidence — head-to-head history and platoon split for
 * a batter, or recent form and home/road split for a pitcher — computed once
 * per player rather than once per prop, since it doesn't vary by market.
 */
export function matchupEvidence(matchup: MatchupContext | null): string[] {
  if (!matchup) return [];
  if (matchup.kind === "batter") {
    return [
      vsPitcherEvidenceLine(matchup.vsPitcher),
      platoonEvidenceLine(matchup.platoon, matchup.vsHand),
    ].filter((line): line is string => line != null);
  }
  return [
    recentFormEvidenceLine(matchup.recentForm),
    homeAwayEvidenceLine(matchup.homeAway, matchup.isHome),
  ].filter((line): line is string => line != null);
}
