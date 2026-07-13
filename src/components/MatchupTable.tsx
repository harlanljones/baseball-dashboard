import type { MatchupSide } from "@/lib/mlb/types";

const COLS = ["PA", "H", "HR", "BB", "K", "AVG", "OBP", "SLG"] as const;

function name(t: { abbreviation?: string; name: string }): string {
  return t.abbreviation ?? t.name;
}

export default function MatchupTable({ side }: { side: MatchupSide }) {
  if (!side.pitcher) {
    return (
      <div>
        <h3 className="text-sm font-semibold">
          {name(side.pitchingTeam)} starter
        </h3>
        <p className="mt-1 text-sm text-neutral-500">Probable pitcher TBD.</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-semibold">
        {side.pitcher.fullName}{" "}
        <span className="font-normal text-neutral-500">
          vs {name(side.battingTeam)} hitters
        </span>
      </h3>
      {side.isProxy && (
        <p className="mt-0.5 text-xs text-neutral-500">
          Lineup not posted — showing likely hitters (roster leaders by PA).
        </p>
      )}

      <div className="mt-2 overflow-x-auto">
        <table className="nums w-full min-w-max text-sm">
          <thead>
            <tr>
              <th className="px-2 py-1 text-left font-medium text-neutral-500">
                Batter
              </th>
              {COLS.map((c) => (
                <th
                  key={c}
                  className="px-2 py-1 text-right font-medium text-neutral-500"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {side.rows.map((r) => (
              <tr
                key={r.batter.id}
                className="border-t border-neutral-100 dark:border-neutral-800"
              >
                <td className="px-2 py-1 text-left">{r.batter.fullName}</td>
                {r.hasHistory ? (
                  <>
                    <td className="px-2 py-1 text-right">{r.pa}</td>
                    <td className="px-2 py-1 text-right">{r.h}</td>
                    <td className="px-2 py-1 text-right">{r.hr}</td>
                    <td className="px-2 py-1 text-right">{r.bb}</td>
                    <td className="px-2 py-1 text-right">{r.k}</td>
                    <td className="px-2 py-1 text-right">{r.avg}</td>
                    <td className="px-2 py-1 text-right">{r.obp}</td>
                    <td className="px-2 py-1 text-right">{r.slg}</td>
                  </>
                ) : (
                  <td
                    colSpan={COLS.length}
                    className="px-2 py-1 text-right text-neutral-400"
                  >
                    — no career history
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
