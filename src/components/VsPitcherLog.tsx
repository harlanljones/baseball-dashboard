import { rateClass } from "@/lib/statColor";
import StatGradeLegend from "./StatGradeLegend";
import type { VsPlayerLine, VsPlayerSeasonLine } from "@/lib/mlb/types";
import { TD_LEFT, TD_NUM, TD_RIGHT, TH_LEFT, TH_RIGHT } from "./tableStyles";

const COLS = ["PA", "H", "HR", "BB", "K", "AVG", "OBP", "SLG"] as const;

function StatCells({ r }: { r: VsPlayerLine }) {
  if (!r.hasHistory) {
    return (
      <td
        colSpan={COLS.length}
        className={`${TD_RIGHT} text-ink/65`}
      >
        — no history
      </td>
    );
  }
  return (
    <>
      <td className={TD_NUM}>{r.pa}</td>
      <td className={TD_NUM}>{r.h}</td>
      <td className={TD_NUM}>{r.hr}</td>
      <td className={TD_NUM}>{r.bb}</td>
      <td className={TD_NUM}>{r.k}</td>
      <td className={`${TD_NUM} ${rateClass("avg", r.avg, r.pa)}`}>
        {r.avg}
      </td>
      <td className={`${TD_NUM} ${rateClass("obp", r.obp, r.pa)}`}>
        {r.obp}
      </td>
      <td className={`${TD_NUM} ${rateClass("slg", r.slg, r.pa)}`}>
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
        <table className="nums w-full min-w-max text-sm">
        <caption className="sr-only">
          {career.batter.fullName} vs {career.pitcher.fullName}, season-by-season history
        </caption>
        <thead>
          <tr>
            <th
              scope="col"
              className={TH_LEFT}
            >
              Season
            </th>
            {COLS.map((c) => (
              <th
                key={c}
                scope="col"
                className={TH_RIGHT}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-b border-ink/15 font-semibold">
            <td className={TD_LEFT}>Career</td>
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
                className="border-t border-ink/10"
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
