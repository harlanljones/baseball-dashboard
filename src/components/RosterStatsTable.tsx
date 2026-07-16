'use client';

import type { TeamRef, SaberHitting, SaberPitching } from "@/lib/mlb/types";
import { HitterRow, PitcherRow } from "./RosterStatsRow";
import TeamLogo from "./TeamLogo";

interface RosterStatsTableProps {
  team: TeamRef;
  hitters: Array<{ player: { id: number; fullName: string }; position: string; stats: SaberHitting | null }>;
  pitchers: Array<{ player: { id: number; fullName: string }; position: string; stats: SaberPitching | null }>;
}

export default function RosterStatsTable({ team, hitters, pitchers }: RosterStatsTableProps) {
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
                <th className="px-3 py-2 text-left font-semibold text-xs uppercase text-ink/50">Name</th>
                <th className="px-3 py-2 text-right font-semibold text-xs uppercase text-ink/50">WAR</th>
                <th className="px-3 py-2 text-right font-semibold text-xs uppercase text-ink/50">wRC+</th>
                <th className="px-3 py-2 text-right font-semibold text-xs uppercase text-ink/50">PA</th>
                <th className="px-3 py-2 text-right font-semibold text-xs uppercase text-ink/50">wOBA</th>
                <th className="px-3 py-2 text-right font-semibold text-xs uppercase text-ink/50">xwOBA</th>
                <th className="px-3 py-2 text-right font-semibold text-xs uppercase text-ink/50">BB%</th>
                <th className="px-3 py-2 text-right font-semibold text-xs uppercase text-ink/50">K%</th>
              </tr>
            </thead>
            <tbody>
              {hitters.map((h) => (
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
                <th className="px-3 py-2 text-left font-semibold text-xs uppercase text-ink/50">Name</th>
                <th className="px-3 py-2 text-right font-semibold text-xs uppercase text-ink/50">WAR</th>
                <th className="px-3 py-2 text-right font-semibold text-xs uppercase text-ink/50">ERA-</th>
                <th className="px-3 py-2 text-right font-semibold text-xs uppercase text-ink/50">IP</th>
                <th className="px-3 py-2 text-right font-semibold text-xs uppercase text-ink/50">ERA</th>
                <th className="px-3 py-2 text-right font-semibold text-xs uppercase text-ink/50">FIP</th>
                <th className="px-3 py-2 text-right font-semibold text-xs uppercase text-ink/50">xFIP</th>
                <th className="px-3 py-2 text-right font-semibold text-xs uppercase text-ink/50">K%-BB%</th>
              </tr>
            </thead>
            <tbody>
              {pitchers.map((p) => (
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
