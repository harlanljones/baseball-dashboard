import { rateClass } from "@/lib/statColor";
import StatGradeLegend from "./StatGradeLegend";
import type { VsPlayerLine, VsPlayerSeasonLine } from "@/lib/mlb/types";

const COLS = ["PA", "H", "HR", "BB", "K", "AVG", "OBP", "SLG"] as const;

function StatCells({ r }: { r: VsPlayerLine }) {
  if (!r.hasHistory) {
    return (
      <td
        colSpan={COLS.length}
        className={`td-right text-ink/65`}
      >
        — no history
      </td>
    );
  }
  return (
    <>
      <td className="td-num">{r.pa}</td>
      <td className="td-num">{r.h}</td>
      <td className="td-num">{r.hr}</td>
      <td className="td-num">{r.bb}</td>
      <td className="td-num">{r.k}</td>
      <td className={`td-num ${rateClass("avg", r.avg, r.pa)}`}>
        {r.avg}
      </td>
      <td className={`td-num ${rateClass("obp", r.obp, r.pa)}`}>
        {r.obp}
      </td>
      <td className={`td-num ${rateClass("slg", r.slg, r.pa)}`}>
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
    <div>
      <StatGradeLegend className="mb-3" />
      <div className="overflow-x-auto">
        <table className="table-nums">
        <caption className="sr-only">
          {career.batter.fullName} vs {career.pitcher.fullName}, season-by-season history
        </caption>
        <thead>
          <tr>
            <th
              scope="col"
              className="th-left"
            >
              Season
            </th>
            {COLS.map((c) => (
              <th
                key={c}
                scope="col"
                className="th-right"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-b border-ink/15 font-semibold">
            <td className="td-left">Career</td>
            <StatCells r={career} />
          </tr>
          {seasons.length === 0 ? (
            <tr>
              <td
                colSpan={COLS.length + 1}
                className="px-2 py-3 text-center text-ink/65"
              >
                No season-by-season data available.
              </td>
            </tr>
          ) : (
            seasons.map((s) => (
              <tr
                key={s.season}
                className="divider-t"
              >
                <td className="font-mono px-2 py-1 text-left">{s.season}</td>
                <StatCells r={s} />
              </tr>
            ))
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}
