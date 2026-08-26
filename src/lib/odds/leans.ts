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
 */
export async function getBestLeans(date?: string): Promise<SlateLean[]> {
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
