import { describe, it, expect, vi, afterEach } from "vitest";
import {
  getSeasonDates,
  getSeasonRecap,
  getOpeningDay,
  getOffseasonContext,
} from "../season";

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Routes requests by pathname to a fixture body; an unmatched URL throws so
 * a test can assert an endpoint was (or wasn't) called. */
function mockRouter(routes: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const { pathname } = new URL(url);
      if (!(pathname in routes)) {
        throw new Error(`Unhandled URL in test: ${url} (init: ${JSON.stringify(init)})`);
      }
      return { ok: true, status: 200, json: async () => routes[pathname] };
    }),
  );
}

const DODGERS = { id: 119, name: "Los Angeles Dodgers" };
const BLUE_JAYS = { id: 141, name: "Toronto Blue Jays" };

function finalGame(
  gamePk: number,
  date: string,
  winner: { id: number; name: string },
  loser: { id: number; name: string },
  seriesDescription: string | undefined,
  gamesInSeries: number,
) {
  return {
    gamePk,
    gameDate: date,
    status: { abstractGameState: "Final", detailedState: "Final" },
    teams: {
      away: { team: winner, score: 5, isWinner: true },
      home: { team: loser, score: 3, isWinner: false },
    },
    seriesDescription,
    gamesInSeries,
  };
}

describe("getSeasonDates", () => {
  it("maps the seasons endpoint", async () => {
    mockRouter({
      "/api/v1/seasons/2026": {
        seasons: [
          {
            seasonId: "2026",
            springStartDate: "2026-02-20",
            regularSeasonStartDate: "2026-03-25",
            regularSeasonEndDate: "2026-09-27",
          },
        ],
      },
    });
    expect(await getSeasonDates(2026)).toEqual({
      springStartDate: "2026-02-20",
      regularSeasonStartDate: "2026-03-25",
      regularSeasonEndDate: "2026-09-27",
    });
  });

  it("returns null when the API has no season entry", async () => {
    mockRouter({ "/api/v1/seasons/2099": {} });
    expect(await getSeasonDates(2099)).toBeNull();
  });

  it("returns null instead of throwing on a fetch failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 503 }),
    );
    expect(await getSeasonDates(2026)).toBeNull();
  });
});

describe("getSeasonRecap", () => {
  it("orders series W/L/D/F, derives the winner/champion/finalGame, and dedupes games", async () => {
    mockRouter({
      "/api/v1/schedule/postseason/series": {
        series: [
          // Registered out of order to exercise the W,L,D,F sort.
          {
            series: { id: "F_2", gameType: "F", sortNumber: 0 },
            games: [
              // No seriesDescription anywhere -> label falls back to the series id.
              finalGame(700, "2025-10-01T00:00:00Z", DODGERS, BLUE_JAYS, undefined, 3),
              finalGame(701, "2025-10-02T00:00:00Z", DODGERS, BLUE_JAYS, undefined, 3),
            ],
          },
          {
            series: { id: "D_1", gameType: "D", sortNumber: 1 },
            games: [
              finalGame(800, "2025-10-10T00:00:00Z", DODGERS, BLUE_JAYS, "NL Division Series", 5),
              finalGame(801, "2025-10-11T00:00:00Z", DODGERS, BLUE_JAYS, "NL Division Series", 5),
              finalGame(802, "2025-10-12T00:00:00Z", DODGERS, BLUE_JAYS, "NL Division Series", 5),
            ],
          },
          {
            series: { id: "L_1", gameType: "L", sortNumber: 1 },
            games: [
              finalGame(850, "2025-10-15T00:00:00Z", BLUE_JAYS, DODGERS, "ALCS", 7),
              finalGame(851, "2025-10-16T00:00:00Z", BLUE_JAYS, DODGERS, "ALCS", 7),
              finalGame(852, "2025-10-17T00:00:00Z", BLUE_JAYS, DODGERS, "ALCS", 7),
              finalGame(853, "2025-10-18T00:00:00Z", BLUE_JAYS, DODGERS, "ALCS", 7),
            ],
          },
          {
            series: { id: "W_1", gameType: "W", sortNumber: 1 },
            games: [
              finalGame(900, "2025-10-24T00:00:00Z", DODGERS, BLUE_JAYS, "World Series", 7),
              finalGame(901, "2025-10-25T00:00:00Z", BLUE_JAYS, DODGERS, "World Series", 7),
              finalGame(902, "2025-10-27T00:00:00Z", DODGERS, BLUE_JAYS, "World Series", 7),
              // 903 appears twice: a stale postponed stub, then the real makeup.
              {
                gamePk: 903,
                gameDate: "2025-10-28T00:00:00Z",
                status: { abstractGameState: "Preview", detailedState: "Postponed" },
                teams: {
                  away: { team: DODGERS, isWinner: undefined },
                  home: { team: BLUE_JAYS, isWinner: undefined },
                },
                seriesDescription: "World Series",
                gamesInSeries: 7,
              },
              finalGame(903, "2025-10-29T00:00:00Z", DODGERS, BLUE_JAYS, "World Series", 7),
              finalGame(904, "2025-10-30T00:00:00Z", BLUE_JAYS, DODGERS, "World Series", 7),
              finalGame(905, "2025-11-01T00:00:00Z", BLUE_JAYS, DODGERS, "World Series", 7),
              finalGame(906, "2025-11-02T00:00:00Z", DODGERS, BLUE_JAYS, "World Series", 7),
            ],
          },
        ],
      },
    });

    const recap = await getSeasonRecap(2025);

    expect(recap.season).toBe(2025);
    expect(recap.isOver).toBe(true);
    expect(recap.champion).toEqual(DODGERS);
    // Ordered World Series, then LCS, then Division Series, then Wild Card.
    expect(recap.series.map((s) => s.id)).toEqual(["W_1", "L_1", "D_1", "F_2"]);
    expect(recap.series.map((s) => s.label)).toEqual([
      "World Series",
      "ALCS",
      "NL Division Series",
      "F_2",
    ]);

    const worldSeries = recap.series[0];
    expect(worldSeries.winner).toEqual(DODGERS);
    expect(worldSeries.status).toBe("Won 4-3");
    // The dup gamePk 903 resolves to exactly one (decided) game.
    expect(worldSeries.games.filter((g) => g.gamePk === 903)).toHaveLength(1);
    expect(worldSeries.games).toHaveLength(7);

    // Latest completed game across every series.
    expect(recap.finalGame?.gamePk).toBe(906);
    expect(recap.finalGame?.gameDate).toBe("2025-11-02T00:00:00Z");
  });

  it("leaves winner/champion unset and isOver false while a series is undecided", async () => {
    mockRouter({
      "/api/v1/schedule/postseason/series": {
        series: [
          {
            series: { id: "W_1", gameType: "W", sortNumber: 1 },
            games: [
              finalGame(1, "2025-10-24T00:00:00Z", DODGERS, BLUE_JAYS, "World Series", 7),
              finalGame(2, "2025-10-25T00:00:00Z", BLUE_JAYS, DODGERS, "World Series", 7),
            ],
          },
        ],
      },
    });
    const recap = await getSeasonRecap(2025);
    expect(recap.isOver).toBe(false);
    expect(recap.champion).toBeUndefined();
    expect(recap.series[0].winner).toBeUndefined();
    expect(recap.series[0].status).toBeUndefined();
  });

  it("returns an empty, not-over recap for a missing/empty postseason response", async () => {
    mockRouter({ "/api/v1/schedule/postseason/series": {} });
    expect(await getSeasonRecap(2027)).toEqual({ season: 2027, isOver: false, series: [] });
  });
});

describe("getOpeningDay", () => {
  it("uses the earliest schedule date, with springStart from the seasons endpoint", async () => {
    mockRouter({
      "/api/v1/schedule": { dates: [{ date: "2026-03-19" }, { date: "2026-03-20" }] },
      "/api/v1/seasons/2026": {
        seasons: [{ springStartDate: "2026-02-20", regularSeasonStartDate: "2026-03-25" }],
      },
    });
    expect(await getOpeningDay(2026)).toEqual({
      season: 2026,
      date: "2026-03-19",
      springStart: "2026-02-20",
    });
  });

  it("falls back to the seasons endpoint's regularSeasonStartDate when the schedule is empty", async () => {
    mockRouter({
      "/api/v1/schedule": { dates: [] },
      "/api/v1/seasons/2026": {
        seasons: [{ springStartDate: "2026-02-20", regularSeasonStartDate: "2026-03-25" }],
      },
    });
    expect(await getOpeningDay(2026)).toEqual({
      season: 2026,
      date: "2026-03-25",
      springStart: "2026-02-20",
    });
  });
});

describe("getOffseasonContext", () => {
  it("returns the just-finished season once the World Series is over", async () => {
    mockRouter({
      "/api/v1/seasons/2026": {
        seasons: [
          { springStartDate: "2026-02-20", regularSeasonStartDate: "2026-03-25", regularSeasonEndDate: "2026-09-27" },
        ],
      },
      "/api/v1/schedule/postseason/series": {
        series: [
          {
            series: { id: "W_1", gameType: "W", sortNumber: 1 },
            games: [
              finalGame(1, "2026-10-24T00:00:00Z", DODGERS, BLUE_JAYS, "World Series", 5),
              finalGame(2, "2026-10-25T00:00:00Z", DODGERS, BLUE_JAYS, "World Series", 5),
              finalGame(3, "2026-10-26T00:00:00Z", DODGERS, BLUE_JAYS, "World Series", 5),
            ],
          },
        ],
      },
    });
    expect(await getOffseasonContext("2026-12-01")).toEqual({ recapSeason: 2026, nextSeason: 2027 });
  });

  it("returns last season's recap and the upcoming season before spring training starts", async () => {
    mockRouter({
      "/api/v1/seasons/2027": {
        seasons: [
          { springStartDate: "2027-02-19", regularSeasonStartDate: "2027-03-25", regularSeasonEndDate: "2027-09-26" },
        ],
      },
    });
    expect(await getOffseasonContext("2027-01-15")).toEqual({ recapSeason: 2026, nextSeason: 2027 });
  });

  it("returns null for an in-season off day", async () => {
    mockRouter({
      "/api/v1/seasons/2026": {
        seasons: [
          { springStartDate: "2026-02-20", regularSeasonStartDate: "2026-03-25", regularSeasonEndDate: "2026-09-27" },
        ],
      },
    });
    expect(await getOffseasonContext("2026-07-15")).toBeNull();
  });

  it("returns null once the regular season is over but the World Series isn't decided yet", async () => {
    mockRouter({
      "/api/v1/seasons/2026": {
        seasons: [
          { springStartDate: "2026-02-20", regularSeasonStartDate: "2026-03-25", regularSeasonEndDate: "2026-09-27" },
        ],
      },
      "/api/v1/schedule/postseason/series": {
        series: [
          {
            series: { id: "W_1", gameType: "W", sortNumber: 1 },
            games: [finalGame(1, "2026-10-04T00:00:00Z", DODGERS, BLUE_JAYS, "World Series", 7)],
          },
        ],
      },
    });
    expect(await getOffseasonContext("2026-10-05")).toBeNull();
  });

  it("never throws — returns null when the MLB API is down", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down")),
    );
    expect(await getOffseasonContext("2026-12-01")).toBeNull();
  });
});
