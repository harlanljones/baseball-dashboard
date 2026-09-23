import { describe, it, expect, vi, afterEach } from "vitest";
import { MlbApiError } from "../client";
import { getGameTeams } from "../schedule";

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

describe("getGameTeams", () => {
  it("reads one game's teams and start time from its schedule entry", async () => {
    const fetchMock = mockFetch(() => ({
      dates: [
        {
          date: "2026-09-23",
          games: [
            {
              gamePk: 824710,
              gameDate: "2026-09-23T23:05:00Z",
              status: { abstractGameState: "Preview" },
              teams: { away: { team: BOS }, home: { team: NYY } },
            },
          ],
        },
      ],
    }));

    expect(await getGameTeams(824710)).toEqual({
      away: BOS,
      home: NYY,
      gameDate: "2026-09-23T23:05:00Z",
    });
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.pathname).toBe("/api/v1/schedule");
    expect(url.searchParams.get("gamePk")).toBe("824710");
    expect(url.searchParams.get("hydrate")).toBe("team");
  });

  it("throws a 404 for an unknown game", async () => {
    mockFetch(() => ({ dates: [] }));

    await expect(getGameTeams(1)).rejects.toMatchObject({
      name: "MlbApiError",
      status: 404,
    });
    await expect(getGameTeams(1)).rejects.toBeInstanceOf(MlbApiError);
  });
});
