import { describe, it, expect, vi, afterEach } from "vitest";
import { findOddsEvent } from "../events";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function mockEvents(events: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => events,
    }),
  );
}

describe("findOddsEvent", () => {
  it("returns null without fetching when ODDS_API_KEY is unset", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const id = await findOddsEvent(
      "New York Yankees",
      "Boston Red Sox",
      "2026-07-22T23:05:00Z",
    );
    expect(id).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("matches by team name pair and returns the event id", async () => {
    vi.stubEnv("ODDS_API_KEY", "test-key");
    mockEvents([
      {
        id: "evt-1",
        commence_time: "2026-07-22T23:05:00Z",
        home_team: "Boston Red Sox",
        away_team: "New York Yankees",
      },
      {
        id: "evt-2",
        commence_time: "2026-07-22T23:05:00Z",
        home_team: "Chicago Cubs",
        away_team: "St. Louis Cardinals",
      },
    ]);

    const id = await findOddsEvent(
      "New York Yankees",
      "Boston Red Sox",
      "2026-07-22T23:05:00Z",
    );
    expect(id).toBe("evt-1");
  });

  it("picks the event with the closer commence_time for a doubleheader", async () => {
    vi.stubEnv("ODDS_API_KEY", "test-key");
    mockEvents([
      {
        id: "evt-early",
        commence_time: "2026-07-22T17:05:00Z",
        home_team: "Boston Red Sox",
        away_team: "New York Yankees",
      },
      {
        id: "evt-late",
        commence_time: "2026-07-22T23:05:00Z",
        home_team: "Boston Red Sox",
        away_team: "New York Yankees",
      },
    ]);

    const id = await findOddsEvent(
      "New York Yankees",
      "Boston Red Sox",
      "2026-07-22T22:45:00Z",
    );
    expect(id).toBe("evt-late");
  });

  it("returns null when no event matches the team pair", async () => {
    vi.stubEnv("ODDS_API_KEY", "test-key");
    mockEvents([
      {
        id: "evt-1",
        commence_time: "2026-07-22T23:05:00Z",
        home_team: "Chicago Cubs",
        away_team: "St. Louis Cardinals",
      },
    ]);

    const id = await findOddsEvent(
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

    const id = await findOddsEvent(
      "New York Yankees",
      "Boston Red Sox",
      "2026-07-22T23:05:00Z",
    );
    expect(id).toBeNull();
  });
});
