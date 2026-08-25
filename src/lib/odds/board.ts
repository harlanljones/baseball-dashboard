import type { PropMarketKey, ScoredProp } from "@/lib/odds/types";
import type { PlayerRef, TeamRef } from "@/lib/mlb/types";

/**
 * Shared vocabulary for the player-props surfaces (board + best leans):
 * one scoring formula, one set of weights, one tier language, so the slate
 * summary and the game-level board can never drift apart.
 */

export const MARKET_LABELS: Record<PropMarketKey, string> = {
  pitcher_strikeouts: "Strikeouts",
  pitcher_outs: "Outs recorded",
  batter_hits: "Hits",
  batter_total_bases: "Total bases",
  batter_home_runs: "Home runs",
  batter_rbis: "RBIs",
  batter_walks: "Walks",
};

export type WeightKey = "modelConfidence" | "statisticalEdge" | "marketValue";
export type Weights = Record<WeightKey, number>;

export const DEFAULT_WEIGHTS: Weights = {
  modelConfidence: 40,
  statisticalEdge: 35,
  marketValue: 25,
};

export const WEIGHT_LABELS: Record<WeightKey, string> = {
  modelConfidence: "Model confidence",
  statisticalEdge: "Statistical edge",
  marketValue: "Market value",
};

export const WEIGHT_HELP: Record<WeightKey, string> = {
  modelConfidence: "How complete and stable the supporting sample is",
  statisticalEdge: "How far the season rate sits from the posted line",
  marketValue: "An odds-based price signal, not a fair-probability estimate",
};

export function calculateScore(prop: ScoredProp, weights: Weights): number | null {
  const { modelConfidence, statisticalEdge, marketValue } = prop.factors;
  if (modelConfidence == null || statisticalEdge == null || marketValue == null) return null;
  return (
    (modelConfidence * weights.modelConfidence +
      statisticalEdge * weights.statisticalEdge +
      marketValue * weights.marketValue) /
    100
  );
}

/**
 * Score text color. Strong leans speak in grass; middling scores in deep gold;
 * weak scores fall back to quiet ink — never clay, which is reserved for
 * failures. All shades are the AA-safe `-deep` tokens in day mode.
 */
export function scoreToneClass(score: number | null): string {
  if (score == null) return "text-ink/60";
  if (score >= 80) return "text-grass";
  if (score >= 60) return "text-gold-deep";
  return "text-ink/70";
}

export function scoreBarClass(score: number | null): string {
  if (score == null) return "bg-ink/25";
  if (score >= 80) return "bg-grass";
  if (score >= 60) return "bg-gold";
  return "bg-ink/30";
}

/** Plain-language tier chips — strength carries the tint, direction lives in the words. */
export const TIER_LABEL: Record<ScoredProp["tier"], string> = {
  "strong-over": "Strong over",
  "lean-over": "Lean over",
  neutral: "Neutral",
  "lean-under": "Lean under",
  "strong-under": "Strong under",
};

export const TIER_CLASS: Record<ScoredProp["tier"], string> = {
  "strong-over": "bg-field/15 text-field-deep dark:text-grass",
  "lean-over": "text-gold-deep font-semibold",
  neutral: "text-ink/60",
  "lean-under": "text-gold-deep font-semibold",
  "strong-under": "bg-field/15 text-field-deep dark:text-grass",
};

/** Stable per-prop anchor id so slate links land on the exact row. */
export function leanAnchorId(prop: ScoredProp): string {
  return `lean-${prop.player.id}-${prop.marketKey}-${String(prop.line).replace(/\./g, "_")}`;
}

/** One player's props for a team, plus matchup evidence shared across all of them. */
export interface PropPlayerGroup {
  player: PlayerRef;
  evidence: string[];
  props: ScoredProp[];
}

export interface PropTeamGroup {
  team: TeamRef;
  players: PropPlayerGroup[];
}
