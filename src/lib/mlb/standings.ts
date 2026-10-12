/** Regular-season standings, grouped by division. */

import { mlbFetch, TTL } from "./client";
import type { DivisionStandings, StandingsRow, TeamRef } from "./types";

// --- Raw API shapes (only the fields we read) --------------------------------

interface RawTeamRecord {
  team: { id: number; name: string; abbreviation?: string };
  wins: number;
  losses: number;
  winningPercentage: string;
  gamesBack: string;
  runDifferential?: number;
  clinchIndicator?: string;
  streak?: { streakCode: string };
  divisionRank?: string;
}

interface RawDivisionRecord {
  league: { id: number };
  division: { id: number; name?: string; abbreviation?: string; nameShort?: string };
  teamRecords: RawTeamRecord[];
}

interface RawStandingsResponse {
  records?: RawDivisionRecord[];
}

// --- Mapping helpers ---------------------------------------------------------

/** Division-id fallback names, used when the API omits `division.name`. */
const DIVISION_NAMES: Record<number, string> = {
  200: "AL West",
  201: "AL East",
  202: "AL Central",
  203: "NL West",
  204: "NL East",
  205: "NL Central",
};

/** Display order: AL East, AL Central, AL West, NL East, NL Central, NL West. */
const DIVISION_ORDER = [201, 202, 200, 204, 205, 203];

function mapTeamRef(t: RawTeamRecord["team"]): TeamRef {
  return { id: t.id, name: t.name, abbreviation: t.abbreviation };
}

function mapTeamRecord(t: RawTeamRecord): StandingsRow {
  return {
    team: mapTeamRef(t.team),
    wins: t.wins,
    losses: t.losses,
    pct: t.winningPercentage,
    gamesBack: t.gamesBack,
    runDifferential: t.runDifferential,
    clinch: t.clinchIndicator,
    streak: t.streak?.streakCode,
    divisionRank: t.divisionRank != null ? Number(t.divisionRank) : undefined,
  };
}

// --- Public API --------------------------------------------------------------

/**
 * Every field the standings reader touches. `teamRecords` and its own fields
 * carry the bulk: the unfiltered response is ~110 KB, the filtered one ~39 KB.
 */
const STANDINGS_FIELDS = [
  "records", "league", "division", "teamRecords", "team", "id", "name",
  "abbreviation", "wins", "losses", "winningPercentage", "gamesBack",
  "runDifferential", "clinchIndicator", "streak", "streakCode", "divisionRank",
].join(",");

/**
 * Regular-season standings for both leagues, one entry per division, ordered
 * AL East, AL Central, AL West, NL East, NL Central, NL West. Teams within a
 * division are ordered by division rank.
 */
export async function getStandings(season: number): Promise<DivisionStandings[]> {
  const data = await mlbFetch<RawStandingsResponse>(
    "/api/v1/standings",
    {
      leagueId: "103,104",
      season,
      standingsTypes: "regularSeason",
      hydrate: "team,division,league",
      fields: STANDINGS_FIELDS,
    },
    TTL.roster,
  );

  const divisions = (data.records ?? []).map((rec): DivisionStandings => {
    const league: "AL" | "NL" = rec.league.id === 103 ? "AL" : "NL";
    const name = rec.division.name ?? DIVISION_NAMES[rec.division.id] ?? `${league} Division`;
    const teams = [...rec.teamRecords]
      .map(mapTeamRecord)
      .sort((a, b) => (a.divisionRank ?? 0) - (b.divisionRank ?? 0));
    return { divisionId: rec.division.id, name, league, teams };
  });

  divisions.sort(
    (a, b) => DIVISION_ORDER.indexOf(a.divisionId) - DIVISION_ORDER.indexOf(b.divisionId),
  );
  return divisions;
}
