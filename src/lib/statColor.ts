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
