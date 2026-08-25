import Link from "next/link";
import PlayerHeadshot from "./PlayerHeadshot";
import { loadPropGroups } from "./PropsSidebarSection";
import {
  DEFAULT_WEIGHTS,
  MARKET_LABELS,
  calculateScore,
  leanAnchorId,
} from "@/lib/odds/board";
import { getLiveFeed, seasonOf } from "@/lib/mlb/game";
import type { ScheduleGame } from "@/lib/mlb/types";
import type { ScoredProp } from "@/lib/odds/types";

function leanPrice(prop: ScoredProp): number {
  return prop.direction === "over" ? prop.overPrice : prop.underPrice;
}

function formatPrice(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

function DirectionChip({ direction }: { direction: "over" | "under" }) {
  return (
    <span className="rounded-sm border border-ink/25 px-1 py-px text-xs font-semibold uppercase tracking-wider text-ink/75">
      {direction}
    </span>
  );
}

export default async function BestLeansSection({ games }: { games: ScheduleGame[] }) {
  const previewGames = games.filter((game) => game.state === "Preview").slice(0, 8);
  const results = await Promise.all(
    previewGames.map(async (game) => {
      try {
        const feed = await getLiveFeed(game.gamePk);
        const groups = await loadPropGroups({ feed, season: seasonOf(feed), weather: null });
        return groups.flatMap((group) =>
          group.players.flatMap((player) =>
            player.props.map((prop) => ({
              game,
              prop: player.evidence.length ? { ...prop, evidence: [...player.evidence, ...prop.evidence] } : prop,
            })),
          ),
        );
      } catch {
        return [];
      }
    }),
  );
  const leans = results
    .flat()
    .map((item) => ({ ...item, score: calculateScore(item.prop, DEFAULT_WEIGHTS) }))
    .filter((item): item is (typeof item) & { score: number } => item.score != null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  if (leans.length === 0) {
    return (
      <section className="mb-5 rounded-md border border-dashed border-ink/20 bg-card p-4">
        <h2 className="eyebrow text-base">Best leans across the slate</h2>
        <p className="mt-1 max-w-xl text-sm text-ink/65">
          No scored leans today — player-prop odds may be unavailable, or no edge clears the default weights.
        </p>
      </section>
    );
  }

  return (
    <section className="mb-5 rounded-md border border-ink/10 bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="eyebrow text-base">Best leans across the slate</h2>
          <p className="mt-1 text-xs text-ink/65">
            Default weights: confidence {DEFAULT_WEIGHTS.modelConfidence}% · edge {DEFAULT_WEIGHTS.statisticalEdge}% · value {DEFAULT_WEIGHTS.marketValue}%
          </p>
        </div>
        <span className="text-xs text-ink/65">Research signals only</span>
      </div>
      <div className="mt-3 divide-y divide-ink/10 border-y border-ink/10">
        {leans.map(({ game, prop, score: leanScore }) => (
          <Link
            key={`${game.gamePk}-${prop.player.id}-${prop.marketKey}-${prop.line}`}
            href={`/games/${game.gamePk}/props#${leanAnchorId(prop)}`}
            className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-1 py-3 hover:bg-paper"
          >
            <PlayerHeadshot personId={prop.player.id} size={28} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="font-display font-semibold">{prop.player.fullName}</span>
                <span className="text-xs text-ink/65">{game.away.team.abbreviation} at {game.home.team.abbreviation}</span>
              </div>
              <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-1 text-xs">
                <DirectionChip direction={prop.direction} />
                <span className="text-ink/75">{MARKET_LABELS[prop.marketKey]} {prop.line}</span>
                <span className="nums font-mono text-ink/65">{formatPrice(leanPrice(prop))}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="nums font-mono text-lg font-semibold text-gold-deep">{leanScore.toFixed(1)}</span>
              <span aria-hidden className="text-ink/35 transition-transform group-hover:translate-x-0.5">→</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
