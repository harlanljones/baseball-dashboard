import type { PlayerRef } from "@/lib/mlb/types";
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
 * HR/total-bases markets only), producing a display-ready tier and label.
 * `stats: null` (fetch failed, or no stat basis for this market/player kind)
 * always yields `"neutral"`.
 */
export function scoreProp(
  prop: PlayerProp,
  player: PlayerRef,
  stats: StatContext | null,
  weather: GameWeather | null,
): ScoredProp {
  const seasonAvg = stats ? seasonAvgFor(prop.marketKey, stats) : null;

  let tier: PropTier = "neutral";
  let statLabel = "No stats available";

  if (seasonAvg != null) {
    tier = tierFromRatio(seasonAvg, prop.line);
    statLabel = `Season avg: ${seasonAvg.toFixed(1)} (line ${prop.line})`;
    if (WEATHER_SENSITIVE_MARKETS.includes(prop.marketKey)) {
      tier = nudgeForWeather(tier, weather);
    }
  }

  return {
    player,
    marketKey: prop.marketKey,
    line: prop.line,
    overPrice: prop.overPrice,
    underPrice: prop.underPrice,
    tier,
    statLabel,
  };
}
