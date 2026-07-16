"use client";

import PlayerHeadshot from "./PlayerHeadshot";
import TeamLogo from "./TeamLogo";
import SortableHeaderCell from "./SortableHeaderCell";
import { statClass } from "@/lib/statColor";
import { useSortableTable } from "@/lib/hooks/useSortableTable";
import type { TeamBoxscore } from "@/lib/mlb/types";

const COLS = ["IP", "ERA", "WHIP", "K"] as const;

function pitchCount(n?: number): string {
  return n == null ? "—" : String(n);
}

function BullpenTable({ box }: { box: TeamBoxscore }) {
  const { sorted, sort, toggleSort } = useSortableTable({
    data: box.bullpen,
    defaultSortKey: "ip" as keyof (typeof box.bullpen)[0],
    defaultDirection: "desc",
  });

  // min-w-0 lets the overflow-x-auto table scroll instead of stretching the grid column.
  return (
    <div className="min-w-0">
      <h3 className="font-display mb-2 flex items-center gap-2 text-base font-semibold">
        <TeamLogo teamId={box.team.id} size={18} />
        {box.team.name}
      </h3>

      {box.bullpen.length === 0 ? (
        <p className="text-sm text-ink/50">No bullpen listed.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="nums w-full min-w-max text-sm">
            <caption className="sr-only">
              {box.team.name} bullpen, season pitching stats and recent pitch-count workload
            </caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="font-display px-2 py-1 text-left text-xs font-semibold uppercase tracking-wider text-ink/50"
                >
                  Pitcher
                </th>
                <SortableHeaderCell
                  label="IP"
                  sortKey="ip"
                  currentSortKey={sort.sortKey}
                  currentDirection={sort.direction}
                  onSort={toggleSort}
                />
                <SortableHeaderCell
                  label="ERA"
                  sortKey="era"
                  currentSortKey={sort.sortKey}
                  currentDirection={sort.direction}
                  onSort={toggleSort}
                />
                <SortableHeaderCell
                  label="WHIP"
                  sortKey="whip"
                  currentSortKey={sort.sortKey}
                  currentDirection={sort.direction}
                  onSort={toggleSort}
                />
                <SortableHeaderCell
                  label="K"
                  sortKey="k"
                  currentSortKey={sort.sortKey}
                  currentDirection={sort.direction}
                  onSort={toggleSort}
                />
                <SortableHeaderCell
                  label="PY"
                  sortKey="pitchesYesterday"
                  currentSortKey={sort.sortKey}
                  currentDirection={sort.direction}
                  onSort={toggleSort}
                  title="Pitches thrown yesterday"
                />
                <SortableHeaderCell
                  label="P3D"
                  sortKey="pitchesLast3"
                  currentSortKey={sort.sortKey}
                  currentDirection={sort.direction}
                  onSort={toggleSort}
                  title="Pitches thrown over the last 3 days"
                />
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => (
                <tr
                  key={p.id}
                  className="border-t border-ink/10"
                >
                  <td className="px-2 py-1 text-left">
                    <span className="flex items-center gap-2">
                      <PlayerHeadshot personId={p.id} size={20} />
                      {p.name}
                    </span>
                  </td>
                  <td className="font-mono px-2 py-1 text-right">{p.ip}</td>
                  <td className={`font-mono px-2 py-1 text-right ${statClass("era", p.era)}`}>
                    {p.era}
                  </td>
                  <td className={`font-mono px-2 py-1 text-right ${statClass("whip", p.whip)}`}>
                    {p.whip}
                  </td>
                  <td className="font-mono px-2 py-1 text-right">{p.k}</td>
                  <td className="font-mono px-2 py-1 text-right">{pitchCount(p.pitchesYesterday)}</td>
                  <td className="font-mono px-2 py-1 text-right">{pitchCount(p.pitchesLast3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * Both teams' available bullpen arms with season stats. The feed's `bullpen`
 * lists pitchers who have not appeared in this game, so during/after a game it
 * reads as "who is still available".
 */
export default function Bullpen({
  away,
  home,
}: {
  away: TeamBoxscore;
  home: TeamBoxscore;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <BullpenTable box={away} />
      <BullpenTable box={home} />
    </div>
  );
}
