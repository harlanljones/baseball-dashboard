import type { PlayerRef } from "@/lib/mlb/types";

/** The 7 player-prop markets this sidebar covers. */
export type PropMarketKey =
  | "pitcher_strikeouts"
  | "pitcher_outs"
  | "batter_hits"
  | "batter_total_bases"
  | "batter_home_runs"
  | "batter_rbis"
  | "batter_walks";

/** One sportsbook's Over/Under line for one player in one market. */
export interface PlayerProp {
  marketKey: PropMarketKey;
  /** Player name exactly as the Odds API returns it — matched against our roster by `matchPlayerName`. */
  playerName: string;
  line: number;
  overPrice: number;
  underPrice: number;
}

export type PropTier =
  | "strong-over"
  | "lean-over"
  | "neutral"
  | "lean-under"
  | "strong-under";

/** A `PlayerProp` resolved to our own `PlayerRef` and scored against season stats (+ weather, for HR/TB markets). */
export interface ScoredProp {
  player: PlayerRef;
  marketKey: PropMarketKey;
  line: number;
  overPrice: number;
  underPrice: number;
  tier: PropTier;
  /** Human-readable basis for the tier, e.g. "Season avg: 7.2 (line 6.5)" or "No stats available". */
  statLabel: string;
}
