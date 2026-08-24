'use client';

import type { SaberHitting, SaberPitching } from "@/lib/mlb/types";

function rate3(n?: number): string {
  if (n == null) return "—";
  return n.toFixed(3).replace(/^0(?=\.)/, "");
}

function int(n?: number): string {
  return n == null ? "—" : String(Math.round(n));
}

function dec2(n?: number): string {
  return n == null ? "—" : n.toFixed(2);
}

function pct(val?: string): string {
  return val ?? "—";
}

function pctDec(val?: number): string {
  return val == null ? "—" : `${(val * 100).toFixed(1)}%`;
}

interface HitterRowProps {
  position: string;
  name: string;
  stats: SaberHitting | null;
  classes: {
    war: string;
    wrcPlus: string;
    woba: string;
    xwoba: string;
    bbPct: string;
    kPct: string;
  };
}

interface PitcherRowProps {
  position: string;
  name: string;
  stats: SaberPitching | null;
  classes: {
    war: string;
    eraMinus: string;
    era: string;
    fip: string;
    xfip: string;
    kMinusBbPct: string;
  };
}

export function HitterRow({ position, name, stats, classes }: HitterRowProps) {
  return (
    <tr className="border-t border-ink/5 text-sm hover:bg-field/5">
      <td className="px-3 py-2 font-mono text-xs font-semibold text-ink/70 w-12">{position}</td>
      <td className="px-3 py-2 font-medium text-ink truncate">{name}</td>
      <td className={`px-3 py-2 font-mono text-right ${classes.war}`}>{dec2(stats?.war)}</td>
      <td className={`px-3 py-2 font-mono text-right ${classes.wrcPlus}`}>{int(stats?.wrcPlus)}</td>
      <td className="px-3 py-2 font-mono text-right text-ink/60">{int(stats?.pa)}</td>
      <td className={`px-3 py-2 font-mono text-right ${classes.woba}`}>{rate3(stats?.woba)}</td>
      <td className={`px-3 py-2 font-mono text-right ${classes.xwoba}`}>{rate3(stats?.xwoba ?? stats?.woba)}</td>
      <td className={`px-3 py-2 font-mono text-right ${classes.bbPct}`}>{pct(stats?.bbPct)}</td>
      <td className={`px-3 py-2 font-mono text-right ${classes.kPct}`}>{pct(stats?.kPct)}</td>
    </tr>
  );
}

export function PitcherRow({ position, name, stats, classes }: PitcherRowProps) {
  return (
    <tr className="border-t border-ink/5 text-sm hover:bg-field/5">
      <td className="px-3 py-2 font-mono text-xs font-semibold text-ink/70 w-12">{position}</td>
      <td className="px-3 py-2 font-medium text-ink truncate">{name}</td>
      <td className={`px-3 py-2 font-mono text-right ${classes.war}`}>{dec2(stats?.war)}</td>
      <td className={`px-3 py-2 font-mono text-right ${classes.eraMinus}`}>{int(stats?.eraMinus)}</td>
      <td className="px-3 py-2 font-mono text-right text-ink/60">{stats?.ip ?? "—"}</td>
      <td className={`px-3 py-2 font-mono text-right ${classes.era}`}>{stats?.era ?? "—"}</td>
      <td className={`px-3 py-2 font-mono text-right ${classes.fip}`}>{dec2(stats?.fip)}</td>
      <td className={`px-3 py-2 font-mono text-right ${classes.xfip}`}>{dec2(stats?.xfip)}</td>
      <td className={`px-3 py-2 font-mono text-right ${classes.kMinusBbPct}`}>
        {pctDec(stats?.kMinusBbPct)}
      </td>
    </tr>
  );
}
