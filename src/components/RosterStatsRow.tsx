"use client";

import { TD, TD_NUM } from "./tableStyles";
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
    <tr className="border-t border-ink/10 text-sm hover:bg-field/5">
      <td className="font-mono text-xs font-semibold text-ink/70 w-12 px-2 py-1">{position}</td>
      <td className={`${TD} font-medium text-ink truncate`}>{name}</td>
      <td className={`${TD_NUM} ${classes.war}`}>{dec2(stats?.war)}</td>
      <td className={`${TD_NUM} ${classes.wrcPlus}`}>{int(stats?.wrcPlus)}</td>
      <td className={`${TD_NUM} text-ink/65`}>{int(stats?.pa)}</td>
      <td className={`${TD_NUM} ${classes.woba}`}>{rate3(stats?.woba)}</td>
      <td className={`${TD_NUM} ${classes.xwoba}`}>{rate3(stats?.xwoba ?? stats?.woba)}</td>
      <td className={`${TD_NUM} ${classes.bbPct}`}>{pct(stats?.bbPct)}</td>
      <td className={`${TD_NUM} ${classes.kPct}`}>{pct(stats?.kPct)}</td>
    </tr>
  );
}

export function PitcherRow({ position, name, stats, classes }: PitcherRowProps) {
  return (
    <tr className="border-t border-ink/10 text-sm hover:bg-field/5">
      <td className="font-mono text-xs font-semibold text-ink/70 w-12 px-2 py-1">{position}</td>
      <td className={`${TD} font-medium text-ink truncate`}>{name}</td>
      <td className={`${TD_NUM} ${classes.war}`}>{dec2(stats?.war)}</td>
      <td className={`${TD_NUM} ${classes.eraMinus}`}>{int(stats?.eraMinus)}</td>
      <td className={`${TD_NUM} text-ink/65`}>{stats?.ip ?? "—"}</td>
      <td className={`${TD_NUM} ${classes.era}`}>{stats?.era ?? "—"}</td>
      <td className={`${TD_NUM} ${classes.fip}`}>{dec2(stats?.fip)}</td>
      <td className={`${TD_NUM} ${classes.xfip}`}>{dec2(stats?.xfip)}</td>
      <td className={`${TD_NUM} ${classes.kMinusBbPct}`}>
        {pctDec(stats?.kMinusBbPct)}
      </td>
    </tr>
  );
}
