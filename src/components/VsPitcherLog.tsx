import { rateClass } from "@/lib/statColor";
import type { VsPlayerLine, VsPlayerSeasonLine } from "@/lib/mlb/types";

const COLS = ["PA", "H", "HR", "BB", "K", "AVG", "OBP", "SLG"] as const;

function StatCells({ r }: { r: VsPlayerLine }) {
  if (!r.hasHistory) {
    return (
      <td
        colSpan={COLS.length}
        className="px-2 py-1.5 text-right text-ink/50"
      >
        — no history
      </td>
    );
  }
  return (
    <>
      <td className="font-mono px-2 py-1.5 text-right">{r.pa}</td>
      <td className="font-mono px-2 py-1.5 text-right">{r.h}</td>
      <td className="font-mono px-2 py-1.5 text-right">{r.hr}</td>
      <td className="font-mono px-2 py-1.5 text-right">{r.bb}</td>
      <td className="font-mono px-2 py-1.5 text-right">{r.k}</td>
      <td className={`font-mono px-2 py-1.5 text-right ${rateClass("avg", r.avg, r.pa)}`}>
        {r.avg}
      </td>
      <td className={`font-mono px-2 py-1.5 text-right ${rateClass("obp", r.obp, r.pa)}`}>
        {r.obp}
      </td>
      <td className={`font-mono px-2 py-1.5 text-right ${rateClass("slg", r.slg, r.pa)}`}>
        {r.slg}
      </td>
    </>
  );
}

/**
 * Career total plus season-by-season breakdown of a batter's history against
 * one pitcher. There is no per-plate-appearance "vs one pitcher" log in the
 * MLB Stats API, so each season is one aggregated row, not individual games.
 */
export default function VsPitcherLog({
  career,
  seasons,
}: {
  career: VsPlayerLine;
  seasons: VsPlayerSeasonLine[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="nums w-full min-w-max text-sm">
        <caption className="sr-only">
          {career.batter.fullName} vs {career.pitcher.fullName}, season-by-season history
        </caption>
        <thead>
          <tr>
            <th
              scope="col"
              className="font-display px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wider text-ink/50"
            >
              Season
            </th>
            {COLS.map((c) => (
              <th
                key={c}
                scope="col"
                className="font-display px-2 py-1.5 text-right text-xs font-semibold uppercase tracking-wider text-ink/50"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-b border-ink/15 font-semibold">
            <td className="px-2 py-1.5 text-left">Career</td>
            <StatCells r={career} />
          </tr>
          {seasons.length === 0 ? (
            <tr>
              <td
                colSpan={COLS.length + 1}
                className="px-2 py-3 text-center text-ink/50"
              >
                No season-by-season data available.
              </td>
            </tr>
          ) : (
            seasons.map((s) => (
              <tr
                key={s.season}
                className="border-t border-ink/10"
              >
                <td className="font-mono px-2 py-1.5 text-left">{s.season}</td>
                <StatCells r={s} />
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
