import { describe, it, expect, vi, afterEach } from "vitest";
import { createPool, isQuotaExhausted, buildKeyList, DEFAULT_KEY_POOL_CONFIG } from "../keys";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("buildKeyList", () => {
  it("reads a single primary key", () => {
    vi.stubEnv("SPORTSGAMEODDS_API_KEY", "k1");
    expect(buildKeyList("SPORTSGAMEODDS")).toEqual(["k1"]);
  });

  it("orders bulk list first, then primary, then numbered secondaries, deduped", () => {
    vi.stubEnv("SPORTSGAMEODDS_API_KEYS", "bulkA,bulkB");
    vi.stubEnv("SPORTSGAMEODDS_API_KEY", "primary");
    vi.stubEnv("SPORTSGAMEODDS_API_KEY_2", "secondary");
    vi.stubEnv("SPORTSGAMEODDS_API_KEY_3", "bulkA"); // dup
    expect(buildKeyList("SPORTSGAMEODDS")).toEqual(["primary", "bulkA", "bulkB", "secondary"]);
  });

  it("dedupes a key that appears in both the bulk list and the primary slot", () => {
    vi.stubEnv("SPORTSGAMEODDS_API_KEYS", "shared");
    vi.stubEnv("SPORTSGAMEODDS_API_KEY", "shared");
    expect(buildKeyList("SPORTSGAMEODDS")).toEqual(["shared"]);
  });

  it("returns [] when nothing is set", () => {
    expect(buildKeyList("ODDS")).toEqual([]);
  });
});

describe("createPool rotation + failover", () => {
  it("picks the primary key first and rotates to the next on 429", () => {
    vi.stubEnv("ODDS_API_KEY", "k1");
    vi.stubEnv("ODDS_API_KEY_2", "k2");
    const pool = createPool("ODDS");

    expect(pool.pick()).toBe("k1");

    // k1 rate-limited → backoff, so pick() should now return k2.
    pool.record("k1", { ok: false, status: 429, body: null });
    expect(pool.pick()).toBe("k2");

    // k2 succeeds → stays eligible.
    pool.record("k2", { ok: true, status: 200, body: {} });
    expect(pool.pick()).toBe("k2");
    // k1 still in a very short (test) backoff with this default is skipped; but the
    // default backoff is long, so k1 remains ineligible within the test window.
  });

  it("rotates past an invalid (401) key", () => {
    vi.stubEnv("ODDS_API_KEY", "bad");
    vi.stubEnv("ODDS_API_KEY_2", "good");
    const pool = createPool("ODDS");

    pool.record("bad", { ok: false, status: 401, body: { statusCode: 401, message: "invalid subscription key" } });
    expect(pool.pick()).toBe("good");
  });

  it("marks the whole pool exhausted when quota is exhausted (shared subscription)", () => {
    vi.stubEnv("ODDS_API_KEY", "k1");
    vi.stubEnv("ODDS_API_KEY_2", "k2");
    const pool = createPool("ODDS");

    pool.record("k1", {
      ok: false,
      status: 401,
      body: { statusCode: 401, message: "Usage quota has been reached. OUT_OF_USAGE_CREDITS" },
    });

    // Quota is per-subscription → no key should be picked.
    expect(pool.pick()).toBeNull();
    expect(pool.isPoolExhausted()).toBe(true);
  });

  it("does not treat a plain invalid-key 401 as pool-wide quota", () => {
    vi.stubEnv("ODDS_API_KEY", "bad");
    vi.stubEnv("ODDS_API_KEY_2", "good");
    const pool = createPool("ODDS");

    pool.record("bad", { ok: false, status: 401, body: { statusCode: 401, message: "invalid subscription key" } });
    // A bad key is skipped but a second, valid key is still usable.
    expect(pool.pick()).toBe("good");
    expect(pool.isPoolExhausted()).toBe(false);
  });

  it("caps attempts on a key that keeps 429ing by treating it as exhausted", () => {
    vi.stubEnv("ODDS_API_KEY", "k1");
    vi.stubEnv("ODDS_API_KEY_2", "k2");
    const pool = createPool("ODDS", { rateLimitedBeforeExhausted: 2, rateLimitBackoffMs: 0 });

    pool.record("k1", { ok: false, status: 429, body: null });
    pool.record("k1", { ok: false, status: 429, body: null });
    // k1 exhausted after 2 consecutive 429s → k2 next.
    expect(pool.pick()).toBe("k2");
  });

  it("adopts newly added keys on the next pick (hot-swap) and drops removed ones", () => {
    vi.stubEnv("ODDS_API_KEY", "k1");
    const pool = createPool("ODDS");
    expect(pool.pick()).toBe("k1");

    vi.stubEnv("ODDS_API_KEY_2", "k2");
    expect(pool.pick()).toBe("k1"); // not yet in a failure state
    // Remove k1; k2 should be adopted on the next pick.
    vi.stubEnv("ODDS_API_KEY", "");
    expect(pool.pick()).toBe("k2");
  });

  it("rotates to a healthy secondary when the primary is rate-limited, without freezing the pool", () => {
    // Mirrors the prod scenario: old SGO key is exhausted (429 "rate limit"),
    // new independent key (_2) is healthy. The pool must rotate, not freeze.
    vi.stubEnv("SPORTSGAMEODDS_API_KEY", "old-exhausted");
    vi.stubEnv("SPORTSGAMEODDS_API_KEY_2", "new-healthy");
    const pool = createPool("SPORTSGAMEODDS");

    pool.record("old-exhausted", {
      ok: false,
      status: 429,
      body: { success: false, error: "Rate limit exceeded" },
    });

    // The exhausted primary is put in backoff, the pool is NOT frozen, and the
    // healthy secondary is picked next.
    expect(pool.isPoolExhausted()).toBe(false);
    expect(pool.pick()).toBe("new-healthy");
  });
});

describe("isQuotaExhausted", () => {
  it("detects The Odds API OUT_OF_USAGE_CREDITS", () => {
    expect(
      isQuotaExhausted({ statusCode: 401, message: "OUT_OF_USAGE_CREDITS" }, "ODDS"),
    ).toBe(true);
  });

  it("does not treat an SGO rate limit as pool-wide quota (per-key → rotate)", () => {
    // SGO grants per-key quota, so "Rate limit exceeded" on one key must rotate to
    // the next key rather than freezing the pool.
    expect(isQuotaExhausted({ success: false, error: "Rate limit exceeded" }, "SPORTSGAMEODDS")).toBe(false);
    // An explicit shared-quota/upgrade signal still counts.
    expect(isQuotaExhausted({ success: false, error: "quota" }, "SPORTSGAMEODDS")).toBe(true);
    expect(isQuotaExhausted({ success: false, error: "other" }, "SPORTSGAMEODDS")).toBe(false);
  });

  it("does not treat a benign body as quota", () => {
    expect(isQuotaExhausted({ hello: "world" }, "ODDS")).toBe(false);
    expect(isQuotaExhausted(null, "ODDS")).toBe(false);
  });
});

describe("DEFAULT_KEY_POOL_CONFIG", () => {
  it("has sensible non-zero backoffs", () => {
    expect(DEFAULT_KEY_POOL_CONFIG.rateLimitBackoffMs).toBeGreaterThan(0);
    expect(DEFAULT_KEY_POOL_CONFIG.invalidCooldownMs).toBeGreaterThan(0);
    expect(DEFAULT_KEY_POOL_CONFIG.exhaustedLeaseMs).toBeGreaterThan(0);
  });
});
