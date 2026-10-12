import { describe, it, expect, vi, afterEach } from "vitest";
import { getPitcherPropStatsBatch, getRosterWithSeasonStats, ipToFloat } from "../players";

/**
 * Coverage for the live readers. These cases started life against the
 * single-player helpers (`getPitcherPropStats`, `getSeasonHittingBasic`), which
 * nothing in the app called; they now exercise the batched readers the app
 * actually uses, which had none.
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockFetchOnce(body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => body,
    }),
  );
}

/** One person's `people` entry, as `fetchPeopleStats` reads it. */
function personStats(id: number, stat: Record<string, unknown>) {
  return {
    people: [
      {
        id,
        stats: [{ type: { displayName: "season" }, splits: [{ stat }] }],
      },
    ],
  };
}

describe("ipToFloat", () => {
  it("converts whole innings", () => {
    expect(ipToFloat("123.0")).toBe(123);
  });

  it("converts one-third innings", () => {
    expect(ipToFloat("123.1")).toBeCloseTo(123.333, 2);
  });

  it("converts two-thirds innings", () => {
    expect(ipToFloat("123.2")).toBeCloseTo(123.667, 2);
  });
});

describe("getPitcherPropStatsBatch", () => {
  it("computes K/9 and outs-per-start from season totals", async () => {
    mockFetchOnce(
      personStats(12345, { inningsPitched: "180.0", strikeOuts: 200, gamesStarted: 30 }),
    );

    const result = (await getPitcherPropStatsBatch([12345], 2026)).get(12345);
    expect(result?.k9).toBeCloseTo(10, 5); // 200 * 9 / 180
    expect(result?.outsPerStart).toBeCloseTo(18, 5); // 180 * 3 / 30
    expect(result?.gamesStarted).toBe(30);
  });

  it("omits a pitcher with no innings pitched this season", async () => {
    mockFetchOnce(
      personStats(12345, { inningsPitched: "0.0", strikeOuts: 0, gamesStarted: 0 }),
    );

    expect(await getPitcherPropStatsBatch([12345], 2026)).toEqual(new Map());
  });

  it("omits a pitcher the API returns no season group for", async () => {
    mockFetchOnce({ people: [] });
    expect(await getPitcherPropStatsBatch([12345], 2026)).toEqual(new Map());
  });

  it("does not fetch when given no ids", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    expect(await getPitcherPropStatsBatch([], 2026)).toEqual(new Map());
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("getRosterWithSeasonStats", () => {
  const hitting = {
    avg: ".280",
    obp: ".350",
    slg: ".480",
    hits: 150,
    homeRuns: 25,
    rbi: 80,
    baseOnBalls: 55,
    totalBases: 260,
    plateAppearances: 600,
    gamesPlayed: 150,
  };

  it("carries each hitter's season hitting totals and drops pitchers", async () => {
    mockFetchOnce({
      roster: [
        {
          position: { type: "Outfielder" },
          person: {
            id: 67890,
            fullName: "A Hitter",
            stats: [{ splits: [{ stat: hitting }] }],
          },
        },
        { position: { type: "Pitcher" }, person: { id: 11111, fullName: "A Pitcher" } },
      ],
    });

    const hitters = await getRosterWithSeasonStats(147, 2026);
    expect(hitters).toHaveLength(1);
    expect(hitters[0].season).toEqual({
      avg: ".280",
      obp: ".350",
      slg: ".480",
      h: 150,
      hr: 25,
      rbi: 80,
      bb: 55,
      totalBases: 260,
      pa: 600,
      games: 150,
    });
  });
});
