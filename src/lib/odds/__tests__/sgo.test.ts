import { describe, it, expect, vi, afterEach } from "vitest";
import {
  findSgoEvent,
  getSgoApiKey,
  getSgoPlayerProps,
  parseSgoProps,
  playerNameFromId,
  SgoError,
  teamsMatch,
} from "../sgo";
import type { SgoEvent } from "../sgo";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function bookLine(odds: string, overUnder: string, available = true) {
  return { odds, overUnder, available };
}

/** Builds one event carrying a matched over/under prop for one player/market. */
function sgoEvent(overrides: Partial<SgoEvent> = {}): SgoEvent {
  return {
    eventID: "sgo-evt-1",
    teams: {
      away: { names: { long: "New York Yankees" } },
      home: { names: { long: "Boston Red Sox" } },
    },
    status: { startsAt: "2026-07-22T23:05:00Z" },
    players: {},
    odds: {},
    ...overrides,
  };
}

describe("getSgoApiKey", () => {
  it("returns null when SPORTSGAMEODDS_API_KEY is unset", () => {
    expect(getSgoApiKey()).toBeNull();
  });

  it("returns the key when set", () => {
    vi.stubEnv("SPORTSGAMEODDS_API_KEY", "abc123");
    expect(getSgoApiKey()).toBe("abc123");
  });
});

describe("teamsMatch", () => {
  it("matches exact, contained, and case-insensitive names", () => {
    expect(teamsMatch("Boston Red Sox", "Boston Red Sox")).toBe(true);
    expect(teamsMatch("boston red sox", "Boston Red Sox")).toBe(true);
    expect(teamsMatch("Red Sox", "Boston Red Sox")).toBe(true);
    expect(teamsMatch("Chicago Cubs", "Boston Red Sox")).toBe(false);
  });
});

describe("playerNameFromId", () => {
  it("strips the numeric and league suffix and expands underscores", () => {
    expect(playerNameFromId("AARON_JUDGE_1_MLB")).toBe("AARON JUDGE");
    expect(playerNameFromId("TARIK_SKUBAL_1_MLB")).toBe("TARIK SKUBAL");
  });

  it("falls back to replacing underscores when the suffix pattern is absent", () => {
    expect(playerNameFromId("SOME_PLAYER")).toBe("SOME PLAYER");
  });
});

describe("findSgoEvent", () => {
  function mockBoard(events: SgoEvent[]) {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: events }),
      }),
    );
  }

  it("returns null without fetching when the key is unset", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const id = await findSgoEvent("New York Yankees", "Boston Red Sox", "2026-07-22T23:05:00Z");
    expect(id).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("requests only MLB pre-game events for the tracked markets with header auth", async () => {
    vi.stubEnv("SPORTSGAMEODDS_API_KEY", "secret-key");
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true, data: [] }) });
    vi.stubGlobal("fetch", fetchSpy);

    await findSgoEvent("New York Yankees", "Boston Red Sox", "2026-07-22T23:05:00Z");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const parsed = new URL(url);
    expect(parsed.pathname).toBe("/v2/events");
    expect(parsed.searchParams.get("leagueID")).toBe("MLB");
    expect(parsed.searchParams.get("oddsAvailable")).toBe("true");
    expect(parsed.searchParams.get("started")).toBe("false");
    expect(parsed.searchParams.get("oddIDs")).toContain("pitching_strikeouts-PLAYER_ID-game-ou-over");
    expect(parsed.searchParams.get("oddIDs")).toContain("batting_RBI-PLAYER_ID-game-ou-under");
    expect(url).not.toContain("secret-key");
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("secret-key");
  });

  it("matches by team name pair and returns the event id", async () => {
    vi.stubEnv("SPORTSGAMEODDS_API_KEY", "test-key");
    mockBoard([
      sgoEvent(),
      sgoEvent({
        eventID: "sgo-other",
        teams: {
          away: { names: { long: "St. Louis Cardinals" } },
          home: { names: { long: "Chicago Cubs" } },
        },
      }),
    ]);

    const id = await findSgoEvent("New York Yankees", "Boston Red Sox", "2026-07-22T23:05:00Z");
    expect(id).toBe("sgo-evt-1");
  });

  it("picks the closest start time for a doubleheader", async () => {
    vi.stubEnv("SPORTSGAMEODDS_API_KEY", "test-key");
    mockBoard([
      sgoEvent({
        eventID: "sgo-early",
        status: { startsAt: "2026-07-22T17:05:00Z" },
      }),
      sgoEvent({
        eventID: "sgo-late",
        status: { startsAt: "2026-07-22T23:05:00Z" },
      }),
    ]);

    const id = await findSgoEvent("New York Yankees", "Boston Red Sox", "2026-07-22T22:45:00Z");
    expect(id).toBe("sgo-late");
  });

  it("returns null when no event matches", async () => {
    vi.stubEnv("SPORTSGAMEODDS_API_KEY", "test-key");
    mockBoard([]);

    const id = await findSgoEvent("New York Yankees", "Boston Red Sox", "2026-07-22T23:05:00Z");
    expect(id).toBeNull();
  });

  it("throws SgoError on a non-2xx response", async () => {
    vi.stubEnv("SPORTSGAMEODDS_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 402, json: async () => ({}) }),
    );

    await expect(
      findSgoEvent("New York Yankees", "Boston Red Sox", "2026-07-22T23:05:00Z"),
    ).rejects.toThrow(SgoError);
  });

  it("throws SgoError when the API reports success:false", async () => {
    vi.stubEnv("SPORTSGAMEODDS_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: false, error: "quota exceeded" }),
      }),
    );

    await expect(
      findSgoEvent("New York Yankees", "Boston Red Sox", "2026-07-22T23:05:00Z"),
    ).rejects.toThrow(SgoError);
  });

  it("follows the pagination cursor", async () => {
    vi.stubEnv("SPORTSGAMEODDS_API_KEY", "test-key");
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: [], nextCursor: "page-2" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: [sgoEvent()] }),
      });
    vi.stubGlobal("fetch", fetchSpy);

    const id = await findSgoEvent("New York Yankees", "Boston Red Sox", "2026-07-22T23:05:00Z");
    expect(id).toBe("sgo-evt-1");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const secondUrl = new URL(fetchSpy.mock.calls[1][0] as string);
    expect(secondUrl.searchParams.get("cursor")).toBe("page-2");
  });
});

describe("parseSgoProps", () => {
  function propOdd(statId: string, playerId: string, side: "over" | "under") {
    return {
      oddID: `${statId}-${playerId}-game-ou-${side}`,
      statID: statId,
      playerID: playerId,
      periodID: "game",
      betTypeID: "ou",
      sideID: side,
      byBookmaker: {} as Record<string, { odds: string; overUnder: string; available?: boolean }>,
    };
  }

  it("pairs over/under per player and market into PlayerProp rows", () => {
    const event = sgoEvent({
      players: { AARON_JUDGE_1_MLB: { name: "Aaron Judge" } },
      odds: {
        "batting_hits-AARON_JUDGE_1_MLB-game-ou-over": {
          ...propOdd("batting_hits", "AARON_JUDGE_1_MLB", "over"),
          byBookmaker: { fanduel: bookLine("-130", "0.5") },
        },
        "batting_hits-AARON_JUDGE_1_MLB-game-ou-under": {
          ...propOdd("batting_hits", "AARON_JUDGE_1_MLB", "under"),
          byBookmaker: { fanduel: bookLine("+110", "0.5") },
        },
      },
    });

    expect(parseSgoProps(event)).toEqual([
      {
        marketKey: "batter_hits",
        playerName: "Aaron Judge",
        line: 0.5,
        overPrice: -130,
        underPrice: 110,
      },
    ]);
  });

  it("derives the player name from the playerID when no player record exists", () => {
    const event = sgoEvent({
      odds: {
        "pitching_strikeouts-TARIK_SKUBAL_1_MLB-game-ou-over": {
          ...propOdd("pitching_strikeouts", "TARIK_SKUBAL_1_MLB", "over"),
          byBookmaker: { draftkings: bookLine("-115", "6.5") },
        },
        "pitching_strikeouts-TARIK_SKUBAL_1_MLB-game-ou-under": {
          ...propOdd("pitching_strikeouts", "TARIK_SKUBAL_1_MLB", "under"),
          byBookmaker: { draftkings: bookLine("-105", "6.5") },
        },
      },
    });

    expect(parseSgoProps(event)).toEqual([
      {
        marketKey: "pitcher_strikeouts",
        playerName: "TARIK SKUBAL",
        line: 6.5,
        overPrice: -115,
        underPrice: -105,
      },
    ]);
  });

  it("prefers FanDuel over later-listed DraftKings", () => {
    const odd = propOdd("batting_totalBases", "AARON_JUDGE_1_MLB", "over");
    odd.byBookmaker = {
      draftkings: bookLine("-140", "1.5"),
      fanduel: bookLine("-125", "1.5"),
    };
    const under = propOdd("batting_totalBases", "AARON_JUDGE_1_MLB", "under");
    under.byBookmaker = {
      draftkings: bookLine("+120", "1.5"),
      fanduel: bookLine("+105", "1.5"),
    };
    const event = sgoEvent({
      odds: {
        "batting_totalBases-AARON_JUDGE_1_MLB-game-ou-over": odd,
        "batting_totalBases-AARON_JUDGE_1_MLB-game-ou-under": under,
      },
    });

    expect(parseSgoProps(event)).toEqual([
      expect.objectContaining({ overPrice: -125, underPrice: 105 }),
    ]);
  });

  it("skips a preferred book whose lines disagree between sides and uses the next usable book", () => {
    const odd = propOdd("batting_homeRuns", "AARON_JUDGE_1_MLB", "over");
    odd.byBookmaker = {
      fanduel: bookLine("-150", "0.5"),
      betmgm: bookLine("-135", "0.5"),
    };
    const under = propOdd("batting_homeRuns", "AARON_JUDGE_1_MLB", "under");
    under.byBookmaker = {
      // FanDuel's under sits on a different line — an unusable pairing.
      fanduel: bookLine("+120", "1.5"),
      betmgm: bookLine("+115", "0.5"),
    };
    const event = sgoEvent({
      odds: {
        "batting_homeRuns-AARON_JUDGE_1_MLB-game-ou-over": odd,
        "batting_homeRuns-AARON_JUDGE_1_MLB-game-ou-under": under,
      },
    });

    expect(parseSgoProps(event)).toEqual([
      expect.objectContaining({ overPrice: -135, underPrice: 115, line: 0.5 }),
    ]);
  });

  it("ignores unavailable bookmaker quotes", () => {
    const odd = propOdd("batting_basesOnBalls", "AARON_JUDGE_1_MLB", "over");
    odd.byBookmaker = { fanduel: bookLine("-120", "0.5", false), caesars: bookLine("-118", "0.5") };
    const under = propOdd("batting_basesOnBalls", "AARON_JUDGE_1_MLB", "under");
    under.byBookmaker = { fanduel: bookLine("+100", "0.5", false), caesars: bookLine("+102", "0.5") };
    const event = sgoEvent({
      odds: {
        "batting_basesOnBalls-AARON_JUDGE_1_MLB-game-ou-over": odd,
        "batting_basesOnBalls-AARON_JUDGE_1_MLB-game-ou-under": under,
      },
    });

    expect(parseSgoProps(event)).toEqual([
      expect.objectContaining({ overPrice: -118, underPrice: 102 }),
    ]);
  });

  it("drops a pair when no book posts a matched line on both sides", () => {
    const odd = propOdd("batting_RBI", "AARON_JUDGE_1_MLB", "over");
    odd.byBookmaker = { fanduel: bookLine("-130", "0.5") };
    const under = propOdd("batting_RBI", "AARON_JUDGE_1_MLB", "under");
    under.byBookmaker = { fanduel: bookLine("+110", "1.5") };
    const event = sgoEvent({
      odds: {
        "batting_RBI-AARON_JUDGE_1_MLB-game-ou-over": odd,
        "batting_RBI-AARON_JUDGE_1_MLB-game-ou-under": under,
      },
    });

    expect(parseSgoProps(event)).toEqual([]);
  });

  it("ignores untracked stats, yes/no markets, non-game periods, and team-level entities", () => {
    const yesOdd = {
      ...propOdd("batting_homeRuns", "AARON_JUDGE_1_MLB", "over"),
      betTypeID: "yn",
      sideID: "yes",
    };
    const event = sgoEvent({
      odds: {
        "batting_singles-AARON_JUDGE_1_MLB-game-ou-over": propOdd(
          "batting_singles",
          "AARON_JUDGE_1_MLB",
          "over",
        ),
        "batting_homeRuns-AARON_JUDGE_1_MLB-game-yn-yes": yesOdd,
        "batting_hits-all-game-ou-over": propOdd("batting_hits", "all", "over"),
        "points-all-game-ou-over": propOdd("points", "all", "over"),
      },
    });

    expect(parseSgoProps(event)).toEqual([]);
  });
});

describe("getSgoPlayerProps", () => {
  it("returns [] without fetching when the key is unset", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    expect(await getSgoPlayerProps("sgo-evt-1")).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("parses props for the requested event off the board", async () => {
    vi.stubEnv("SPORTSGAMEODDS_API_KEY", "test-key");
    const odd = (side: "over" | "under") => ({
      oddID: `batting_hits-AARON_JUDGE_1_MLB-game-ou-${side}`,
      statID: "batting_hits",
      playerID: "AARON_JUDGE_1_MLB",
      periodID: "game",
      betTypeID: "ou",
      sideID: side,
      byBookmaker: { fanduel: bookLine(side === "over" ? "-130" : "+110", "0.5") },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: [
            sgoEvent({
              players: { AARON_JUDGE_1_MLB: { name: "Aaron Judge" } },
              odds: {
                "batting_hits-AARON_JUDGE_1_MLB-game-ou-over": odd("over"),
                "batting_hits-AARON_JUDGE_1_MLB-game-ou-under": odd("under"),
              },
            }),
            sgoEvent({ eventID: "sgo-other" }),
          ],
        }),
      }),
    );

    expect(await getSgoPlayerProps("sgo-evt-1")).toEqual([
      {
        marketKey: "batter_hits",
        playerName: "Aaron Judge",
        line: 0.5,
        overPrice: -130,
        underPrice: 110,
      },
    ]);
  });

  it("returns [] when the event id is not on the board", async () => {
    vi.stubEnv("SPORTSGAMEODDS_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: [sgoEvent()] }),
      }),
    );

    expect(await getSgoPlayerProps("sgo-missing")).toEqual([]);
  });
});
