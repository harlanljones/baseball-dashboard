"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
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
  scoreBarColor,
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

function topLean(props: ScoredProp[], weights: Weights) {
  return props
    .map((prop) => ({ prop, score: calculateScore(prop, weights) }))
    .filter((item): item is { prop: ScoredProp; score: number } => item.score != null)
    .sort((a, b) => b.score - a.score)[0];
}

function Factor({ label, value, toneClass, barColor }: { label: string; value: number | null; toneClass: string; barColor: string }) {
  const fill = value == null ? 0 : Math.max(4, Math.min(100, value));
  // The fill lives in custom properties on the wrapper, which the track inherits,
  // so the bar is one node with no inline width to recompute.
  const style = { "--fill": `${fill}%`, "--bar": barColor } as CSSProperties;
  return (
    <div className="factor" style={style}>
      <span className="factor-label">{label}</span>
      <span className={`factor-value ${toneClass}`}>{value == null ? "—" : Math.round(value)}</span>
      <div className="factor-track" />
    </div>
  );
}

/** Direction chip — the words carry the meaning; color stays out of it. */
function DirectionChip({ prop }: { prop: ScoredProp }) {
  return (
    <span className="chip">
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
    <article id={leanAnchorId(prop)} className="prop-row">
      <div className="prop-row-head">
        <PlayerHeadshot personId={prop.player.id} size={28} />
        <div className="prop-row-body">
          <div className="prop-row-title">
            <span className="prop-name">{prop.player.fullName}</span>
            <span className="prop-market">{MARKET_LABELS[prop.marketKey]}</span>
          </div>
          <div className="prop-line">
            <DirectionChip prop={prop} />
            <span className="prop-value">{prop.line}</span>
            <span className="prop-value-muted">{formatPrice(price)}</span>
            {prop.factors.completeness === "partial" && <span className="prop-partial">Partial data</span>}
            <span className={`text-xs ${TIER_CLASS[prop.tier]}`}>{TIER_LABEL[prop.tier]}</span>
          </div>
        </div>
        <div className="prop-score">
          <ScorePop value={score == null ? "—" : score.toFixed(1)} className={`nums font-mono text-2xl font-semibold ${tone}`} />
          <div className="label-caps">lean score</div>
        </div>
      </div>
      <div className="prop-factors">
        <Factor
          label="Model"
          value={prop.factors.modelConfidence}
          toneClass={scoreToneClass(prop.factors.modelConfidence)}
          barColor={scoreBarColor(prop.factors.modelConfidence)}
        />
        <Factor
          label="Edge"
          value={prop.factors.statisticalEdge}
          toneClass={scoreToneClass(prop.factors.statisticalEdge)}
          barColor={scoreBarColor(prop.factors.statisticalEdge)}
        />
        <Factor
          label="Value"
          value={prop.factors.marketValue}
          toneClass={scoreToneClass(prop.factors.marketValue)}
          barColor={scoreBarColor(prop.factors.marketValue)}
        />
      </div>
      {(firstEvidence || restEvidence.length > 0) && (
        <>
          {restEvidence.length > 0 && !showAllEvidence ? (
            <>
              <p className="prop-evidence">{firstEvidence}</p>
              <button
                type="button"
                onClick={() => setShowAllEvidence(true)}
                className="prop-more link-subtle"
              >
                +{restEvidence.length} more {restEvidence.length === 1 ? "line" : "lines"} of evidence
              </button>
            </>
          ) : (
            <>
              {prop.evidence.map((line, i) => (
                <p className="prop-evidence" key={i}>
                  {line}
                </p>
              ))}
              {restEvidence.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAllEvidence(false)}
                  className="prop-more link-subtle"
                >
                  Show less
                </button>
              )}
            </>
          )}
        </>
      )}
    </article>
  );
}

function TeamColumn({ group, weights }: { group: PropTeamGroup; weights: Weights }) {
  const rows = group.players.flatMap((player) => player.props.map((prop) => ({ prop, evidence: player.evidence })));
  const sorted = rows
    // The prop's own line (season average versus the posted line) leads, with
    // the player's matchup context after it: a row renders only its first line
    // until the reader expands it, and the statistical edge is the one the
    // product promises to expose. Ordering the player's evidence first put that
    // line behind the toggle for every prop that had matchup context.
    .map(({ prop, evidence }) => ({ prop: evidence.length ? { ...prop, evidence: [...prop.evidence, ...evidence] } : prop, score: calculateScore(prop, weights) }))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  return (
    <section className="panel">
      <div className="panel-head">
        <TeamLogo teamId={group.team.id} size={20} />
        <h2 className="panel-title">{group.team.abbreviation ?? group.team.name}</h2>
        <span className="panel-count">{sorted.length} props</span>
      </div>
      {sorted.length === 0 ? <p className="p-4 text-sm text-ink/65">No matched props.</p> : sorted.map(({ prop, score }) => <PropRow key={`${prop.player.id}-${prop.marketKey}-${prop.line}`} prop={prop} score={score} />)}
    </section>
  );
}

export default function PlayerPropsBoard({ groups, gameHref }: { groups: PropTeamGroup[]; gameHref: string }) {
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);
  const [announcedWeights, setAnnouncedWeights] = useState<Weights>(DEFAULT_WEIGHTS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Restore persisted weights a tick after mount (client-only read without
    // a synchronous setState-in-effect).
    const id = window.setTimeout(() => {
      const stored = readStoredWeights();
      if (stored) {
        setWeights(stored);
        setAnnouncedWeights(stored);
      }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(WEIGHTS_STORAGE_KEY, JSON.stringify(weights));
  }, [weights, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    // The board streams in behind the page header, so the browser's jump to a
    // lean's #anchor can run before the row exists. Redo it once the rows have
    // mounted and any stored weights have put them in their final order.
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id) document.getElementById(id)?.scrollIntoView();
  }, [hydrated]);

  const allProps = useMemo(() => groups.flatMap((group) => group.players.flatMap((player) => player.props)), [groups]);
  const best = useMemo(() => topLean(allProps, weights), [allProps, weights]);
  const announcedBest = useMemo(() => topLean(allProps, announcedWeights), [allProps, announcedWeights]);
  const commitWeights = () => setAnnouncedWeights(weights);
  const resetWeights = () => {
    setWeights(DEFAULT_WEIGHTS);
    setAnnouncedWeights(DEFAULT_WEIGHTS);
  };

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
      <section className="card-pad">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="eyebrow text-base">Lean score weights</h2>
            <p className="mt-1 text-xs text-ink/65">Tune the ranking without hiding the underlying factors. Weights always total 100% and are remembered on this device.</p>
          </div>
          <button type="button" onClick={resetWeights} className="rounded-md border border-ink/15 px-2.5 py-1 text-xs text-ink/75 hover:border-grass/60 hover:text-ink">Reset</button>
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
                onPointerUp={commitWeights}
                onKeyUp={commitWeights}
                onBlur={commitWeights}
                className="mt-2 w-full accent-gold-deep"
                aria-label={WEIGHT_LABELS[key]}
                aria-valuetext={`${weights[key]} percent weight`}
              />
              <span className="mt-1 block text-xs leading-snug text-ink/65">{WEIGHT_HELP[key]}</span>
            </label>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 divider-t pt-3 text-xs text-ink/65">
          <span>Scores and order update as the weights move.</span>
        </div>
      </section>

      {best && (
        <div
          className="lean-banner"
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

      <div role="status" className="sr-only">
        {announcedBest &&
          `Current top lean: ${announcedBest.prop.player.fullName} ${directionLabel(announcedBest.prop).toLowerCase()} ${MARKET_LABELS[announcedBest.prop.marketKey].toLowerCase()} ${announcedBest.prop.line}, score ${announcedBest.score.toFixed(1)} out of 100`}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {groups.map((group) => <TeamColumn key={group.team.id} group={group} weights={weights} />)}
      </div>
      <p className="text-xs leading-relaxed text-ink/65">Market value is an odds-based price signal, not a prediction or guarantee. Props with incomplete statistics are marked partial.</p>
    </div>
  );
}
