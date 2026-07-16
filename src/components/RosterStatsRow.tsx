'use client';

import type { SaberHitting, SaberPitching } from "@/lib/mlb/types";
import { statClass } from "@/lib/statColor";

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
      {/* xwOBA column: display xwOBA if available, fallback to wOBA if xwOBA is not in the API response */}
      <td className="px-3 py-2 font-mono text-right text-ink/60">{rate3(stats?.xwoba ?? stats?.woba)}</td>
      <td className="px-3 py-2 font-mono text-right text-ink/60">{pct(stats?.bbPct)}</td>
      <td className="px-3 py-2 font-mono text-right text-ink/60">{pct(stats?.kPct)}</td>
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
      <td className="px-3 py-2 font-mono text-right text-ink/60">{stats?.era ?? "—"}</td>
      <td className={`px-3 py-2 font-mono text-right ${statClass("fip", stats?.fip) ?? ""}`}>{dec2(stats?.fip)}</td>
      <td className={`px-3 py-2 font-mono text-right ${statClass("xfip", stats?.xfip) ?? ""}`}>{dec2(stats?.xfip)}</td>
      <td className="px-3 py-2 font-mono text-right text-ink/60">
        {stats?.kMinusBbPct != null ? `${(stats.kMinusBbPct * 100).toFixed(1)}%` : "—"}
      </td>
    </tr>
  );
}
