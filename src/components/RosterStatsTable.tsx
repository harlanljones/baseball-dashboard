'use client';

import { useMemo, useState } from 'react';
import type { TeamRef, SaberHitting, SaberPitching } from "@/lib/mlb/types";
import { quantileBand, quantileClass } from "@/lib/statColor";
import { HitterRow, PitcherRow } from "./RosterStatsRow";
import SortableHeaderCell from "./SortableHeaderCell";
import StatGradeLegend from "./StatGradeLegend";
import TeamLogo from "./TeamLogo";

type SortColumn = 'war' | 'wrcPlus' | 'pa' | 'woba' | 'xwoba' | 'bbPct' | 'kPct' | 'eraMinus' | 'ip' | 'era' | 'fip' | 'xfip' | 'kMinusBbPct' | 'name';
type SortDirection = 'asc' | 'desc';

interface RosterStatsTableProps {
  team: TeamRef;
  hitters: Array<PlayerStatsRow<SaberHitting>>;
  pitchers: Array<PlayerStatsRow<SaberPitching>>;
}

interface PlayerStatsRow<TStats extends SaberHitting | SaberPitching> {
  player: { id: number; fullName: string };
  position: string;
  stats: TStats | null;
}

function getSortValue(stats: SaberHitting | SaberPitching | null, column: SortColumn): number | string {
  if (!stats) return column === 'name' ? '' : -Infinity;
  const s = stats as unknown as Partial<Record<SortColumn, string | number>>;
  if (column === 'bbPct') return parseFloat(String(s.bbPct ?? '0')) || 0;
  if (column === 'kPct') return parseFloat(String(s.kPct ?? '0')) || 0;
  if (column === 'ip') return parseFloat(String(s.ip ?? '0')) || 0;
  if (column === 'era') return parseFloat(String(s.era ?? '0')) || 0;
  return s[column] ?? (column === 'name' ? '' : -Infinity);
}

function sortPlayers<TStats extends SaberHitting | SaberPitching>(
  players: Array<PlayerStatsRow<TStats>>,
  column: SortColumn,
  direction: SortDirection,
): Array<PlayerStatsRow<TStats>> {
  const sorted = [...players].sort((a, b) => {
    const aVal = column === 'name' ? a.player.fullName : getSortValue(a.stats, column);
    const bVal = column === 'name' ? b.player.fullName : getSortValue(b.stats, column);

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }

    const aNum = typeof aVal === 'number' ? aVal : 0;
    const bNum = typeof bVal === 'number' ? bVal : 0;
    return direction === 'asc' ? aNum - bNum : bNum - aNum;
  });
  return sorted;
}

interface SortHeaderProps {
  label: string;
  column: SortColumn;
  currentColumn: SortColumn;
  direction: SortDirection;
  onSort: (col: SortColumn) => void;
  align?: 'left' | 'right';
}

function SortHeader(props: SortHeaderProps) {
  return (
    <SortableHeaderCell
      label={props.label}
      sortKey={props.column}
      currentSortKey={props.currentColumn}
      currentDirection={props.direction}
      onSort={(key) => props.onSort(key as SortColumn)}
      align={props.align}
    />
  );
}

export default function RosterStatsTable({ team, hitters, pitchers }: RosterStatsTableProps) {
  const [hitterSort, setHitterSort] = useState<{ column: SortColumn; direction: SortDirection }>({ column: 'war', direction: 'desc' });
  const [pitcherSort, setPitcherSort] = useState<{ column: SortColumn; direction: SortDirection }>({ column: 'war', direction: 'desc' });

  const handleHitterSort = (column: SortColumn) => {
    if (hitterSort.column === column) {
      setHitterSort({ ...hitterSort, direction: hitterSort.direction === 'asc' ? 'desc' : 'asc' });
    } else {
      setHitterSort({ column, direction: 'desc' });
    }
  };

  const handlePitcherSort = (column: SortColumn) => {
    if (pitcherSort.column === column) {
      setPitcherSort({ ...pitcherSort, direction: pitcherSort.direction === 'asc' ? 'desc' : 'asc' });
    } else {
      setPitcherSort({ column, direction: 'desc' });
    }
  };

  const sortedHitters = sortPlayers(hitters, hitterSort.column, hitterSort.direction);
  const sortedPitchers = sortPlayers(pitchers, pitcherSort.column, pitcherSort.direction);

  const hitterBands = useMemo(() => ({
    war: quantileBand(hitters.map(({ stats }) => stats?.war)),
    wrcPlus: quantileBand(hitters.map(({ stats }) => stats?.wrcPlus)),
    woba: quantileBand(hitters.map(({ stats }) => stats?.woba)),
    xwoba: quantileBand(hitters.map(({ stats }) => stats?.xwoba ?? stats?.woba)),
    bbPct: quantileBand(hitters.map(({ stats }) => stats?.bbPct)),
    kPct: quantileBand(hitters.map(({ stats }) => stats?.kPct)),
  }), [hitters]);

  const pitcherBands = useMemo(() => ({
    war: quantileBand(pitchers.map(({ stats }) => stats?.war)),
    eraMinus: quantileBand(pitchers.map(({ stats }) => stats?.eraMinus)),
    era: quantileBand(pitchers.map(({ stats }) => stats?.era)),
    fip: quantileBand(pitchers.map(({ stats }) => stats?.fip)),
    xfip: quantileBand(pitchers.map(({ stats }) => stats?.xfip)),
    kMinusBbPct: quantileBand(pitchers.map(({ stats }) => stats?.kMinusBbPct)),
  }), [pitchers]);

  return (
    <div className="space-y-4">
      {/* Team header */}
      <h3 className="font-display mb-3 flex items-center gap-2 text-base font-semibold">
        <TeamLogo teamId={team.id} size={18} />
        {team.name}
      </h3>

      <StatGradeLegend />

      {/* Hitters table */}
      {hitters.length > 0 && (
        <div className="overflow-x-auto">
          <table className="nums w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-ink/10 bg-card">
                <th className="px-3 py-2 text-left font-semibold text-xs uppercase text-ink/65 w-12">Pos</th>
                <SortHeader label="Name" column="name" currentColumn={hitterSort.column} direction={hitterSort.direction} onSort={handleHitterSort} align="left" />
                <SortHeader label="WAR" column="war" currentColumn={hitterSort.column} direction={hitterSort.direction} onSort={handleHitterSort} />
                <SortHeader label="wRC+" column="wrcPlus" currentColumn={hitterSort.column} direction={hitterSort.direction} onSort={handleHitterSort} />
                <SortHeader label="PA" column="pa" currentColumn={hitterSort.column} direction={hitterSort.direction} onSort={handleHitterSort} />
                <SortHeader label="wOBA" column="woba" currentColumn={hitterSort.column} direction={hitterSort.direction} onSort={handleHitterSort} />
                <SortHeader label="xwOBA" column="xwoba" currentColumn={hitterSort.column} direction={hitterSort.direction} onSort={handleHitterSort} />
                <SortHeader label="BB%" column="bbPct" currentColumn={hitterSort.column} direction={hitterSort.direction} onSort={handleHitterSort} />
                <SortHeader label="K%" column="kPct" currentColumn={hitterSort.column} direction={hitterSort.direction} onSort={handleHitterSort} />
              </tr>
            </thead>
            <tbody>
              {sortedHitters.map((h) => (
                <HitterRow
                  key={h.player.id}
                  position={h.position}
                  name={h.player.fullName}
                  stats={h.stats}
                  classes={{
                    war: quantileClass(h.stats?.war, hitterBands.war, true),
                    wrcPlus: quantileClass(h.stats?.wrcPlus, hitterBands.wrcPlus, true),
                    woba: quantileClass(h.stats?.woba, hitterBands.woba, true),
                    xwoba: quantileClass(h.stats?.xwoba ?? h.stats?.woba, hitterBands.xwoba, true),
                    bbPct: quantileClass(h.stats?.bbPct, hitterBands.bbPct, true),
                    kPct: quantileClass(h.stats?.kPct, hitterBands.kPct, false),
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pitchers table */}
      {pitchers.length > 0 && (
        <div className="overflow-x-auto">
          <table className="nums w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-ink/10 bg-card">
                <th className="px-3 py-2 text-left font-semibold text-xs uppercase text-ink/65 w-12">Pos</th>
                <SortHeader label="Name" column="name" currentColumn={pitcherSort.column} direction={pitcherSort.direction} onSort={handlePitcherSort} align="left" />
                <SortHeader label="WAR" column="war" currentColumn={pitcherSort.column} direction={pitcherSort.direction} onSort={handlePitcherSort} />
                <SortHeader label="ERA-" column="eraMinus" currentColumn={pitcherSort.column} direction={pitcherSort.direction} onSort={handlePitcherSort} />
                <SortHeader label="IP" column="ip" currentColumn={pitcherSort.column} direction={pitcherSort.direction} onSort={handlePitcherSort} />
                <SortHeader label="ERA" column="era" currentColumn={pitcherSort.column} direction={pitcherSort.direction} onSort={handlePitcherSort} />
                <SortHeader label="FIP" column="fip" currentColumn={pitcherSort.column} direction={pitcherSort.direction} onSort={handlePitcherSort} />
                <SortHeader label="xFIP" column="xfip" currentColumn={pitcherSort.column} direction={pitcherSort.direction} onSort={handlePitcherSort} />
                <SortHeader label="K%-BB%" column="kMinusBbPct" currentColumn={pitcherSort.column} direction={pitcherSort.direction} onSort={handlePitcherSort} />
              </tr>
            </thead>
            <tbody>
              {sortedPitchers.map((p) => (
                <PitcherRow
                  key={p.player.id}
                  position={p.position}
                  name={p.player.fullName}
                  stats={p.stats}
                  classes={{
                    war: quantileClass(p.stats?.war, pitcherBands.war, true),
                    eraMinus: quantileClass(p.stats?.eraMinus, pitcherBands.eraMinus, false),
                    era: quantileClass(p.stats?.era, pitcherBands.era, false),
                    fip: quantileClass(p.stats?.fip, pitcherBands.fip, false),
                    xfip: quantileClass(p.stats?.xfip, pitcherBands.xfip, false),
                    kMinusBbPct: quantileClass(p.stats?.kMinusBbPct, pitcherBands.kMinusBbPct, true),
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
