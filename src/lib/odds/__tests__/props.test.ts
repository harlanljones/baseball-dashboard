import { describe, it, expect, vi, afterEach } from "vitest";
import { getPlayerProps, loadGamePlayerProps } from "../props";

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

/** Sentinel making the stub return a 500 for a routed URL. */
const FAIL = "fail";

const SGO_EVENT = {
  eventID: "sgo-evt-1",
  teams: {
    away: { names: { long: "New York Yankees" } },
    home: { names: { long: "Boston Red Sox" } },
  },
  status: { startsAt: "2026-07-22T23:05:00Z" },
  players: { AARON_JUDGE_1_MLB: { name: "Aaron Judge" } },
  odds: {
    "batting_hits-AARON_JUDGE_1_MLB-game-ou-over": {
      statID: "batting_hits",
      playerID: "AARON_JUDGE_1_MLB",
      periodID: "game",
      betTypeID: "ou",
      sideID: "over",
      byBookmaker: { fanduel: { odds: "-130", overUnder: "0.5", available: true } },
    },
    "batting_hits-AARON_JUDGE_1_MLB-game-ou-under": {
      statID: "batting_hits",
      playerID: "AARON_JUDGE_1_MLB",
      periodID: "game",
      betTypeID: "ou",
      sideID: "under",
      byBookmaker: { fanduel: { odds: "+110", overUnder: "0.5", available: true } },
    },
  },
};

const TOA_PROPS = {
  id: "toa-evt-1",
  bookmakers: [
    {
      key: "draftkings",
      markets: [
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
};

const TOA_EVENTS = [
  {
    id: "toa-evt-1",
    commence_time: "2026-07-22T23:05:00Z",
    home_team: "Boston Red Sox",
    away_team: "New York Yankees",
  },
];

/**
 * Routes stubbed responses by URL so cascade tests can exercise both
 * providers; The Odds API needs distinct payloads for its events listing
 * (`/baseball_mlb/events`) and per-event odds (`.../odds`) endpoints.
 */
function stubFetch(route: (url: string) => unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      const url = String(input instanceof Request ? input.url : input);
      const body = route(url);
      if (body === undefined) throw new Error(`unexpected fetch to ${url}`);
      if (body === FAIL) return { ok: false, status: 500, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => body };
    }),
  );
}

const SGO_BOARD = { success: true, data: [SGO_EVENT] };
const SGO_EMPTY_BOARD = { success: true, data: [{ ...SGO_EVENT, odds: {} }] };

/** The Odds API's two-endpoint shape: listing first, then per-event odds. */
function toaRoute(odds: unknown) {
  return (rawUrl: string): unknown => {
    if (!rawUrl.includes("the-odds-api.com")) return undefined;
    const { pathname } = new URL(rawUrl);
    return pathname.endsWith("/odds") ? odds : TOA_EVENTS;
  };
}

describe("loadGamePlayerProps", () => {
  const away = "New York Yankees";
  const home = "Boston Red Sox";
  const start = "2026-07-22T23:05:00Z";

  it("returns [] without fetching when neither provider key is set", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    expect(await loadGamePlayerProps(away, home, start)).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns props from SportsGameOdds when the primary succeeds", async () => {
    vi.stubEnv("SPORTSGAMEODDS_API_KEY", "sgo-key");
    vi.stubEnv("ODDS_API_KEY", "toa-key");
    stubFetch((url) => (url.includes("sportsgameodds.com") ? SGO_BOARD : undefined));

    expect(await loadGamePlayerProps(away, home, start)).toEqual([
      {
        marketKey: "batter_hits",
        playerName: "Aaron Judge",
        line: 0.5,
        overPrice: -130,
        underPrice: 110,
      },
    ]);
  });

  it("falls back to The Odds API when SportsGameOdds resolves but posts zero props", async () => {
    vi.stubEnv("SPORTSGAMEODDS_API_KEY", "sgo-key");
    vi.stubEnv("ODDS_API_KEY", "toa-key");
    let sgoCalls = 0;
    const toa = toaRoute(TOA_PROPS);
    stubFetch((url) => {
      if (url.includes("sportsgameodds.com")) {
        sgoCalls += 1;
        return SGO_EMPTY_BOARD;
      }
      return toa(url);
    });

    expect(await loadGamePlayerProps(away, home, start)).toEqual([
      {
        marketKey: "batter_hits",
        playerName: "Aaron Judge",
        line: 0.5,
        overPrice: -130,
        underPrice: 110,
      },
    ]);
    expect(sgoCalls).toBeGreaterThan(0);
  });

  it("falls back to The Odds API when the primary request fails", async () => {
    vi.stubEnv("SPORTSGAMEODDS_API_KEY", "sgo-key");
    vi.stubEnv("ODDS_API_KEY", "toa-key");
    const toa = toaRoute(TOA_PROPS);
    stubFetch((url) =>
      url.includes("sportsgameodds.com") ? FAIL : toa(url),
    );

    expect(await loadGamePlayerProps(away, home, start)).toHaveLength(1);
  });

  it("returns [] when the primary is empty and no fallback key is configured", async () => {
    vi.stubEnv("SPORTSGAMEODDS_API_KEY", "sgo-key");
    stubFetch((url) => (url.includes("sportsgameodds.com") ? SGO_EMPTY_BOARD : undefined));

    expect(await loadGamePlayerProps(away, home, start)).toEqual([]);
  });

  it("uses The Odds API directly when only its key is configured", async () => {
    vi.stubEnv("ODDS_API_KEY", "toa-key");
    stubFetch(toaRoute(TOA_PROPS));

    expect(await loadGamePlayerProps(away, home, start)).toEqual([
      {
        marketKey: "batter_hits",
        playerName: "Aaron Judge",
        line: 0.5,
        overPrice: -130,
        underPrice: 110,
      },
    ]);
  });

  it("returns [] instead of throwing when both providers fail", async () => {
    vi.stubEnv("SPORTSGAMEODDS_API_KEY", "sgo-key");
    vi.stubEnv("ODDS_API_KEY", "toa-key");
    const toa = toaRoute(FAIL);
    stubFetch((url) => (url.includes("sportsgameodds.com") ? FAIL : toa(url)));

    expect(await loadGamePlayerProps(away, home, start)).toEqual([]);
  });
});

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
