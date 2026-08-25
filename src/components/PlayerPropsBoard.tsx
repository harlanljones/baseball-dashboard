"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import PlayerHeadshot from "./PlayerHeadshot";
import ScorePop from "./ScorePop";
import TeamLogo from "./TeamLogo";
import type { ScoredProp } from "@/lib/odds/types";
import {
  DEFAULT_WEIGHTS,
  MARKET_LABELS,
  TIER_CLASS,
  TIER_LABEL,
  WEIGHT_HELP,
  WEIGHT_LABELS,
  calculateScore,
  leanAnchorId,
  scoreBarClass,
  scoreToneClass,
  type WeightKey,
  type Weights,
  type PropTeamGroup,
} from "@/lib/odds/board";

const WEIGHTS_STORAGE_KEY = "props-weights-v1";

function formatPrice(price: number): string {
  return price > 0 ? `+${price}` : `${price}`;
}

function directionLabel(prop: ScoredProp): string {
  return prop.direction === "over" ? "Over" : "Under";
}

function readStoredWeights(): Weights | null {
  try {
    const raw = window.localStorage.getItem(WEIGHTS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Record<WeightKey, unknown>>;
    const keys: WeightKey[] = ["modelConfidence", "statisticalEdge", "marketValue"];
    if (!keys.every((key) => typeof parsed[key] === "number" && parsed[key]! >= 0 && parsed[key]! <= 100)) {
      return null;
    }
    return { modelConfidence: parsed.modelConfidence as number, statisticalEdge: parsed.statisticalEdge as number, marketValue: parsed.marketValue as number };
  } catch {
    return null;
  }
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

function Factor({ label, value, toneClass, barClass }: { label: string; value: number | null; toneClass: string; barClass: string }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-2 text-xs uppercase tracking-[0.08em] text-ink/65">
        <span>{label}</span>
        <span className={`nums font-mono ${toneClass}`}>{value == null ? "—" : Math.round(value)}</span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-ink/10">
        <div
          className={`h-full rounded-full ${barClass}`}
          style={{ width: `${value == null ? 0 : Math.max(4, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

/** Direction chip — the words carry the meaning; color stays out of it. */
function DirectionChip({ prop }: { prop: ScoredProp }) {
  return (
    <span className="rounded-sm border border-ink/25 px-1 py-px text-xs font-semibold uppercase tracking-wider text-ink/75">
      {directionLabel(prop)}
    </span>
  );
}

function PropRow({ prop, score }: { prop: ScoredProp; score: number | null }) {
  const [showAllEvidence, setShowAllEvidence] = useState(false);
  const tone = scoreToneClass(score);
  const price = prop.direction === "over" ? prop.overPrice : prop.underPrice;
  const [firstEvidence, ...restEvidence] = prop.evidence;

  return (
    <article id={leanAnchorId(prop)} className="scroll-mt-20 border-b border-ink/10 px-3 py-3 last:border-b-0">
      <div className="flex items-start gap-2.5">
        <PlayerHeadshot personId={prop.player.id} size={28} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-display text-base font-semibold">{prop.player.fullName}</span>
            <span className="text-xs text-ink/65">{MARKET_LABELS[prop.marketKey]}</span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <DirectionChip prop={prop} />
            <span className="nums font-mono text-ink/75">{prop.line}</span>
            <span className="nums font-mono text-ink/65">{formatPrice(price)}</span>
            {prop.factors.completeness === "partial" && <span className="text-gold-deep">Partial data</span>}
            <span className={`text-xs ${TIER_CLASS[prop.tier]}`}>{TIER_LABEL[prop.tier]}</span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <ScorePop value={score == null ? "—" : score.toFixed(1)} className={`nums font-mono text-2xl font-semibold ${tone}`} />
          <div className="text-xs uppercase tracking-[0.08em] text-ink/65">lean score</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Factor
          label="Model"
          value={prop.factors.modelConfidence}
          toneClass={scoreToneClass(prop.factors.modelConfidence)}
          barClass={scoreBarClass(prop.factors.modelConfidence)}
        />
        <Factor
          label="Edge"
          value={prop.factors.statisticalEdge}
          toneClass={scoreToneClass(prop.factors.statisticalEdge)}
          barClass={scoreBarClass(prop.factors.statisticalEdge)}
        />
        <Factor
          label="Value"
          value={prop.factors.marketValue}
          toneClass={scoreToneClass(prop.factors.marketValue)}
          barClass={scoreBarClass(prop.factors.marketValue)}
        />
      </div>
      {(firstEvidence || restEvidence.length > 0) && (
        <div className="mt-2 text-xs leading-snug text-ink/70">
          {restEvidence.length > 0 && !showAllEvidence ? (
            <>
              <p>{firstEvidence}</p>
              <button
                type="button"
                onClick={() => setShowAllEvidence(true)}
                className="mt-0.5 cursor-pointer text-grass underline underline-offset-2 hover:text-field-deep dark:hover:text-grass"
              >
                +{restEvidence.length} more {restEvidence.length === 1 ? "line" : "lines"} of evidence
              </button>
            </>
          ) : (
            <>
              {prop.evidence.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
              {restEvidence.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAllEvidence(false)}
                  className="mt-0.5 cursor-pointer text-grass underline underline-offset-2 hover:text-field-deep dark:hover:text-grass"
                >
                  Show less
                </button>
              )}
            </>
          )}
        </div>
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
        <span className="ml-auto text-xs text-ink/65">{sorted.length} props</span>
      </div>
      {sorted.length === 0 ? <p className="p-4 text-sm text-ink/65">No matched props.</p> : sorted.map(({ prop, score }) => <PropRow key={`${prop.player.id}-${prop.marketKey}-${prop.line}`} prop={prop} score={score} />)}
    </section>
  );
}

export default function PlayerPropsBoard({ groups, gameHref }: { groups: PropTeamGroup[]; gameHref: string }) {
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Restore persisted weights a tick after mount (client-only read without
    // a synchronous setState-in-effect).
    const id = window.setTimeout(() => {
      const stored = readStoredWeights();
      if (stored) setWeights(stored);
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(WEIGHTS_STORAGE_KEY, JSON.stringify(weights));
  }, [weights, hydrated]);

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
        <p className="mx-auto mt-2 max-w-md text-sm text-ink/65">Odds may not be configured, or this game has no matched player markets yet.</p>
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
            <p className="mt-1 text-xs text-ink/65">Tune the ranking without hiding the underlying factors. Weights always total 100% and are remembered on this device.</p>
          </div>
          <button type="button" onClick={() => setWeights(DEFAULT_WEIGHTS)} className="rounded-md border border-ink/15 px-2.5 py-1 text-xs text-ink/75 hover:border-grass/60 hover:text-ink">Reset</button>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {(Object.keys(weights) as WeightKey[]).map((key) => (
            <label key={key} className="block">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{WEIGHT_LABELS[key]}</span>
                <span className="nums font-mono text-sm font-semibold text-gold-deep">{weights[key]}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={weights[key]}
                onChange={(event) => setWeights((current) => updateWeights(current, key, Number(event.target.value)))}
                className="mt-2 w-full accent-gold-deep"
                aria-label={WEIGHT_LABELS[key]}
                aria-valuetext={`${weights[key]} percent weight`}
              />
              <span className="mt-1 block text-xs leading-snug text-ink/65">{WEIGHT_HELP[key]}</span>
            </label>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-ink/10 pt-3 text-xs text-ink/65">
          <span>Scores update as weights move and reorder when the adjustment commits.</span>
          <span className="nums font-mono font-semibold text-gold-deep">Total {weights.modelConfidence + weights.statisticalEdge + weights.marketValue}%</span>
        </div>
      </section>

      {best && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 border border-grass/30 bg-field/5 px-3 py-2.5 text-sm"
        >
          <span><span className="font-semibold">Current top lean:</span> {best.prop.player.fullName} {directionLabel(best.prop).toLowerCase()} {MARKET_LABELS[best.prop.marketKey].toLowerCase()} {best.prop.line}</span>
          <a
            href={`#${leanAnchorId(best.prop)}`}
            className={`nums font-mono font-semibold underline-offset-2 hover:underline ${scoreToneClass(best.score)}`}
          >
            <ScorePop value={best.score.toFixed(1)} /> / 100
          </a>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {groups.map((group) => <TeamColumn key={group.team.id} group={group} weights={weights} />)}
      </div>
      <p className="text-xs leading-relaxed text-ink/65">Market value is an odds-based price signal, not a prediction or guarantee. Props with incomplete statistics are marked partial.</p>
    </div>
  );
}
