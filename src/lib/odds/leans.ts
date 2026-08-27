import { unstable_cache } from "next/cache";

import { easternToday } from "@/lib/mlb/client";
import { getSchedule } from "@/lib/mlb/schedule";
import { loadPropGroups } from "@/components/PropsSidebarSection";
import type { ScheduleGame } from "@/lib/mlb/types";
import {
  DEFAULT_WEIGHTS,
  calculateScore,
  leanAnchorId,
  propContextFromScheduleGame,
} from "@/lib/odds/board";
import type { PropDirection, PropMarketKey } from "@/lib/odds/types";

/** Games sampled per slate. Beyond this the provider board stops paying for itself. */
const MAX_GAMES = 8;

/** Leans returned to the client. */
const MAX_LEANS = 5;

/**
 * How long a scored slate stays good, in seconds.
 *
 * The inputs behind a score barely move — the provider's board and the season
 * stats are both cached for hours — but scoring a slate means parsing a
 * multi-megabyte board and ranking every prop on it, and that ran on every
 * single request. Caching the *result* is what collapses it. Five minutes
 * keeps the list honest as games leave the Preview state.
 */
const LEANS_TTL = 5 * 60;

/**
 * One row of the cross-slate leans list, flattened to exactly what the row
 * renders. Keeping this narrow rather than shipping whole `ScheduleGame` and
 * `ScoredProp` objects is what keeps the lazy-loaded payload small.
 */
export interface SlateLean {
  gamePk: number;
  anchor: string;
  matchup: string;
  playerId: number;
  playerName: string;
  marketKey: PropMarketKey;
  line: number;
  direction: PropDirection;
  price: number;
  score: number;
}

/** The season a scheduled game belongs to, from its start time. */
function seasonOf(game: ScheduleGame): number {
  return new Date(game.gameDate).getUTCFullYear();
}

/**
 * The strongest scored leans across a slate, best first.
 *
 * Each game contributes its prop board with no feed and no matchup lookups:
 * this list shows scores, never evidence lines, so the lookups behind those
 * lines would be work no reader ever sees. A game whose odds are missing or
 * whose provider call fails contributes nothing rather than failing the slate.
 *
 * Uncached — {@link getBestLeans} is the entry point callers should use.
 */
async function computeBestLeans(date: string): Promise<SlateLean[]> {
  const { games } = await getSchedule(date);
  const previewGames = games.filter((g) => g.state === "Preview").slice(0, MAX_GAMES);

  const perGame = await Promise.all(
    previewGames.map(async (game) => {
      try {
        const groups = await loadPropGroups({
          game: propContextFromScheduleGame(game),
          season: seasonOf(game),
          weather: null,
        });
        return groups.flatMap((group) =>
          group.players.flatMap((player) =>
            player.props.map((prop) => {
              const score = calculateScore(prop, DEFAULT_WEIGHTS);
              if (score == null) return null;
              return {
                gamePk: game.gamePk,
                anchor: leanAnchorId(prop),
                matchup: `${game.away.team.abbreviation} at ${game.home.team.abbreviation}`,
                playerId: prop.player.id,
                playerName: prop.player.fullName,
                marketKey: prop.marketKey,
                line: prop.line,
                direction: prop.direction,
                price: prop.direction === "over" ? prop.overPrice : prop.underPrice,
                score,
              } satisfies SlateLean;
            }),
          ),
        );
      } catch {
        return [];
      }
    }),
  );

  return perGame
    .flat()
    .filter((lean): lean is SlateLean => lean != null)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_LEANS);
}

/**
 * Signals "nothing to cache" out of the cached scope.
 *
 * An empty slate is never a fact worth storing. Every upstream here is
 * fail-soft — a provider timeout, a rate-limited key, or lines that have not
 * posted yet all surface as zero leans — so caching that result would pin a
 * passing failure into the shared cache and keep serving it long after the
 * data recovered. A rejected promise is not persisted, so throwing is what
 * keeps the empty case cheap *and* self-healing.
 */
class NoLeans extends Error {}

/**
 * A scored slate, kept for {@link LEANS_TTL}. Throwing on an empty result is
 * what keeps this layer holding only real slates: a rejected promise is never
 * persisted, so a passing failure cannot claim the long TTL.
 */
const cachedScoredSlate = unstable_cache(
  async (date: string): Promise<SlateLean[]> => {
    const leans = await computeBestLeans(date);
    if (leans.length === 0) throw new NoLeans();
    return leans;
  },
  ["best-leans"],
  { revalidate: LEANS_TTL, tags: ["best-leans"] },
);

/**
 * The strongest scored leans across a slate, best first.
 *
 * Real slates are cached for {@link LEANS_TTL} via {@link cachedScoredSlate}. An
 * empty slate is *not* cached: {@link cachedScoredSlate} throws `NoLeans` on
 * empty (a rejected promise is never persisted), and we return `[]` here only
 * after that cache lookup, so the empty case is recomputed on the next request
 * rather than pinned. That keeps a passing failure (rate-limited key, lines not
 * yet posted) from claiming a long cache TTL while a real slate still rides the
 * long-lived cache.
 *
 * The date is resolved before it reaches the cache so "today" can never key the
 * same entry as an explicit date — or, worse, serve yesterday's slate after the
 * Eastern-time rollover.
 */
export async function getBestLeans(date?: string): Promise<SlateLean[]> {
  const key = date ?? easternToday();
  try {
    return await cachedScoredSlate(key);
  } catch (error) {
    if (error instanceof NoLeans) return [];
    throw error;
  }
}
