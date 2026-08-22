'use client';

import { useState } from 'react';
import type { TeamRef, SaberHitting, SaberPitching } from "@/lib/mlb/types";
import { HitterRow, PitcherRow } from "./RosterStatsRow";
import TeamLogo from "./TeamLogo";

type SortColumn = 'war' | 'wrcPlus' | 'pa' | 'woba' | 'xwoba' | 'bbPct' | 'kPct' | 'eraMinus' | 'ip' | 'era' | 'fip' | 'xfip' | 'kMinusBbPct' | 'name';
type SortDirection = 'asc' | 'desc';

interface RosterStatsTableProps {
  team: TeamRef;
  hitters: Array<{ player: { id: number; fullName: string }; position: string; stats: SaberHitting | null }>;
  pitchers: Array<{ player: { id: number; fullName: string }; position: string; stats: SaberPitching | null }>;
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

function sortPlayers(
  players: Array<{ player: { id: number; fullName: string }; position: string; stats: SaberHitting | SaberPitching | null }>,
  column: SortColumn,
  direction: SortDirection,
): Array<{ player: { id: number; fullName: string }; position: string; stats: SaberHitting | SaberPitching | null }> {
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

function SortHeader({ label, column, currentColumn, direction, onSort, align = 'right' }: SortHeaderProps) {
  const isActive = currentColumn === column;
  const icon = isActive ? (direction === 'asc' ? ' ↑' : ' ↓') : '';

  return (
    <th
      onClick={() => onSort(column)}
      className={`px-3 py-2 font-semibold text-xs uppercase text-ink/50 cursor-pointer hover:text-ink/70 transition-colors ${
        align === 'left' ? 'text-left' : 'text-right'
      } ${isActive ? 'text-ink' : ''}`}
    >
      {label}{icon}
    </th>
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

  return (
    <div className="space-y-4">
      {/* Team header */}
      <h3 className="font-display mb-3 flex items-center gap-2 text-base font-semibold">
        <TeamLogo teamId={team.id} size={18} />
        {team.name}
      </h3>

      {/* Hitters table */}
      {hitters.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-ink/10 bg-card">
                <th className="px-3 py-2 text-left font-semibold text-xs uppercase text-ink/50 w-12">Pos</th>
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
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pitchers table */}
      {pitchers.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-ink/10 bg-card">
                <th className="px-3 py-2 text-left font-semibold text-xs uppercase text-ink/50 w-12">Pos</th>
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
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
