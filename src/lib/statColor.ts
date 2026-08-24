/**
 * Color grading for stat values. Dashboard convention: **red = good,
 * blue = bad** (hot/cold, not stop/go), shown as a cell background rather than
 * colored text. Values inside the neutral band between the two thresholds —
 * roughly average performance — get no color.
 *
 * BABIP is deliberately absent: it is largely luck-driven, so grading it as
 * good/bad would mislead.
 */

export const GOOD_CLASS = "bg-hot/15 text-hot";
export const BAD_CLASS = "bg-cold/15 text-cold";

export interface QuantileBand {
  lower: number;
  upper: number;
}

const MIN_QUANTILE_VALUES = 4;

function finiteNumber(value: number | string | undefined | null): number | null {
  const parsed = typeof value === "string" ? parseFloat(value) : value;
  return parsed != null && Number.isFinite(parsed) ? parsed : null;
}

function quantile(sorted: number[], percentile: number): number {
  const position = (sorted.length - 1) * percentile;
  const lowerIndex = Math.floor(position);
  const fraction = position - lowerIndex;
  const lower = sorted[lowerIndex];
  const upper = sorted[lowerIndex + 1] ?? lower;
  return lower + (upper - lower) * fraction;
}

/** Build lower/upper-quartile cutoffs from a comparable stat population. */
export function quantileBand(
  values: Array<number | string | undefined | null>,
): QuantileBand | null {
  const sorted = values
    .map(finiteNumber)
    .filter((value): value is number => value != null)
    .sort((a, b) => a - b);

  if (sorted.length < MIN_QUANTILE_VALUES) return null;
  const lower = quantile(sorted, 0.25);
  const upper = quantile(sorted, 0.75);
  return lower < upper ? { lower, upper } : null;
}

/** Grade a value against its population's outer quartiles. */
export function quantileClass(
  value: number | string | undefined | null,
  band: QuantileBand | null,
  higherIsBetter: boolean,
): string {
  const parsed = finiteNumber(value);
  if (parsed == null || band == null) return "";
  if (parsed <= band.lower) return higherIsBetter ? BAD_CLASS : GOOD_CLASS;
  if (parsed >= band.upper) return higherIsBetter ? GOOD_CLASS : BAD_CLASS;
  return "";
}

/**
 * `good`/`bad` thresholds per stat. Direction is inferred: when `good < bad`
 * (e.g. FIP), lower is better. Bands are centered on recent league averages.
 */
const BANDS = {
  woba: { good: 0.34, bad: 0.295 },
  wrcPlus: { good: 115, bad: 85 },
  warHitter: { good: 2.5, bad: 0.3 },
  warPitcher: { good: 2.0, bad: 0.3 },
  fip: { good: 3.6, bad: 4.6 },
  xfip: { good: 3.6, bad: 4.6 },
  eraMinus: { good: 85, bad: 115 },
  era: { good: 3.2, bad: 4.6 },
  whip: { good: 1.1, bad: 1.45 },
  avg: { good: 0.3, bad: 0.21 },
  obp: { good: 0.36, bad: 0.29 },
  slg: { good: 0.48, bad: 0.35 },
  ops: { good: 0.8, bad: 0.68 },
  bbPct: { good: 10, bad: 6 },
  kPct: { good: 18, bad: 26 },
} as const;

export type StatKey = keyof typeof BANDS;

/**
 * Tailwind class grading `value` for stat `key`, or `""` for neutral /
 * unparseable values. Accepts the API's string forms (".300", "3.49"); "-",
 * "-.--" and the like parse to NaN and stay neutral.
 */
export function statClass(
  key: StatKey,
  value: number | string | undefined | null,
): string {
  const v = typeof value === "string" ? parseFloat(value) : value;
  if (v == null || !Number.isFinite(v)) return "";
  const { good, bad } = BANDS[key];
  const higherIsBetter = good > bad;
  if (higherIsBetter ? v >= good : v <= good) return GOOD_CLASS;
  if (higherIsBetter ? v <= bad : v >= bad) return BAD_CLASS;
  return "";
}

/** Below this many PA a batter-vs-pitcher rate stat is noise — leave it uncolored. */
export const MIN_PA_FOR_COLOR = 10;

/** {@link statClass}, gated on plate appearances for small-sample stats like AVG/OBP/SLG vs one pitcher. */
export function rateClass(
  key: StatKey,
  value: number | string | undefined | null,
  pa: number,
): string {
  return pa >= MIN_PA_FOR_COLOR ? statClass(key, value) : "";
}
