import { describe, it, expect, vi, afterEach } from "vitest";
import { getPitcherPropStats, getSeasonHittingBasic, ipToFloat } from "../players";

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

describe("getPitcherPropStats", () => {
  it("computes K/9 and outs-per-start from season totals", async () => {
    mockFetchOnce({
      stats: [
        {
          type: { displayName: "season" },
          splits: [
            { stat: { inningsPitched: "180.0", strikeOuts: 200, gamesStarted: 30 } },
          ],
        },
      ],
    });

    const result = await getPitcherPropStats(12345, 2026);
    expect(result).not.toBeNull();
    expect(result!.k9).toBeCloseTo(10, 5); // 200 * 9 / 180
    expect(result!.outsPerStart).toBeCloseTo(18, 5); // 180 * 3 / 30
    expect(result!.gamesStarted).toBe(30);
  });

  it("returns null when the pitcher has no innings pitched this season", async () => {
    mockFetchOnce({
      stats: [
        {
          type: { displayName: "season" },
          splits: [{ stat: { inningsPitched: "0.0", strikeOuts: 0, gamesStarted: 0 } }],
        },
      ],
    });

    expect(await getPitcherPropStats(12345, 2026)).toBeNull();
  });

  it("returns null when the API has no season group for this player", async () => {
    mockFetchOnce({ stats: [] });
    expect(await getPitcherPropStats(12345, 2026)).toBeNull();
  });
});

describe("getSeasonHittingBasic", () => {
  it("parses season hitting totals", async () => {
    mockFetchOnce({
      stats: [
        {
          type: { displayName: "season" },
          splits: [
            {
              stat: {
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
              },
            },
          ],
        },
      ],
    });

    expect(await getSeasonHittingBasic(67890, 2026)).toEqual({
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

  it("returns null when the API has no season group for this player", async () => {
    mockFetchOnce({ stats: [] });
    expect(await getSeasonHittingBasic(67890, 2026)).toBeNull();
  });
});
