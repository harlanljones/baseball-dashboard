"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import PlayerHeadshot from "./PlayerHeadshot";
import TeamLogo from "./TeamLogo";
import type { PropMarketKey, ScoredProp } from "@/lib/odds/types";
import type { PropTeamGroup } from "./PropsSidebar";

const MARKET_LABELS: Record<PropMarketKey, string> = {
  pitcher_strikeouts: "Strikeouts",
  pitcher_outs: "Outs recorded",
  batter_hits: "Hits",
  batter_total_bases: "Total bases",
  batter_home_runs: "Home runs",
  batter_rbis: "RBIs",
  batter_walks: "Walks",
};

type WeightKey = "modelConfidence" | "statisticalEdge" | "marketValue";
type Weights = Record<WeightKey, number>;

const DEFAULT_WEIGHTS: Weights = {
  modelConfidence: 40,
  statisticalEdge: 35,
  marketValue: 25,
};

const WEIGHT_LABELS: Record<WeightKey, string> = {
  modelConfidence: "Model confidence",
  statisticalEdge: "Statistical edge",
  marketValue: "Market value",
};

const WEIGHT_HELP: Record<WeightKey, string> = {
  modelConfidence: "How complete and stable the supporting sample is",
  statisticalEdge: "How far the season rate sits from the posted line",
  marketValue: "An odds-based price signal, not a fair-probability estimate",
};

function formatPrice(price: number): string {
  return price > 0 ? `+${price}` : `${price}`;
}

function scoreTone(score: number | null): string {
  if (score == null) return "text-ink/45";
  if (score >= 80) return "text-grass";
  if (score >= 60) return "text-gold";
  return "text-clay";
}

function directionLabel(prop: ScoredProp): string {
  return prop.direction === "over" ? "Over" : "Under";
}

function calculateScore(prop: ScoredProp, weights: Weights): number | null {
  const { modelConfidence, statisticalEdge, marketValue } = prop.factors;
  if (modelConfidence == null || statisticalEdge == null || marketValue == null) return null;
  return (
    (modelConfidence * weights.modelConfidence +
      statisticalEdge * weights.statisticalEdge +
      marketValue * weights.marketValue) /
    100
  );
}

function updateWeights(current: Weights, changed: WeightKey, value: number): Weights {
  const otherKeys = (Object.keys(current) as WeightKey[]).filter((key) => key !== changed);
  const remaining = 100 - value;
  const otherTotal = otherKeys.reduce((sum, key) => sum + current[key], 0);
  const next = { ...current, [changed]: value };
  if (otherTotal === 0) {
    next[otherKeys[0]] = Math.round(remaining / 2);
    next[otherKeys[1]] = remaining - next[otherKeys[0]];
  } else {
    next[otherKeys[0]] = Math.round((current[otherKeys[0]] / otherTotal) * remaining);
    next[otherKeys[1]] = remaining - next[otherKeys[0]];
  }
  return next;
}

function Factor({ label, value, tone }: { label: string; value: number | null; tone: string }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.08em] text-ink/45">
        <span>{label}</span>
        <span className={`nums font-mono ${tone}`}>{value == null ? "—" : Math.round(value)}</span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-ink/10">
        <div
          className={`h-full rounded-full ${tone === "text-grass" ? "bg-grass" : tone === "text-gold" ? "bg-gold" : tone === "text-clay" ? "bg-clay" : "bg-ink/25"}`}
          style={{ width: `${value == null ? 0 : Math.max(4, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

function PropRow({ prop, score }: { prop: ScoredProp; score: number | null }) {
  const tone = scoreTone(score);
  const price = prop.direction === "over" ? prop.overPrice : prop.underPrice;
  return (
    <article className="border-b border-ink/10 px-3 py-3 last:border-b-0">
      <div className="flex items-start gap-2.5">
        <PlayerHeadshot personId={prop.player.id} size={28} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-display text-base font-semibold">{prop.player.fullName}</span>
            <span className="text-xs text-ink/45">{MARKET_LABELS[prop.marketKey]}</span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
            <span className={`font-semibold uppercase ${prop.direction === "over" ? "text-cold" : "text-clay"}`}>
              {directionLabel(prop)}
            </span>
            <span className="nums font-mono text-ink/70">{prop.line}</span>
            <span className="nums font-mono text-ink/50">{formatPrice(price)}</span>
            {prop.factors.completeness === "partial" && <span className="text-gold">Partial data</span>}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <span className={`nums font-mono text-2xl font-semibold ${tone}`}>{score == null ? "—" : score.toFixed(1)}</span>
          <div className="text-[10px] uppercase tracking-[0.08em] text-ink/45">lean score</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <Factor label="Model" value={prop.factors.modelConfidence} tone={scoreTone(prop.factors.modelConfidence)} />
        <Factor label="Edge" value={prop.factors.statisticalEdge} tone={scoreTone(prop.factors.statisticalEdge)} />
        <Factor label="Value" value={prop.factors.marketValue} tone={scoreTone(prop.factors.marketValue)} />
      </div>
      {prop.evidence.length > 0 && (
        <p className="mt-2 text-xs leading-snug text-ink/50">{prop.evidence[0]}</p>
      )}
    </article>
  );
}

function TeamColumn({ group, weights }: { group: PropTeamGroup; weights: Weights }) {
  const rows = group.players.flatMap((player) => player.props.map((prop) => ({ prop, evidence: player.evidence })));
  const sorted = rows
    .map(({ prop, evidence }) => ({ prop: evidence.length ? { ...prop, evidence: [...evidence, ...prop.evidence] } : prop, score: calculateScore(prop, weights) }))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  return (
    <section className="min-w-0 overflow-hidden rounded-md border border-ink/10 bg-card">
      <div className="flex items-center gap-2 border-b border-ink/10 px-3 py-2.5">
        <TeamLogo teamId={group.team.id} size={20} />
        <h2 className="font-display text-base font-semibold uppercase tracking-wide">{group.team.abbreviation ?? group.team.name}</h2>
        <span className="ml-auto text-xs text-ink/45">{sorted.length} props</span>
      </div>
      {sorted.length === 0 ? <p className="p-4 text-sm text-ink/50">No matched props.</p> : sorted.map(({ prop, score }) => <PropRow key={`${prop.player.id}-${prop.marketKey}-${prop.line}`} prop={prop} score={score} />)}
    </section>
  );
}

export default function PlayerPropsBoard({ groups, gameHref }: { groups: PropTeamGroup[]; gameHref: string }) {
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);
  const allProps = useMemo(() => groups.flatMap((group) => group.players.flatMap((player) => player.props)), [groups]);
  const best = useMemo(() => {
    return allProps
      .map((prop) => ({ prop, score: calculateScore(prop, weights) }))
      .filter((item): item is { prop: ScoredProp; score: number } => item.score != null)
      .sort((a, b) => b.score - a.score)[0];
  }, [allProps, weights]);

  if (groups.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-ink/20 bg-card px-5 py-12 text-center">
        <h2 className="font-display text-xl font-semibold uppercase">No player props available</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink/55">Odds may not be configured, or this game has no matched player markets yet.</p>
        <Link href={gameHref} className="mt-4 inline-block text-sm text-grass underline underline-offset-4">Back to game overview</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-md border border-ink/10 bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="eyebrow text-base">Lean score weights</h2>
            <p className="mt-1 text-xs text-ink/50">Tune the ranking without hiding the underlying factors. Weights always total 100%.</p>
          </div>
          <button type="button" onClick={() => setWeights(DEFAULT_WEIGHTS)} className="rounded-md border border-ink/15 px-2.5 py-1 text-xs text-ink/65 hover:border-grass/60 hover:text-ink">Reset</button>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {(Object.keys(weights) as WeightKey[]).map((key) => (
            <label key={key} className="block">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{WEIGHT_LABELS[key]}</span>
                <span className="nums font-mono text-sm text-gold">{weights[key]}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={weights[key]}
                onChange={(event) => setWeights((current) => updateWeights(current, key, Number(event.target.value)))}
                className="mt-2 w-full accent-gold"
                aria-label={WEIGHT_LABELS[key]}
                aria-valuetext={`${weights[key]} percent weight`}
              />
              <span className="mt-1 block text-xs leading-snug text-ink/45">{WEIGHT_HELP[key]}</span>
            </label>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-ink/10 pt-3 text-xs text-ink/50">
          <span>Scores update as weights move and reorder when the adjustment commits.</span>
          <span className="nums font-mono text-gold">Total {weights.modelConfidence + weights.statisticalEdge + weights.marketValue}%</span>
        </div>
      </section>

      {best && (
        <div className="flex flex-wrap items-center justify-between gap-3 border border-grass/30 bg-field/5 px-3 py-2.5 text-sm">
          <span><span className="font-semibold">Current top lean:</span> {best.prop.player.fullName} {directionLabel(best.prop).toLowerCase()} {MARKET_LABELS[best.prop.marketKey].toLowerCase()} {best.prop.line}</span>
          <span className={`nums font-mono font-semibold ${scoreTone(best.score)}`}>{best.score.toFixed(1)} / 100</span>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {groups.map((group) => <TeamColumn key={group.team.id} group={group} weights={weights} />)}
      </div>
      <p className="text-xs leading-relaxed text-ink/45">Market value is an odds-based price signal, not a prediction or guarantee. Props with incomplete statistics are marked partial.</p>
    </div>
  );
}
