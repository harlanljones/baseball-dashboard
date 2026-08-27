/**
 * Hot-swappable API key pool with automatic rotation, per-key backoff, and
 * failover across multiple keys for a single odds provider.
 *
 * Design goals:
 *  - Data stays available across provider outages by rotating among multiple keys
 *    so a single rate-limited or exhausted key cannot single-handedly empty the
 *    slate.
 *  - A key that keeps failing must not keep being retried in a way that re-trips
 *    the rate limit — per-key backoff bounds the attempt rate on each key.
 *  - Rotation is automatic and transparent to the rest of the odds layer: the
 *    existing `sgoFetch` / `oddsFetch` callers keep working, only the key they
 *    use is chosen by the pool.
 *  - Fail-soft everywhere: on total pool exhaustion the layer falls back (or
 *    returns empty), never throws to the page.
 *
 * Per-provider key configuration (env vars), all optional:
 *  - `<PROVIDER>_API_KEY`          — primary key (kept for backward compat).
 *  - `<PROVIDER>_API_KEYS`          — comma-separated list of all keys (primary
 *    first, then secondaries). When present it wins over the single-key form so a
 *    single secret can carry several keys without extra secrets.
 *  - `<PROVIDER>_API_KEY_2`, `3`, `4`, `5` — individual secondary keys, each as
 *    its own secret. Added one at a time with `wrangler secret put`, which is the
 *    usual rotation path: provision a fresh key, add it, and the pool picks it up
 *    on the next request without any code change.
 *
 * Rotation policy:
 *  - Each request picks the highest-priority usable key.
 *  - On a 2xx response the key stays usable.
 *  - On 429 (rate limit) the key is moved to a per-key backoff for
 *    `rateLimitBackoffMs`; while it is in backoff it is skipped, so the request
 *    rotates to the next key instead of hammering the same rate-limited key.
 *  - On a 401 or clearly-invalid key the key is moved to an `invalid` cooldown so
 *    it is skipped for `invalidCooldownMs` and the request rotates to the next
 *    key.
 *  - On quota exhaustion (read from the response body) the whole pool is marked
 *    exhausted for `exhaustedLeaseMs` because quota is typically shared per
 *    subscription, so rotating to another key would not buy quota.
 *  - All other failures (500, network, parse) are transient and rotate to the next
 *    key; a key that keeps failing is moved into a short cooldown after
 *    `maxTransientFailures`.
 *
 * Platform notes:
 *  - On Cloudflare Workers the pool is re-created on each request from
 *    `process.env`, so updating a secret with `wrangler secret put` is reflected
 *    on the next request without a code deploy. That is the hot-swap path.
 */

/** Outcome of a fetch attempt with one key, fed back to the pool to update state. */
export interface FetchResult {
  readonly ok: boolean; // 2xx → the key worked for this request
  readonly status: number; // HTTP status (0 for a wire/parse error)
  readonly body: unknown; // response body if available, for quota detection
}

/** The per-provider pool API returned by {@link createPool}. */
export type OddsProviderKeyPool = {
  /** The ordered eligible keys right now (skips cooldown/backoff/exhausted). */
  pick(): string | null;
  /** Call after each fetch attempt to update per-key state. */
  record(key: string, result: FetchResult): void;
  /** Mark the whole pool exhausted (quota hit) for the lease window. */
  markPoolExhausted(): void;
  /** Read whether the pool is currently exhausted (quota). */
  isPoolExhausted(): boolean;
  /** Reset entirely (tests). */
  reset(): void;
  /** The raw configured keys (for assertions/debug). */
  readonly keys: string[];
};

export type KeyPoolConfig = {
  /** How long a rate-limited key is skipped before it becomes eligible again. */
  readonly rateLimitBackoffMs: number;
  /** How long an auth-failed key is skipped. */
  readonly invalidCooldownMs: number;
  /** How long the whole pool stays exhausted after a quota-exhaustion signal. */
  readonly exhaustedLeaseMs: number;
  /** After this many consecutive transient failures on one key it is moved into a
   *  short cooldown so a persistently unhealthy key is deprioritised. */
  readonly maxTransientFailures: number;
  /** How long a key with transient failures is skipped. */
  readonly transientFailureCooldownMs: number;
  /** After this many consecutive 429s on one key it is treated as exhausted. */
  readonly rateLimitedBeforeExhausted: number;
};

export const DEFAULT_KEY_POOL_CONFIG: KeyPoolConfig = {
  rateLimitBackoffMs: 30_000,
  invalidCooldownMs: 60_000,
  exhaustedLeaseMs: 60 * 60 * 1000, // 1h — short enough to recover, long enough to stop re-provoking
  maxTransientFailures: 3,
  transientFailureCooldownMs: 30_000,
  rateLimitedBeforeExhausted: 3,
};

/**
 * Per-key state used by the pool to decide whether a key is eligible now.
 */
export type KeyState =
  | { status: "ok" }
  | { status: "backoff"; until: number; rateLimitedCount: number }
  | { status: "invalid"; until: number }
  | { status: "exhausted"; until: number }
  | { status: "transientFailures"; count: number; until: number };

/**
 * Build the ordered list of keys for a provider from env.
 *
 * Priority: `<PROVIDER>_API_KEYS` (comma-separated, primary first) wins over
 * the single-key form, which wins over numbered secondary keys. Duplicates are
 * dropped while preserving first-seen order so a key that appears in both forms
 * is not double-counted.
 */
export function buildKeyList(provider: string, maxSecondaryKeys = 4): string[] {
  const prefix = `${provider}_API_KEY`;
  const keys: string[] = [];
  const seen = new Set<string>();

  const bulk = process.env[`${provider}_API_KEYS`] ?? "";
  if (bulk.trim()) {
    for (const k of bulk.split(",")) {
      const trimmed = k.trim();
      if (trimmed && !seen.has(trimmed)) {
        seen.add(trimmed);
        keys.push(trimmed);
      }
    }
  }

  const primary = process.env[prefix] ?? "";
  if (primary && !seen.has(primary)) {
    seen.add(primary);
    keys.unshift(primary);
  }

  for (let i = 2; i <= maxSecondaryKeys; i += 1) {
    const secondary = process.env[`${prefix}_${i}`] ?? "";
    if (secondary && !seen.has(secondary)) {
      seen.add(secondary);
      keys.push(secondary);
    }
  }

  return keys;
}

/**
 * Create a request-scoped key pool for one provider. Re-created on each request
 * from env so the current secret bindings are reflected (the hot-swap path).
 *
 * `pick()` re-reads the env key list on every call, so a key added or removed via
 * `wrangler secret put` (or `vi.stubEnv` in tests, after import) is picked up on
 * the next call without a code deploy, while per-key rotation state (backoff /
 * invalid / exhausted) is preserved for keys that are still present.
 */
export function createPool(
  provider: string,
  config: Partial<KeyPoolConfig> = {},
): OddsProviderKeyPool {
  const merged: KeyPoolConfig = { ...DEFAULT_KEY_POOL_CONFIG, ...config };
  const state = new Map<string, KeyState>();
  let poolExhausted = false;
  let poolExhaustedUntil = 0;

  // Reconcile the tracked keys with the current env key list on each call so new
  // keys are adopted and removed keys are dropped, without losing state on the
  // keys that remain.
  function reconcile(): string[] {
    const current = buildKeyList(provider);
    const seen = new Set(current);
    for (const k of [...state.keys()]) {
      if (!seen.has(k)) state.delete(k);
    }
    for (const k of current) {
      if (!state.has(k)) state.set(k, { status: "ok" });
    }
    return current;
  }

  function eligible(k: string): boolean {
    const s = state.get(k);
    if (!s) return true;
    const now = Date.now();
    if (s.status === "backoff" && now < s.until) return false;
    if (s.status === "invalid" && now < s.until) return false;
    if (s.status === "transientFailures" && now < s.until) return false;
    if (s.status === "exhausted" && now < s.until) return false;
    return true;
  }

  function pick(): string | null {
    if (poolExhausted && Date.now() < poolExhaustedUntil) return null;
    const keys = reconcile();
    for (const k of keys) {
      if (eligible(k)) return k;
    }
    return null;
  }

  function markAllExhausted(until: number): void {
    poolExhausted = true;
    poolExhaustedUntil = until;
    for (const k of reconcile()) state.set(k, { status: "exhausted", until });
  }

  function record(key: string, result: FetchResult): void {
    const keys = reconcile();
    if (!keys.includes(key) || !state.has(key)) return;
    const { status, body, ok } = result;

    if (ok) {
      const existing = state.get(key)!;
      if (existing.status === "transientFailures" || existing.status === "backoff" || existing.status === "invalid") {
        state.set(key, { status: "ok" });
      }
      return;
    }

    // Quota is checked first: a quota response (even a 401/429) means the shared
    // subscription is spent, so rotating to another key would not buy quota.
    if (isQuotaExhausted(body, provider)) {
      markAllExhausted(Date.now() + merged.exhaustedLeaseMs);
      return;
    }

    if (status === 429) {
      const existing = state.get(key)!;
      const count = existing.status === "backoff" ? existing.rateLimitedCount + 1 : 1;
      if (count >= merged.rateLimitedBeforeExhausted) {
        state.set(key, { status: "exhausted", until: Date.now() + merged.exhaustedLeaseMs });
      } else {
        state.set(key, { status: "backoff", until: Date.now() + merged.rateLimitBackoffMs, rateLimitedCount: count });
      }
      return;
    }

    if (status === 401) {
      const existing = state.get(key)!;
      if (existing.status === "ok" || existing.status === "transientFailures" || existing.status === "backoff") {
        state.set(key, { status: "invalid", until: Date.now() + merged.invalidCooldownMs });
      }
      return;
    }

    const existing = state.get(key)!;
    const count = existing.status === "transientFailures" ? existing.count + 1 : 1;
    if (count >= merged.maxTransientFailures) {
      state.set(key, { status: "invalid", until: Date.now() + merged.transientFailureCooldownMs });
    } else {
      state.set(key, { status: "transientFailures", count, until: Date.now() + merged.transientFailureCooldownMs });
    }
  }

  return {
    pick,
    record,
    markPoolExhausted: () => markAllExhausted(Date.now() + merged.exhaustedLeaseMs),
    isPoolExhausted: () => poolExhausted && Date.now() < poolExhaustedUntil,
    reset: () => {
      for (const k of reconcile()) state.set(k, { status: "ok" });
      poolExhausted = false;
      poolExhaustedUntil = 0;
    },
    get keys(): string[] {
      return reconcile();
    },
  };
}

/**
 * Detect true pool-wide quota exhaustion from a provider response body.
 *
 * This should only return true when every key on the shared subscription is spent
 * — i.e. the quota is genuinely account/subscription-wide, so rotating to another
 * key would not buy quota. Providers that grant per-key quota (e.g. SportsGameOdds
 * bills each key/customerID its own objects/month) must return false here so a
 * single exhausted key merely rotates to the next one instead of freezing the pool.
 */
export function isQuotaExhausted(body: unknown, provider: string): boolean {
  if (body == null || typeof body !== "object") return false;
  const o = body as Record<string, unknown>;

  // The Odds API quota is shared per subscription (single credit pool per account),
  // so a genuine OUT_OF_USAGE_CREDITS means no other key on this account helps.
  if (provider === "ODDS") {
    if (typeof o.statusCode === "number" && typeof o.message === "string") {
      if (o.statusCode === 401 && (o.message as string).includes("OUT_OF_USAGE_CREDITS")) return true;
      const msg = (o.message as string).toLowerCase();
      // A 429 "rate limited" is a short per-key window, not shared quota — rotate.
      return msg.includes("out of usage") || msg.includes("quota exceeded") || msg.includes("usage quota");
    }
    return false;
  }

  // SportsGameOdds grants per-key quota (each customerID has its own objects/month),
  // so a 429 "rate limit exceeded" on one key must rotate to the next key, not freeze
  // the pool. We only signal pool-wide exhaustion on an explicit, unequivocal shared
  // quota message that isn't a plain rate limit.
  if (provider === "SPORTSGAMEODDS") {
    if (o.success === false && typeof o.error === "string") {
      const msg = o.error.toLowerCase();
      // "Rate limit exceeded" is per-key (per-minute or per-key monthly) → rotate.
      if (msg.includes("rate limit")) return false;
      return msg.includes("quota") || msg.includes("object") || msg.includes("upgrade");
    }
    return false;
  }

  return false;
}
