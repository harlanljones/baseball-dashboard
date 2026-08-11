import { describe, it, expect, vi, afterEach } from "vitest";
import { getPlayerProps } from "../props";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function mockOdds(body: unknown) {
  vi.stubEnv("ODDS_API_KEY", "test-key");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => body }),
  );
}

describe("getPlayerProps", () => {
  it("pairs Over/Under outcomes per player into PlayerProp rows", async () => {
    mockOdds({
      id: "evt-1",
      bookmakers: [
        {
          key: "draftkings",
          markets: [
            {
              key: "pitcher_strikeouts",
              outcomes: [
                { name: "Over", description: "Gerrit Cole", price: -115, point: 6.5 },
                { name: "Under", description: "Gerrit Cole", price: -105, point: 6.5 },
              ],
            },
            {
              key: "batter_hits",
              outcomes: [
                { name: "Over", description: "Aaron Judge", price: -130, point: 0.5 },
                { name: "Under", description: "Aaron Judge", price: 110, point: 0.5 },
              ],
            },
          ],
        },
      ],
    });

    expect(await getPlayerProps("evt-1")).toEqual([
      {
        marketKey: "pitcher_strikeouts",
        playerName: "Gerrit Cole",
        line: 6.5,
        overPrice: -115,
        underPrice: -105,
      },
      {
        marketKey: "batter_hits",
        playerName: "Aaron Judge",
        line: 0.5,
        overPrice: -130,
        underPrice: 110,
      },
    ]);
  });

  it("returns an empty array when there are no bookmakers", async () => {
    mockOdds({ id: "evt-1", bookmakers: [] });
    expect(await getPlayerProps("evt-1")).toEqual([]);
  });

  it("drops an outcome pair whose Over/Under lines disagree", async () => {
    mockOdds({
      id: "evt-1",
      bookmakers: [
        {
          key: "draftkings",
          markets: [
            {
              key: "batter_hits",
              outcomes: [
                { name: "Over", description: "Aaron Judge", price: -130, point: 0.5 },
                { name: "Under", description: "Aaron Judge", price: 110, point: 1.5 },
              ],
            },
          ],
        },
      ],
    });

    expect(await getPlayerProps("evt-1")).toEqual([]);
  });

  it("ignores markets outside the tracked set", async () => {
    mockOdds({
      id: "evt-1",
      bookmakers: [
        {
          key: "draftkings",
          markets: [
            {
              key: "batter_stolen_bases",
              outcomes: [
                { name: "Over", description: "Aaron Judge", price: -130, point: 0.5 },
                { name: "Under", description: "Aaron Judge", price: 110, point: 0.5 },
              ],
            },
          ],
        },
      ],
    });

    expect(await getPlayerProps("evt-1")).toEqual([]);
  });

  it("returns an empty array when the fetch fails", async () => {
    vi.stubEnv("ODDS_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }),
    );

    await expect(getPlayerProps("evt-1")).rejects.toThrow();
  });
});
