/**
 * Thin client for The Odds API (api.the-odds-api.com — free tier, requires a
 * key). Mirrors `src/lib/mlb/client.ts`'s `mlbFetch`: Next.js fetch caching
 * with a per-call `revalidate` TTL, no persistence of our own.
 *
 * Key rotation: this module supports a primary key plus optional secondary keys
 * (`ODDS_API_KEY_2` …), rotating automatically on transient failures and on a
 * key that keeps 429ing, and skipping a key that seems invalid.
 */

import { buildKeyList, createPool, shouldTryNextKey, type FetchResult } from "./keys";
import { upstreamMessage } from "./log";

const BASE = "https://api.the-odds-api.com";

const ODDS_KEYS = createPool("ODDS");

/** Cache TTLs in seconds. Odds lines move over hours, not seconds — a long
 * TTL keeps free-tier request usage low without staling out pre-game lines. */
export const TTL = {
  odds: 60 * 60,
} as const;

/** Thrown when the Odds API responds with a non-2xx status, or when no API key is configured. */
export class OddsApiError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
    message?: string,
  ) {
    super(message ?? `Odds API request failed (${status}) for ${url}`);
    this.name = "OddsApiError";
  }
}

/**
 * The highest-priority configured Odds API key, or `null` if none is set under
 * any of the pool's env forms — callers should fail closed on `null`.
 */
export function getOddsApiKey(): string | null {
  return buildKeyList("ODDS")[0] ?? null;
}

/** Test seam: reset the in-memory rotation state so cases don't leak into each other. */
export function resetOddsKeyPool(): void {
  ODDS_KEYS.reset();
}

/** Returns `url` with the `apiKey` query param stripped, so it's safe to log or embed in an error. */
function redactApiKey(url: URL): string {
  const redacted = new URL(url.toString());
  redacted.searchParams.delete("apiKey");
  return redacted.toString();
}

type Params = Record<string, string | number | boolean | undefined | null>;

/**
 * Fetch and JSON-decode an Odds API endpoint.
 *
 * @param path        Path beginning with `/v4/...`.
 * @param params      Query params; `undefined`/`null`/`""` are dropped.
 * @param revalidate  Cache TTL in seconds (see {@link TTL}). Defaults to `TTL.odds`.
 */
export async function oddsFetch<T>(
  path: string,
  params: Params = {},
  revalidate: number = TTL.odds,
): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") {
      url.searchParams.set(k, String(v));
    }
  }

  // A rejected or rate-limited key retries this request on the next usable key,
  // so one bad key doesn't empty the board; each key is tried at most once.
  const tried = new Set<string>();
  let lastError: OddsApiError | null = null;
  for (let key = ODDS_KEYS.pick(); key && !tried.has(key); key = ODDS_KEYS.pick()) {
    tried.add(key);
    url.searchParams.set("apiKey", key);

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      next: { revalidate },
    });

    const body = await res.json().catch(() => null);
    if (res.ok) return body as T;

    const result: FetchResult = { ok: res.ok, status: res.status, body };
    ODDS_KEYS.record(key, result);
    const why = upstreamMessage(body);
    lastError = new OddsApiError(
      res.status,
      redactApiKey(url),
      why ? `Odds API request failed (${res.status}) for ${redactApiKey(url)}: ${why}` : undefined,
    );
    if (!shouldTryNextKey(res.status)) throw lastError;
  }

  throw (
    lastError ??
    new OddsApiError(
      0,
      path,
      ODDS_KEYS.isPoolExhausted()
        ? "Odds API quota exhausted; every ODDS_API_KEY is paused"
        : "No usable ODDS_API_KEY",
    )
  );
}
