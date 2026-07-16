'use client';

import type { SaberHitting, SaberPitching } from "@/lib/mlb/types";
import { statClass, GOOD_CLASS, BAD_CLASS } from "@/lib/statColor";

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

function pctClass(val?: string): string {
  if (!val) return "";
  const num = parseFloat(val);
  return Number.isFinite(num) ? statClass("bbPct", num) : "";
}

function kMinusBbPctClass(val?: number): string {
  if (val == null) return "";
  // K%-BB% ranges roughly -5 to +10; good is 3+, bad is -3 or lower
  return val >= 3 ? GOOD_CLASS : val <= -3 ? BAD_CLASS : "";
}

interface HitterRowProps {
  position: string;
  name: string;
  stats: SaberHitting | null;
}

interface PitcherRowProps {
  position: string;
  name: string;
  stats: SaberPitching | null;
}

export function HitterRow({ position, name, stats }: HitterRowProps) {
  return (
    <tr className="border-t border-ink/5 text-sm hover:bg-field/5">
      <td className="px-3 py-2 font-mono text-xs font-semibold text-ink/70 w-12">{position}</td>
      <td className="px-3 py-2 font-medium text-ink truncate">{name}</td>
      <td className={`px-3 py-2 font-mono text-right ${statClass("warHitter", stats?.war) ?? ""}`}>{dec2(stats?.war)}</td>
      <td className={`px-3 py-2 font-mono text-right ${statClass("wrcPlus", stats?.wrcPlus) ?? ""}`}>{int(stats?.wrcPlus)}</td>
      <td className="px-3 py-2 font-mono text-right text-ink/60">{int(stats?.pa)}</td>
      <td className={`px-3 py-2 font-mono text-right ${statClass("woba", stats?.woba) ?? ""}`}>{rate3(stats?.woba)}</td>
      <td className={`px-3 py-2 font-mono text-right ${statClass("woba", stats?.xwoba ?? stats?.woba) ?? ""}`}>{rate3(stats?.xwoba ?? stats?.woba)}</td>
      <td className={`px-3 py-2 font-mono text-right ${pctClass(stats?.bbPct)}`}>{pct(stats?.bbPct)}</td>
      <td className={`px-3 py-2 font-mono text-right ${pctClass(stats?.kPct)}`}>{pct(stats?.kPct)}</td>
    </tr>
  );
}

export function PitcherRow({ position, name, stats }: PitcherRowProps) {
  return (
    <tr className="border-t border-ink/5 text-sm hover:bg-field/5">
      <td className="px-3 py-2 font-mono text-xs font-semibold text-ink/70 w-12">{position}</td>
      <td className="px-3 py-2 font-medium text-ink truncate">{name}</td>
      <td className={`px-3 py-2 font-mono text-right ${statClass("warPitcher", stats?.war) ?? ""}`}>{dec2(stats?.war)}</td>
      <td className={`px-3 py-2 font-mono text-right ${statClass("eraMinus", stats?.eraMinus) ?? ""}`}>{int(stats?.eraMinus)}</td>
      <td className="px-3 py-2 font-mono text-right text-ink/60">{stats?.ip ?? "—"}</td>
      <td className={`px-3 py-2 font-mono text-right ${statClass("era", stats?.era) ?? ""}`}>{stats?.era ?? "—"}</td>
      <td className={`px-3 py-2 font-mono text-right ${statClass("fip", stats?.fip) ?? ""}`}>{dec2(stats?.fip)}</td>
      <td className={`px-3 py-2 font-mono text-right ${statClass("xfip", stats?.xfip) ?? ""}`}>{dec2(stats?.xfip)}</td>
      <td className={`px-3 py-2 font-mono text-right ${kMinusBbPctClass(stats?.kMinusBbPct)}`}>
        {pctDec(stats?.kMinusBbPct)}
      </td>
    </tr>
  );
}
