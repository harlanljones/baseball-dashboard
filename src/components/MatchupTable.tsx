"use client";

import Link from "next/link";
import PlayerHeadshot from "./PlayerHeadshot";
import SortableHeaderCell from "./SortableHeaderCell";
import { rateClass } from "@/lib/statColor";
import { useSortableTable } from "@/lib/hooks/useSortableTable";
import type { MatchupSide } from "@/lib/mlb/types";

const CAREER_COLS = ["PA", "H", "HR", "BB", "K", "AVG", "OBP", "SLG"] as const;
const SPLIT_COLS = ["PA", "OBP", "OPS", "BB%", "K%"] as const;

function name(t: { abbreviation?: string; name: string }): string {
  return t.abbreviation ?? t.name;
}

function PlatoonSplitTable({ side }: { side: MatchupSide }) {
  const { sorted, sort, toggleSort } = useSortableTable({
    data: side.rows,
    defaultSortKey: "platoon.ops" as unknown as keyof (typeof side.rows)[0],
    defaultDirection: "desc",
  });

  return (
    <div className="mt-4 min-w-0">
      <h4 className="font-display text-xs font-semibold uppercase tracking-wider text-ink/50">
        This season vs {side.pitcherHand === "L" ? "LHP" : "RHP"}
      </h4>
      <div className="mt-1 overflow-x-auto">
        <table className="nums w-full min-w-max text-sm">
          <caption className="sr-only">
            {name(side.battingTeam)} hitters, this season vs{" "}
            {side.pitcherHand === "L" ? "left-handed" : "right-handed"} pitching
          </caption>
          <thead>
            <tr>
              <th scope="col" className="font-display px-2 py-1 text-left text-xs font-semibold uppercase tracking-wider text-ink/50">
                Batter
              </th>
              <SortableHeaderCell
                label="PA"
                sortKey="platoon.pa"
                currentSortKey={sort.sortKey}
                currentDirection={sort.direction}
                onSort={toggleSort}
              />
              <SortableHeaderCell
                label="OBP"
                sortKey="platoon.obp"
                currentSortKey={sort.sortKey}
                currentDirection={sort.direction}
                onSort={toggleSort}
              />
              <SortableHeaderCell
                label="OPS"
                sortKey="platoon.ops"
                currentSortKey={sort.sortKey}
                currentDirection={sort.direction}
                onSort={toggleSort}
              />
              <SortableHeaderCell
                label="BB%"
                sortKey="platoon.bbPct"
                currentSortKey={sort.sortKey}
                currentDirection={sort.direction}
                onSort={toggleSort}
              />
              <SortableHeaderCell
                label="K%"
                sortKey="platoon.kPct"
                currentSortKey={sort.sortKey}
                currentDirection={sort.direction}
                onSort={toggleSort}
              />
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
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
                <td className="font-mono px-2 py-1 text-right">{r.platoon.pa}</td>
                <td className={`font-mono px-2 py-1 text-right ${rateClass("obp", r.platoon.obp, r.platoon.pa)}`}>
                  {r.platoon.obp}
                </td>
                <td className={`font-mono px-2 py-1 text-right ${rateClass("ops", r.platoon.ops, r.platoon.pa)}`}>
                  {r.platoon.ops}
                </td>
                <td className={`font-mono px-2 py-1 text-right ${rateClass("bbPct", r.platoon.bbPct, r.platoon.pa)}`}>
                  {r.platoon.bbPct}
                </td>
                <td className={`font-mono px-2 py-1 text-right ${rateClass("kPct", r.platoon.kPct, r.platoon.pa)}`}>
                  {r.platoon.kPct}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NoPitcherSplits({ side }: { side: MatchupSide }) {
  const { sorted, sort, toggleSort } = useSortableTable({
    data: side.noPitcherRows,
    defaultSortKey: "split.ops" as unknown as keyof (typeof side.noPitcherRows)[0],
    defaultDirection: "desc",
  });

  const splitLabel = side.noPitcherRows[0]?.isHome ? "home" : "road";
  return (
    <div className="min-w-0">
      <h3 className="font-display text-base font-semibold">
        {name(side.pitchingTeam)} starter
      </h3>
      <p className="mt-1 text-sm text-ink/50">
        Probable pitcher TBD — showing {name(side.battingTeam)} hitters&rsquo; {splitLabel} splits
        this season.
      </p>

      <div className="mt-2 overflow-x-auto">
        <table className="nums w-full min-w-max text-sm">
          <caption className="sr-only">
            {name(side.battingTeam)} hitters, {splitLabel} splits this season
          </caption>
          <thead>
            <tr>
              <th scope="col" className="font-display px-2 py-1 text-left text-xs font-semibold uppercase tracking-wider text-ink/50">
                Batter
              </th>
              <SortableHeaderCell
                label="PA"
                sortKey="split.pa"
                currentSortKey={sort.sortKey}
                currentDirection={sort.direction}
                onSort={toggleSort}
              />
              <SortableHeaderCell
                label="OBP"
                sortKey="split.obp"
                currentSortKey={sort.sortKey}
                currentDirection={sort.direction}
                onSort={toggleSort}
              />
              <SortableHeaderCell
                label="OPS"
                sortKey="split.ops"
                currentSortKey={sort.sortKey}
                currentDirection={sort.direction}
                onSort={toggleSort}
              />
              <SortableHeaderCell
                label="BB%"
                sortKey="split.bbPct"
                currentSortKey={sort.sortKey}
                currentDirection={sort.direction}
                onSort={toggleSort}
              />
              <SortableHeaderCell
                label="K%"
                sortKey="split.kPct"
                currentSortKey={sort.sortKey}
                currentDirection={sort.direction}
                onSort={toggleSort}
              />
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.batter.id} className="border-t border-ink/10">
                <td className="px-2 py-1 text-left">{r.batter.fullName}</td>
                <td className="font-mono px-2 py-1 text-right">{r.split.pa}</td>
                <td className={`font-mono px-2 py-1 text-right ${rateClass("obp", r.split.obp, r.split.pa)}`}>
                  {r.split.obp}
                </td>
                <td className={`font-mono px-2 py-1 text-right ${rateClass("ops", r.split.ops, r.split.pa)}`}>
                  {r.split.ops}
                </td>
                <td className={`font-mono px-2 py-1 text-right ${rateClass("bbPct", r.split.bbPct, r.split.pa)}`}>
                  {r.split.bbPct}
                </td>
                <td className={`font-mono px-2 py-1 text-right ${rateClass("kPct", r.split.kPct, r.split.pa)}`}>
                  {r.split.kPct}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function MatchupTable({ side }: { side: MatchupSide }) {
  if (!side.pitcher) {
    if (side.noPitcherRows.length === 0) {
      return (
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold">
            {name(side.pitchingTeam)} starter
          </h3>
          <p className="mt-1 text-sm text-ink/50">Probable pitcher TBD.</p>
        </div>
      );
    }
    return <NoPitcherSplits side={side} />;
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
              <th scope="col" className="font-display px-2 py-1 text-left text-xs font-semibold uppercase tracking-wider text-ink/50">
                Batter
              </th>
              {CAREER_COLS.map((c) => (
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
                    colSpan={CAREER_COLS.length}
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

      {side.pitcherHand && <PlatoonSplitTable side={side} />}
    </div>
  );
}
