import { describe, it, expect, vi, afterEach } from "vitest";
import { getStandings } from "../standings";

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

function teamRecord(
  id: number,
  name: string,
  wins: number,
  losses: number,
  divisionRank: string,
  extra: Partial<{
    gamesBack: string;
    runDifferential: number;
    clinchIndicator: string;
    streak: { streakCode: string };
  }> = {},
) {
  return {
    team: { id, name, abbreviation: name.slice(0, 3).toUpperCase() },
    wins,
    losses,
    winningPercentage: (wins / (wins + losses)).toFixed(3).replace(/^0/, ""),
    gamesBack: extra.gamesBack ?? "-",
    divisionRank,
    runDifferential: extra.runDifferential,
    clinchIndicator: extra.clinchIndicator,
    streak: extra.streak ?? { streakCode: "W1" },
  };
}

describe("getStandings", () => {
  it("maps team records, falls back division names, and orders divisions", async () => {
    mockFetchOnce({
      records: [
        {
          league: { id: 104 },
          division: { id: 203 }, // NL West — no name, exercises the fallback map
          teamRecords: [
            teamRecord(137, "San Francisco Giants", 80, 82, "2"),
            teamRecord(119, "Los Angeles Dodgers", 98, 64, "1", {
              runDifferential: 210,
              clinchIndicator: "z",
            }),
          ],
        },
        {
          league: { id: 103 },
          division: { id: 200 }, // AL West — no name either
          teamRecords: [teamRecord(136, "Seattle Mariners", 90, 72, "1")],
        },
        {
          league: { id: 104 },
          division: { id: 205 }, // NL Central
          teamRecords: [teamRecord(158, "Milwaukee Brewers", 92, 70, "1")],
        },
        {
          league: { id: 103 },
          division: { id: 201, name: "American League East" }, // has a real name
          teamRecords: [teamRecord(147, "New York Yankees", 94, 68, "1")],
        },
        {
          league: { id: 104 },
          division: { id: 204 }, // NL East
          teamRecords: [teamRecord(121, "New York Mets", 89, 73, "1")],
        },
        {
          league: { id: 103 },
          division: { id: 202 }, // AL Central
          teamRecords: [teamRecord(114, "Cleveland Guardians", 88, 74, "1")],
        },
      ],
    });

    const standings = await getStandings(2025);

    expect(standings.map((d) => d.name)).toEqual([
      "American League East",
      "AL Central",
      "AL West",
      "NL East",
      "NL Central",
      "NL West",
    ]);
    expect(standings.map((d) => d.league)).toEqual(["AL", "AL", "AL", "NL", "NL", "NL"]);
    expect(standings.map((d) => d.divisionId)).toEqual([201, 202, 200, 204, 205, 203]);

    const nlWest = standings.find((d) => d.divisionId === 203)!;
    // Sorted by divisionRank, not by input order.
    expect(nlWest.teams.map((t) => t.team.name)).toEqual([
      "Los Angeles Dodgers",
      "San Francisco Giants",
    ]);
    expect(nlWest.teams[0]).toEqual({
      team: { id: 119, name: "Los Angeles Dodgers", abbreviation: "LOS" },
      wins: 98,
      losses: 64,
      pct: ".605",
      gamesBack: "-",
      runDifferential: 210,
      clinch: "z",
      streak: "W1",
      divisionRank: 1,
    });
  });

  it("passes revalidate to fetch via the next option", async () => {
    mockFetchOnce({ records: [] });
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    await getStandings(2025);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.next).toEqual({ revalidate: 24 * 60 * 60, tags: [] });
  });

  it("returns an empty list for a missing records payload", async () => {
    mockFetchOnce({});
    expect(await getStandings(2025)).toEqual([]);
  });
});
