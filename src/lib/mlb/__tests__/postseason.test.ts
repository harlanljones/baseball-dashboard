import { describe, it, expect, vi, afterEach } from "vitest";
import { getBullpenWorkload } from "../players";
import { getHeadToHead, isPostseason } from "../schedule";

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Stubs fetch with a router from request URL to JSON body; returns the mock. */
function mockFetch(route: (url: URL) => unknown) {
  const fn = vi.fn(async (input: string) => ({
    ok: true,
    status: 200,
    json: async () => route(new URL(input)),
  }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

const NYY = { id: 147, name: "New York Yankees", abbreviation: "NYY" };
const BOS = { id: 111, name: "Boston Red Sox", abbreviation: "BOS" };

function game(gamePk: number, gameType: string, nyyScore: number, bosScore: number) {
  return {
    gamePk,
    gameDate: "2026-10-01T23:00:00Z",
    gameType,
    status: { abstractGameState: "Final" },
    teams: {
      away: { team: BOS, score: bosScore, isWinner: bosScore > nyyScore },
      home: { team: NYY, score: nyyScore, isWinner: nyyScore > bosScore },
    },
  };
}

describe("isPostseason", () => {
  it("recognizes each postseason round", () => {
    for (const t of ["F", "D", "L", "W"]) expect(isPostseason(t)).toBe(true);
  });

  it("rejects regular season, spring training and missing types", () => {
    expect(isPostseason("R")).toBe(false);
    expect(isPostseason("S")).toBe(false);
    expect(isPostseason(undefined)).toBe(false);
  });
});

describe("getHeadToHead", () => {
  it("stays regular season only for a regular-season game", async () => {
    const fetchMock = mockFetch(() => ({
      dates: [{ date: "2026-06-01", games: [game(1, "R", 5, 3)] }],
    }));

    const h2h = await getHeadToHead(NYY, BOS, 2026, "R");

    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.get("gameType")).toBe("R");
    expect(h2h.aWins).toBe(1);
    expect(h2h.postseason).toBeUndefined();
  });

  it("adds the current round's games for a postseason game", async () => {
    const fetchMock = mockFetch(() => ({
      dates: [
        {
          date: "2026-06-01",
          games: [game(1, "R", 5, 3), game(2, "R", 1, 4), game(3, "R", 2, 0)],
        },
        {
          date: "2026-10-01",
          games: [game(10, "D", 6, 2), game(11, "D", 3, 1), game(12, "D", 0, 7)],
        },
        // A game type the query didn't ask for is still filtered out.
        { date: "2026-03-01", games: [game(20, "S", 9, 0)] },
      ],
    }));

    const h2h = await getHeadToHead(NYY, BOS, 2026, "D");

    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.get("gameType")).toBe("R,D");

    expect(h2h.aWins).toBe(2);
    expect(h2h.bWins).toBe(1);
    expect(h2h.meetings.map((m) => m.gamePk)).toEqual([1, 2, 3]);

    expect(h2h.postseason).toMatchObject({ gameType: "D", name: "Division Series", aWins: 2, bWins: 1 });
    expect(h2h.postseason?.meetings.map((m) => m.gamePk)).toEqual([10, 11, 12]);
  });
});

describe("getBullpenWorkload", () => {
  const regularLogs = {
    people: [
      {
        id: 501,
        stats: [
          {
            splits: [
              // Last regular-season outing, inside the 3-day window.
              { date: "2026-09-28", stat: { numberOfPitches: 15 } },
              // Outside the window.
              { date: "2026-09-20", stat: { numberOfPitches: 30 } },
            ],
          },
        ],
      },
      { id: 502, stats: [{ splits: [] }] },
    ],
  };

  it("counts postseason outings from boxscores on postseason games", async () => {
    const fetchMock = mockFetch((url) => {
      if (url.pathname === "/api/v1/people") return regularLogs;
      if (url.pathname === "/api/v1/schedule") {
        return {
          dates: [
            {
              date: "2026-09-30",
              games: [
                {
                  gamePk: 900,
                  gameDate: "2026-09-30T23:08:00Z",
                  officialDate: "2026-09-30",
                  gameType: "F",
                  status: { abstractGameState: "Final" },
                },
              ],
            },
            {
              date: "2026-10-01",
              games: [
                {
                  gamePk: 901,
                  gameDate: "2026-10-01T23:08:00Z",
                  officialDate: "2026-10-01",
                  gameType: "F",
                  status: { abstractGameState: "Final" },
                },
              ],
            },
          ],
        };
      }
      if (url.pathname === "/api/v1/game/900/boxscore") {
        return {
          teams: {
            away: {
              team: { id: 111 },
              pitchers: [777],
              players: { ID777: { stats: { pitching: { numberOfPitches: 99 } } } },
            },
            home: {
              team: { id: 147 },
              pitchers: [501, 502],
              players: {
                ID501: { stats: { pitching: { numberOfPitches: 20 } } },
                ID502: { stats: { pitching: { numberOfPitches: 12 } } },
              },
            },
          },
        };
      }
      if (url.pathname === "/api/v1/game/901/boxscore") {
        return {
          teams: {
            away: { team: { id: 111 }, pitchers: [], players: {} },
            home: {
              team: { id: 147 },
              pitchers: [501],
              players: { ID501: { stats: { pitching: { numberOfPitches: 18 } } } },
            },
          },
        };
      }
      throw new Error(`unexpected request ${url}`);
    });

    const workload = await getBullpenWorkload([501, 502], 2026, "2026-10-02", 147);

    const scheduleCall = fetchMock.mock.calls
      .map(([u]) => new URL(u))
      .find((u) => u.pathname === "/api/v1/schedule");
    expect(scheduleCall?.searchParams.get("teamId")).toBe("147");
    expect(scheduleCall?.searchParams.get("startDate")).toBe("2026-09-29");
    expect(scheduleCall?.searchParams.get("endDate")).toBe("2026-10-01");

    // 20 (Sep 30) + 18 (Oct 1); the Sep 28 regular-season outing is outside the window.
    expect(workload.get(501)).toEqual({ yesterday: 18, last3: 38 });
    expect(workload.get(502)).toEqual({ yesterday: 0, last3: 12 });
  });

  it("merges regular-season and postseason outings in the same window", async () => {
    mockFetch((url) => {
      if (url.pathname === "/api/v1/people") return regularLogs;
      if (url.pathname === "/api/v1/schedule") {
        return {
          dates: [
            {
              date: "2026-09-30",
              games: [
                {
                  gamePk: 900,
                  gameDate: "2026-09-30T23:08:00Z",
                  officialDate: "2026-09-30",
                  gameType: "F",
                  status: { abstractGameState: "Final" },
                },
              ],
            },
          ],
        };
      }
      if (url.pathname === "/api/v1/game/900/boxscore") {
        return {
          teams: {
            home: {
              team: { id: 147 },
              pitchers: [501],
              players: { ID501: { stats: { pitching: { numberOfPitches: 20 } } } },
            },
          },
        };
      }
      throw new Error(`unexpected request ${url}`);
    });

    const workload = await getBullpenWorkload([501], 2026, "2026-10-01", 147);

    // 15 (Sep 28, regular season) + 20 (Sep 30, Wild Card).
    expect(workload.get(501)).toEqual({ yesterday: 20, last3: 35 });
  });

  it("skips the postseason lookup for regular-season games", async () => {
    const fetchMock = mockFetch((url) => {
      if (url.pathname === "/api/v1/people") return regularLogs;
      throw new Error(`unexpected request ${url}`);
    });

    const workload = await getBullpenWorkload([501], 2026, "2026-09-29");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(workload.get(501)).toEqual({ yesterday: 15, last3: 15 });
  });
});
