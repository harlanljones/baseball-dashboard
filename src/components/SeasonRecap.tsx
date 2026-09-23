import GameCard from "@/components/GameCard";
import TeamLogo from "@/components/TeamLogo";
import type { PostseasonSeries, SeasonRecap as SeasonRecapData } from "@/lib/mlb/types";

function SeriesRow({ series }: { series: PostseasonSeries }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="font-display text-sm font-semibold uppercase tracking-wide">
          {series.label}
        </p>
        {series.status && <p className="text-xs text-ink/65">{series.status}</p>}
      </div>
      {series.winner && (
        <span className="flex shrink-0 items-center gap-1.5">
          <TeamLogo teamId={series.winner.id} size={20} />
          <span className="font-mono text-sm font-semibold">
            {series.winner.abbreviation ?? series.winner.name}
          </span>
        </span>
      )}
    </li>
  );
}

/** Champion banner, postseason series list, and the final game — nothing renders until there's a series to show. */
export default function SeasonRecap({ recap }: { recap: SeasonRecapData }) {
  if (recap.series.length === 0) return null;

  const worldSeries = recap.series.find((s) => s.gameType === "W");

  return (
    <div className="rounded-md border border-ink/15 bg-card p-4 shadow-sm">
      {recap.champion && (
        <div className="mb-3 flex items-center gap-3 border-b border-ink/10 pb-3">
          <TeamLogo teamId={recap.champion.id} size={40} />
          <div>
            <p className="font-display text-lg font-bold uppercase leading-tight tracking-wide">
              {recap.champion.name} win the {recap.season} World Series
            </p>
            {worldSeries?.status && (
              <p className="nums text-sm text-ink/65">{worldSeries.status}</p>
            )}
          </div>
        </div>
      )}

      <ul className="divide-y divide-ink/10">
        {recap.series.map((series) => (
          <SeriesRow key={series.id} series={series} />
        ))}
      </ul>

      {recap.finalGame && (
        <div className="mt-4">
          <h3 className="eyebrow mb-2 text-sm">Final game</h3>
          <GameCard game={recap.finalGame} />
        </div>
      )}
    </div>
  );
}
