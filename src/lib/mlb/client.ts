/**
 * Thin client for the public MLB Stats API (statsapi.mlb.com — free, no key).
 *
 * All requests go through {@link mlbFetch}, which layers Next.js fetch caching
 * on top with a per-call `revalidate` TTL so we throttle the upstream without
 * any persistence of our own.
 */

const BASE = "https://statsapi.mlb.com";

/** Cache TTLs in seconds, keyed by how fast the underlying data changes. */
export const TTL = {
  /** Live schedule + game feed. */
  live: 30,
  /** Season series between two teams. */
  headToHead: 60 * 60,
  /** Player season stats (sabermetrics, batter-vs-pitcher). */
  playerStats: 6 * 60 * 60,
  /** Rosters / past-date schedules — effectively static. */
  roster: 24 * 60 * 60,
  /** Pitcher game logs, used to derive recent-workload (pitch counts). */
  pitcherLog: 3 * 60 * 60,
  /** Weather forecasts — update every 15 minutes. */
  weather: 15 * 60,
} as const;

/** Thrown when the MLB API responds with a non-2xx status. */
export class MlbApiError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
    message?: string,
  ) {
    super(message ?? `MLB API request failed (${status}) for ${url}`);
    this.name = "MlbApiError";
  }
}

type Params = Record<string, string | number | boolean | undefined | null>;

/**
 * Fetch and JSON-decode an MLB Stats API endpoint.
 *
 * @param path        Path beginning with `/api/...`, or an absolute URL.
 * @param params      Query params; `undefined`/`null`/`""` are dropped.
 * @param revalidate  Cache TTL in seconds (see {@link TTL}). Defaults to live.
 * @param tags        Optional cache tags for on-demand revalidation.
 */
export async function mlbFetch<T>(
  path: string,
  params: Params = {},
  revalidate: number = TTL.live,
  tags: string[] = [],
): Promise<T> {
  const url = new URL(path.startsWith("http") ? path : BASE + path);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    next: { revalidate, tags },
  });

  if (!res.ok) {
    throw new MlbApiError(res.status, url.toString());
  }
  return (await res.json()) as T;
}

/**
 * Today's date as `YYYY-MM-DD` in US Eastern time — the timezone MLB uses to
 * decide which day a game "belongs" to. Never derive this from `toISOString()`,
 * which would roll over at UTC midnight and show tomorrow's card after ~8pm ET.
 */
export function easternToday(): string {
  return easternDateOf(new Date());
}

/** The `YYYY-MM-DD` Eastern-time date a given instant falls on. */
export function easternDateOf(instant: Date | string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(new Date(instant));
}

/** Shift a `YYYY-MM-DD` date string by `deltaDays` (calendar days, UTC-safe). */
export function shiftDate(date: string, deltaDays: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}
