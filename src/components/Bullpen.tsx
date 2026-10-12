"use client";

import Link from "next/link";
import PlayerHeadshot from "./PlayerHeadshot";
import TeamLogo from "./TeamLogo";
import SortableHeaderCell from "./SortableHeaderCell";
import StatGradeLegend from "./StatGradeLegend";
import { statClass } from "@/lib/statColor";
import { useSortableTable } from "@/lib/hooks/useSortableTable";
import type { TeamBoxscore } from "@/lib/mlb/types";


function pitchCount(n?: number): string {
  return n == null ? "—" : String(n);
}

function formatStat(n?: number): string {
  return n == null ? "—" : n.toFixed(2);
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
        <p className="text-sm text-ink/65">No bullpen listed.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-nums">
            <caption className="sr-only">
              {box.team.name} bullpen, season pitching stats and recent pitch-count workload
            </caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="th-left"
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
                  label="FIP"
                  sortKey="fip"
                  currentSortKey={sort.sortKey}
                  currentDirection={sort.direction}
                  onSort={toggleSort}
                  title="Fielding Independent Pitching"
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
                  className="divider-t"
                >
                  <td className="td-left">
                    <span className="flex items-center gap-2">
                      <PlayerHeadshot personId={p.id} size={20} />
                      {p.name}
                    </span>
                  </td>
                  <td className="td-num">{p.ip}</td>
                  <td className={`td-num ${statClass("era", p.era)}`}>
                    {p.era ?? "—"}
                  </td>
                  <td className={`td-num ${statClass("fip", p.fip)}`}>
                    {formatStat(p.fip)}
                  </td>
                  <td className="td-num">{p.k}</td>
                  <td className="td-num">{pitchCount(p.pitchesYesterday)}</td>
                  <td className="td-num">{pitchCount(p.pitchesLast3)}</td>
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
    <div className="fade-in">
      <StatGradeLegend className="mb-4" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <BullpenTable box={away} />
        <BullpenTable box={home} />
      </div>
      <p className="mt-3 max-w-xl divider-t pt-2 text-xs text-ink/65">
        PY = pitches thrown yesterday · P3D = pitches over the last three days,
        heavy counts mean the arm is likely unavailable today. Definitions for
        every column live in the{" "}
        <Link href="/glossary" className="link-subtle">
          glossary
        </Link>
        .
      </p>
    </div>
  );
}
