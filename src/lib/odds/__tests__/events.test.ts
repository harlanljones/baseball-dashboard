import { describe, it, expect, vi, afterEach } from "vitest";
import { findTheOddsApiEvent, resolveOddsEvent } from "../events";
import { resetOddsKeyPool } from "../client";
import { resetSgoKeyPool } from "../sgo";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  resetOddsKeyPool();
  resetSgoKeyPool();
});

function sgoJson(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    url: "https://api.sportsgameodds.com/v2/events",
  };
}

function oddsApiJson(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    url: "https://api.the-odds-api.com/v4/sports/baseball_mlb/events",
  };
}

const SGO_MATCH = {
  eventID: "sgo-evt-1",
  teams: {
    away: { names: { long: "New York Yankees" } },
    home: { names: { long: "Boston Red Sox" } },
  },
  status: { startsAt: "2026-07-22T23:05:00Z" },
};

const ODDS_API_MATCH = [
  {
    id: "toa-evt-1",
    commence_time: "2026-07-22T23:05:00Z",
    home_team: "Boston Red Sox",
    away_team: "New York Yankees",
  },
];

describe("findTheOddsApiEvent", () => {
  it("returns null without fetching when ODDS_API_KEY is unset", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const id = await findTheOddsApiEvent(
      "New York Yankees",
      "Boston Red Sox",
      "2026-07-22T23:05:00Z",
    );
    expect(id).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("matches by team name pair and returns the event id", async () => {
    vi.stubEnv("ODDS_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(oddsApiJson(ODDS_API_MATCH)));

    const id = await findTheOddsApiEvent(
      "New York Yankees",
      "Boston Red Sox",
      "2026-07-22T23:05:00Z",
    );
    expect(id).toBe("toa-evt-1");
  });

  it("picks the event with the closer commence_time for a doubleheader", async () => {
    vi.stubEnv("ODDS_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        oddsApiJson([
          {
            id: "toa-early",
            commence_time: "2026-07-22T17:05:00Z",
            home_team: "Boston Red Sox",
            away_team: "New York Yankees",
          },
          {
            id: "toa-late",
            commence_time: "2026-07-22T23:05:00Z",
            home_team: "Boston Red Sox",
            away_team: "New York Yankees",
          },
        ]),
      ),
    );

    const id = await findTheOddsApiEvent(
      "New York Yankees",
      "Boston Red Sox",
      "2026-07-22T22:45:00Z",
    );
    expect(id).toBe("toa-late");
  });

  it("returns null when no event matches the team pair", async () => {
    vi.stubEnv("ODDS_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        oddsApiJson([
          {
            id: "toa-other",
            commence_time: "2026-07-22T23:05:00Z",
            home_team: "Chicago Cubs",
            away_team: "St. Louis Cardinals",
          },
        ]),
      ),
    );

    const id = await findTheOddsApiEvent(
      "New York Yankees",
      "Boston Red Sox",
      "2026-07-22T23:05:00Z",
    );
    expect(id).toBeNull();
  });

  it("returns null when the fetch fails", async () => {
    vi.stubEnv("ODDS_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }),
    );

    const id = await findTheOddsApiEvent(
      "New York Yankees",
      "Boston Red Sox",
      "2026-07-22T23:05:00Z",
    );
    expect(id).toBeNull();
  });
});

describe("resolveOddsEvent", () => {
  it("returns null without fetching when neither key is set", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const resolved = await resolveOddsEvent(
      "New York Yankees",
      "Boston Red Sox",
      "2026-07-22T23:05:00Z",
    );
    expect(resolved).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("resolves through SportsGameOdds first when its key is set", async () => {
    vi.stubEnv("SPORTSGAMEODDS_API_KEY", "sgo-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(sgoJson({ data: [SGO_MATCH] })));

    const resolved = await resolveOddsEvent(
      "New York Yankees",
      "Boston Red Sox",
      "2026-07-22T23:05:00Z",
    );
    expect(resolved).toEqual({ provider: "sgo", eventId: "sgo-evt-1" });
  });

  it("falls back to The Odds API when SportsGameOdds has no matching event", async () => {
    vi.stubEnv("SPORTSGAMEODDS_API_KEY", "sgo-key");
    vi.stubEnv("ODDS_API_KEY", "toa-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        String(url).includes("sportsgameodds.com")
          ? sgoJson({ data: [] })
          : oddsApiJson(ODDS_API_MATCH),
      ),
    );

    const resolved = await resolveOddsEvent(
      "New York Yankees",
      "Boston Red Sox",
      "2026-07-22T23:05:00Z",
    );
    expect(resolved).toEqual({ provider: "the-odds-api", eventId: "toa-evt-1" });
  });

  it("falls back to The Odds API when SportsGameOdds fails", async () => {
    vi.stubEnv("SPORTSGAMEODDS_API_KEY", "sgo-key");
    vi.stubEnv("ODDS_API_KEY", "toa-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("sportsgameodds.com")) {
          return { ok: false, status: 500, json: async () => ({}) };
        }
        return oddsApiJson(ODDS_API_MATCH);
      }),
    );

    const resolved = await resolveOddsEvent(
      "New York Yankees",
      "Boston Red Sox",
      "2026-07-22T23:05:00Z",
    );
    expect(resolved).toEqual({ provider: "the-odds-api", eventId: "toa-evt-1" });
  });

  it("returns null when SportsGameOdds fails and no fallback key is set", async () => {
    vi.stubEnv("SPORTSGAMEODDS_API_KEY", "sgo-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }),
    );

    const resolved = await resolveOddsEvent(
      "New York Yankees",
      "Boston Red Sox",
      "2026-07-22T23:05:00Z",
    );
    expect(resolved).toBeNull();
  });
});
