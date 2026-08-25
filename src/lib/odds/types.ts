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

/** Which upstream provider resolved a game's odds event. */
export type OddsProvider = "sgo" | "the-odds-api";

/** A game resolved to one provider's event id; ids are only valid within their provider. */
export interface ResolvedOddsEvent {
  provider: OddsProvider;
  eventId: string;
}

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

export type PropDirection = "over" | "under";

export interface PropFactorScores {
  modelConfidence: number | null;
  statisticalEdge: number | null;
  marketValue: number | null;
  cumulative: number | null;
  completeness: "complete" | "partial";
}

/** A `PlayerProp` resolved to our own `PlayerRef` and scored against season stats (+ weather, for HR/TB markets). */
export interface ScoredProp {
  player: PlayerRef;
  marketKey: PropMarketKey;
  line: number;
  overPrice: number;
  underPrice: number;
  tier: PropTier;
  direction: PropDirection;
  factors: PropFactorScores;
  /**
   * Market-specific basis for the tier, ordered most-important first — e.g.
   * `["Season avg: 7.2 (line 6.5)", "Wind blowing out favors the over"]`.
   * Always has at least one entry (`"No stats available"` when `stats` was
   * null). Player-level matchup context (head-to-head history, platoon
   * split, recent form) is *not* included — it's the same across every prop
   * a player has, so it's surfaced once per player instead; see
   * `matchupEvidence` in `lib/odds/highlight.ts`.
   */
  evidence: string[];
}
