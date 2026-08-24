import Link from "next/link";
import PlayerHeadshot from "./PlayerHeadshot";
import { loadPropGroups } from "./PropsSidebarSection";
import { getLiveFeed, seasonOf } from "@/lib/mlb/game";
import type { ScheduleGame } from "@/lib/mlb/types";
import type { PropMarketKey, ScoredProp } from "@/lib/odds/types";

const MARKET_LABELS: Record<PropMarketKey, string> = {
  pitcher_strikeouts: "Strikeouts",
  pitcher_outs: "Outs recorded",
  batter_hits: "Hits",
  batter_total_bases: "Total bases",
  batter_home_runs: "Home runs",
  batter_rbis: "RBIs",
  batter_walks: "Walks",
};

function score(prop: ScoredProp): number | null {
  const { modelConfidence, statisticalEdge, marketValue } = prop.factors;
  if (modelConfidence == null || statisticalEdge == null || marketValue == null) return null;
  return (modelConfidence * 40 + statisticalEdge * 35 + marketValue * 25) / 100;
}

function price(prop: ScoredProp): number {
  return prop.direction === "over" ? prop.overPrice : prop.underPrice;
}

function formatPrice(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
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
    .map((item) => ({ ...item, score: score(item.prop) }))
    .filter((item): item is (typeof item) & { score: number } => item.score != null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  if (leans.length === 0) return null;

  return (
    <section className="mb-5 rounded-md border border-ink/10 bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="eyebrow text-base">Best leans across the slate</h2>
          <p className="mt-1 text-xs text-ink/50">Default weights: confidence 40% · edge 35% · value 25%</p>
        </div>
        <span className="text-xs text-ink/45">Research signals only</span>
      </div>
      <div className="mt-3 divide-y divide-ink/10 border-y border-ink/10">
        {leans.map(({ game, prop, score: leanScore }) => (
          <Link key={`${game.gamePk}-${prop.player.id}-${prop.marketKey}-${prop.line}`} href={`/games/${game.gamePk}/props`} className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-1 py-3 hover:bg-paper">
            <PlayerHeadshot personId={prop.player.id} size={28} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="font-display font-semibold">{prop.player.fullName}</span>
                <span className="text-xs text-ink/45">{game.away.team.abbreviation} at {game.home.team.abbreviation}</span>
              </div>
              <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs">
                <span className={`font-semibold uppercase ${prop.direction === "over" ? "text-cold" : "text-clay"}`}>{prop.direction}</span>
                <span className="text-ink/65">{MARKET_LABELS[prop.marketKey]} {prop.line}</span>
                <span className="nums font-mono text-ink/45">{formatPrice(price(prop))}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="nums font-mono text-lg font-semibold text-gold">{leanScore.toFixed(1)}</span>
              <span aria-hidden className="text-ink/35 transition-transform group-hover:translate-x-0.5">→</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
