import Link from "next/link";
import PlayerHeadshot from "./PlayerHeadshot";
import { rateClass } from "@/lib/statColor";
import type { MatchupSide } from "@/lib/mlb/types";

const COLS = ["PA", "H", "HR", "BB", "K", "AVG", "OBP", "SLG"] as const;

function name(t: { abbreviation?: string; name: string }): string {
  return t.abbreviation ?? t.name;
}

export default function MatchupTable({ side }: { side: MatchupSide }) {
  if (!side.pitcher) {
    return (
      <div className="min-w-0">
        <h3 className="font-display text-base font-semibold">
          {name(side.pitchingTeam)} starter
        </h3>
        <p className="mt-1 text-sm text-ink/50">Probable pitcher TBD.</p>
      </div>
    );
  }

  // min-w-0 lets the overflow-x-auto table scroll instead of stretching the grid column.
  return (
    <div className="min-w-0">
      <h3 className="font-display flex items-center gap-2 text-base font-semibold">
        <PlayerHeadshot personId={side.pitcher.id} size={24} />
        <span>
          {side.pitcher.fullName}{" "}
          <span className="font-normal text-ink/50">
            vs {name(side.battingTeam)} hitters
          </span>
        </span>
      </h3>
      {side.isProxy && (
        <p className="mt-0.5 text-xs text-ink/50">
          Lineup not posted — showing likely hitters (roster leaders by PA).
        </p>
      )}

      <div className="mt-2 overflow-x-auto">
        <table className="nums w-full min-w-max text-sm">
          <caption className="sr-only">
            {side.pitcher.fullName} vs {name(side.battingTeam)} hitters, career
          </caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="font-display px-2 py-1 text-left text-xs font-semibold uppercase tracking-wider text-ink/50"
              >
                Batter
              </th>
              {COLS.map((c) => (
                <th
                  key={c}
                  scope="col"
                  className="font-display px-2 py-1 text-right text-xs font-semibold uppercase tracking-wider text-ink/50"
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
                className="border-t border-ink/10"
              >
                <td className="px-2 py-1 text-left">
                  <Link
                    href={`/players/${r.batter.id}/vs/${r.pitcher.id}`}
                    className="hover:text-grass hover:underline"
                  >
                    {r.batter.fullName}
                  </Link>
                </td>
                {r.hasHistory ? (
                  <>
                    <td className="font-mono px-2 py-1 text-right">{r.pa}</td>
                    <td className="font-mono px-2 py-1 text-right">{r.h}</td>
                    <td className="font-mono px-2 py-1 text-right">{r.hr}</td>
                    <td className="font-mono px-2 py-1 text-right">{r.bb}</td>
                    <td className="font-mono px-2 py-1 text-right">{r.k}</td>
                    <td className={`font-mono px-2 py-1 text-right ${rateClass("avg", r.avg, r.pa)}`}>
                      {r.avg}
                    </td>
                    <td className={`font-mono px-2 py-1 text-right ${rateClass("obp", r.obp, r.pa)}`}>
                      {r.obp}
                    </td>
                    <td className={`font-mono px-2 py-1 text-right ${rateClass("slg", r.slg, r.pa)}`}>
                      {r.slg}
                    </td>
                  </>
                ) : (
                  <td
                    colSpan={COLS.length}
                    className="px-2 py-1 text-right text-ink/50"
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
