/**
 * Thin client for The Odds API (api.the-odds-api.com — free tier, requires a
 * key). Mirrors `src/lib/mlb/client.ts`'s `mlbFetch`: Next.js fetch caching
 * with a per-call `revalidate` TTL, no persistence of our own.
 */

const BASE = "https://api.the-odds-api.com";

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

/** The configured Odds API key, or `null` if unset — callers should fail closed on `null`. */
export function getOddsApiKey(): string | null {
  return process.env.ODDS_API_KEY || null;
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
  const key = getOddsApiKey();
  if (!key) {
    throw new OddsApiError(0, path, "ODDS_API_KEY is not set");
  }

  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("apiKey", key);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") {
      url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    next: { revalidate },
  });

  if (!res.ok) {
    throw new OddsApiError(res.status, url.toString());
  }
  return (await res.json()) as T;
}
