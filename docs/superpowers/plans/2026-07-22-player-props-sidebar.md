# Player Props Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a sticky sidebar to the game detail page showing sportsbook player props (from The Odds API), each highlighted over/under based on the player's season stats and, for power markets, the ballpark weather report.

**Architecture:** A new `src/lib/odds/` module fetches and scores props independently of the MLB Stats API client; two new stat-fetchers are added to the existing `src/lib/mlb/players.ts`; a server-component data-fetching section (`PropsSidebarSection.tsx`) assembles everything and hands off to a presentational component (`PropsSidebar.tsx`); the game page's layout becomes a two-column grid to host it.

**Tech Stack:** Next.js 16 (App Router, React 19 Server Components), TypeScript, Tailwind CSS v4. Adds Vitest as the project's first test runner (none exists yet).

## Global Constraints

- No `pd.merge`-style leakage concerns apply here (this is a Next.js app, not the ML pipeline) — ignore any Python/ML tooling references in unrelated config files.
- All external requests go through a thin fetch wrapper with a Next.js `revalidate` TTL, mirroring `src/lib/mlb/client.ts`'s `mlbFetch` pattern exactly.
- The sidebar must never throw or block page render: every external call is wrapped in a `safe()` helper (local `try/catch` returning `null`), matching every existing async section in `src/app/games/[gamePk]/page.tsx`.
- Sidebar renders only when `feed.state === "Preview"` and the game is not disrupted (postponed/suspended/cancelled).
- Weather nudges apply **only** to `batter_home_runs` and `batter_total_bases` markets — never to strikeout, outs, hits, RBI, or walk props.
- Markets covered: `pitcher_strikeouts`, `pitcher_outs`, `batter_hits`, `batter_total_bases`, `batter_home_runs`, `batter_rbis`, `batter_walks`.
- Color convention: reuse `src/lib/statColor.ts`'s `GOOD_CLASS`/`BAD_CLASS` (red=good/over, blue=bad/under) for the "strong" tiers; "lean" tiers use the same hue at lower opacity.

---

## Task 1: Test runner + odds API client scaffold

**Files:**
- Create: `vitest.config.ts`
- Create: `.env.example`
- Modify: `package.json`
- Create: `src/lib/odds/client.ts`
- Create: `src/lib/odds/types.ts`
- Test: `src/lib/odds/__tests__/client.test.ts`

**Interfaces:**
- Produces: `oddsFetch<T>(path: string, params?: Params, revalidate?: number): Promise<T>`, `getOddsApiKey(): string | null`, `OddsApiError` class, `TTL.odds` (number, seconds) — all from `src/lib/odds/client.ts`.
- Produces (types, no runtime behavior): `PropMarketKey`, `PlayerProp`, `PropTier`, `ScoredProp` from `src/lib/odds/types.ts`.

This repo has no test runner installed at all (`package.json` has no `test` script, and the one existing `__tests__` directory is empty). This task installs Vitest and proves it works before any other task depends on it.

- [ ] **Step 1: Install Vitest**

Run: `npm install --save-dev vitest`
Expected: `package.json`'s `devDependencies` gains a `vitest` entry; `package-lock.json` updates.

- [ ] **Step 2: Add the Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
  },
});
```

- [ ] **Step 3: Add the `test` script**

Modify `package.json`'s `scripts` block:

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run"
  },
```

- [ ] **Step 4: Add `.env.example`**

Create `.env.example`:

```
# The Odds API (https://the-odds-api.com) — free tier. Powers the player
# props sidebar on game detail pages. Leave unset to hide the sidebar
# (it fails closed, never blocks the rest of the page).
ODDS_API_KEY=
```

- [ ] **Step 5: Write the odds domain types**

Create `src/lib/odds/types.ts`:

```ts
import type { PlayerRef } from "@/lib/mlb/types";

/** The 7 player-prop markets this sidebar covers. */
export type PropMarketKey =
  | "pitcher_strikeouts"
  | "pitcher_outs"
  | "batter_hits"
  | "batter_total_bases"
  | "batter_home_runs"
  | "batter_rbis"
  | "batter_walks";

/** One sportsbook's Over/Under line for one player in one market. */
export interface PlayerProp {
  marketKey: PropMarketKey;
  /** Player name exactly as the Odds API returns it — matched against our roster by `matchPlayerName`. */
  playerName: string;
  line: number;
  overPrice: number;
  underPrice: number;
}

export type PropTier =
  | "strong-over"
  | "lean-over"
  | "neutral"
  | "lean-under"
  | "strong-under";

/** A `PlayerProp` resolved to our own `PlayerRef` and scored against season stats (+ weather, for HR/TB markets). */
export interface ScoredProp {
  player: PlayerRef;
  marketKey: PropMarketKey;
  line: number;
  overPrice: number;
  underPrice: number;
  tier: PropTier;
  /** Human-readable basis for the tier, e.g. "Season avg: 7.2 (line 6.5)" or "No stats available". */
  statLabel: string;
}
```

- [ ] **Step 6: Write the failing test for the client**

Create `src/lib/odds/__tests__/client.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { getOddsApiKey, oddsFetch, OddsApiError } from "../client";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("getOddsApiKey", () => {
  it("returns null when ODDS_API_KEY is unset", () => {
    expect(getOddsApiKey()).toBeNull();
  });

  it("returns the key when set", () => {
    vi.stubEnv("ODDS_API_KEY", "abc123");
    expect(getOddsApiKey()).toBe("abc123");
  });
});

describe("oddsFetch", () => {
  it("throws OddsApiError without making a request when the key is unset", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await expect(oddsFetch("/v4/sports/baseball_mlb/events")).rejects.toThrow(
      OddsApiError,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("appends the API key and params, and decodes JSON on success", async () => {
    vi.stubEnv("ODDS_API_KEY", "abc123");
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ hello: "world" }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const result = await oddsFetch<{ hello: string }>("/v4/sports/baseball_mlb/events", {
      regions: "us",
    });

    expect(result).toEqual({ hello: "world" });
    const calledUrl = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(calledUrl.searchParams.get("apiKey")).toBe("abc123");
    expect(calledUrl.searchParams.get("regions")).toBe("us");
  });

  it("throws OddsApiError on a non-2xx response", async () => {
    vi.stubEnv("ODDS_API_KEY", "abc123");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({}) }),
    );

    await expect(oddsFetch("/v4/sports/baseball_mlb/events")).rejects.toThrow(
      OddsApiError,
    );
  });
});
```

- [ ] **Step 7: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `src/lib/odds/client.ts` does not exist yet (`Cannot find module '../client'`).

- [ ] **Step 8: Implement the client**

Create `src/lib/odds/client.ts`:

```ts
/**
 * Thin client for The Odds API (api.the-odds-api.com — free tier, requires a
 * key). Mirrors `src/lib/mlb/client.ts`'s `mlbFetch`: Next.js fetch caching
 * with a per-call `revalidate` TTL, no persistence of our own.
 */

const BASE = "https://api.the-odds-api.com";

/** Cache TTLs in seconds. Odds lines move over hours, not seconds — a long
 * TTL keeps free-tier request usage low without staling out pre-game lines. */
export const TTL = {
  odds: 60 * 60,
} as const;

/** Thrown when the Odds API responds with a non-2xx status, or when no API key is configured. */
export class OddsApiError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
    message?: string,
  ) {
    super(message ?? `Odds API request failed (${status}) for ${url}`);
    this.name = "OddsApiError";
  }
}

/** The configured Odds API key, or `null` if unset — callers should fail closed on `null`. */
export function getOddsApiKey(): string | null {
  return process.env.ODDS_API_KEY || null;
}

type Params = Record<string, string | number | boolean | undefined | null>;

/**
 * Fetch and JSON-decode an Odds API endpoint.
 *
 * @param path        Path beginning with `/v4/...`.
 * @param params      Query params; `undefined`/`null`/`""` are dropped.
 * @param revalidate  Cache TTL in seconds (see {@link TTL}). Defaults to `TTL.odds`.
 */
export async function oddsFetch<T>(
  path: string,
  params: Params = {},
  revalidate: number = TTL.odds,
): Promise<T> {
  const key = getOddsApiKey();
  if (!key) {
    throw new OddsApiError(0, path, "ODDS_API_KEY is not set");
  }

  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("apiKey", key);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") {
      url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    next: { revalidate },
  });

  if (!res.ok) {
    throw new OddsApiError(res.status, url.toString());
  }
  return (await res.json()) as T;
}
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `npm test`
Expected: PASS (7 tests: 2 for `getOddsApiKey`, 3 for `oddsFetch`, plus the file's suite wrapper).

- [ ] **Step 10: Commit**

```bash
git.exe -C 'C:/Users/harlan/GitHub/baseball-dashboard' add vitest.config.ts .env.example package.json package-lock.json src/lib/odds/client.ts src/lib/odds/types.ts src/lib/odds/__tests__/client.test.ts
git.exe -C 'C:/Users/harlan/GitHub/baseball-dashboard' commit -m "feat: add odds API client scaffold and Vitest test runner"
```

---

## Task 2: Player name matching

**Files:**
- Create: `src/lib/odds/playerMatch.ts`
- Test: `src/lib/odds/__tests__/playerMatch.test.ts`

**Interfaces:**
- Consumes: `PlayerRef` (`{ id: number; fullName: string }`) from `@/lib/mlb/types`.
- Produces: `normalizePlayerName(name: string): string`, `matchPlayerName(oddsName: string, roster: PlayerRef[]): PlayerRef | null`.

The Odds API returns player names as plain strings, not MLB IDs. This module normalizes both sides (accents, initials, suffixes) and matches by exact normalized name — no fuzzy matching, so an unmatched name is dropped rather than risking a wrong attribution.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/odds/__tests__/playerMatch.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { normalizePlayerName, matchPlayerName } from "../playerMatch";
import type { PlayerRef } from "@/lib/mlb/types";

describe("normalizePlayerName", () => {
  it("strips accents", () => {
    expect(normalizePlayerName("Ronald Acuña Jr.")).toBe("ronald acuna");
  });

  it("strips periods from initials without splitting them", () => {
    expect(normalizePlayerName("J.D. Martinez")).toBe("jd martinez");
    expect(normalizePlayerName("JD Martinez")).toBe("jd martinez");
  });

  it("strips Jr./Sr./numeral suffixes", () => {
    expect(normalizePlayerName("Ronald Acuna Jr.")).toBe("ronald acuna");
    expect(normalizePlayerName("Fernando Tatis Jr")).toBe("fernando tatis");
    expect(normalizePlayerName("Vladimir Guerrero Jr.")).toBe(
      "vladimir guerrero",
    );
  });

  it("treats hyphenated names as space-separated", () => {
    expect(normalizePlayerName("Jean-Segura")).toBe("jean segura");
  });

  it("is case-insensitive and collapses whitespace", () => {
    expect(normalizePlayerName("  Aaron   JUDGE ")).toBe("aaron judge");
  });
});

describe("matchPlayerName", () => {
  const roster: PlayerRef[] = [
    { id: 1, fullName: "Ronald Acuna Jr." },
    { id: 2, fullName: "JD Martinez" },
    { id: 3, fullName: "Aaron Judge" },
  ];

  it("matches an exact normalized name", () => {
    expect(matchPlayerName("Aaron Judge", roster)).toEqual(roster[2]);
  });

  it("matches across accent and suffix differences", () => {
    expect(matchPlayerName("Ronald Acuña Jr.", roster)).toEqual(roster[0]);
  });

  it("matches across initial-punctuation differences", () => {
    expect(matchPlayerName("J.D. Martinez", roster)).toEqual(roster[1]);
  });

  it("returns null when no roster entry matches", () => {
    expect(matchPlayerName("Mike Trout", roster)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '../playerMatch'`.

- [ ] **Step 3: Implement `playerMatch.ts`**

Create `src/lib/odds/playerMatch.ts`:

```ts
import type { PlayerRef } from "@/lib/mlb/types";

/**
 * Normalizes a player name for cross-source matching: strips accents,
 * periods (so "J.D." and "JD" agree), hyphens (treated as a space so
 * "Jean-Segura" agrees with "Jean Segura"), and Jr./Sr./numeral suffixes,
 * then lowercases and collapses whitespace.
 */
export function normalizePlayerName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining accent marks
    .replace(/\./g, "") // strip periods before hyphen handling, so "J.D." -> "JD"
    .replace(/-/g, " ")
    .replace(/\b(jr|sr|ii|iii|iv)\b\.?/gi, "")
    .replace(/[^a-zA-Z\s]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Finds the roster entry whose name normalizes to the same string as
 * `oddsName`. No fuzzy/Levenshtein matching — an unmatched name returns
 * `null` rather than risking a wrong player attribution.
 */
export function matchPlayerName(
  oddsName: string,
  roster: PlayerRef[],
): PlayerRef | null {
  const target = normalizePlayerName(oddsName);
  return roster.find((p) => normalizePlayerName(p.fullName) === target) ?? null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git.exe -C 'C:/Users/harlan/GitHub/baseball-dashboard' add src/lib/odds/playerMatch.ts src/lib/odds/__tests__/playerMatch.test.ts
git.exe -C 'C:/Users/harlan/GitHub/baseball-dashboard' commit -m "feat: add player name matching for odds API integration"
```

---

## Task 3: Prop-stat fetchers in `players.ts`

**Files:**
- Modify: `src/lib/mlb/players.ts`
- Test: `src/lib/mlb/__tests__/playerPropStats.test.ts`

**Interfaces:**
- Consumes: `mlbFetch`, `TTL` from `./client` (already imported at the top of `players.ts`); private helpers `pickGroup`, `n`, `s` already defined in `players.ts`.
- Produces: `ipToFloat(ip: string): number`, `getPitcherPropStats(personId: number, season: number): Promise<PitcherPropStats | null>`, `getSeasonHittingBasic(personId: number, season: number): Promise<SeasonHittingBasic | null>`, and the interfaces `PitcherPropStats { k9: number; outsPerStart: number; ip: number; gamesStarted: number }` and `SeasonHittingBasic { avg: string; obp: string; slg: string; h: number; hr: number; rbi: number; bb: number; totalBases: number; pa: number; games: number }`.

These are dedicated prop-scoring fetchers — kept separate from `getSaberPitching`/`getSaberHitting` because prop scoring needs raw counting stats (strikeouts, innings, hits, total bases) that those functions don't expose, and K/9 can't be reconstructed from the existing `SaberPitching.kPct` (a percent of batters faced, not innings) without also fetching batters-faced.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/mlb/__tests__/playerPropStats.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { getPitcherPropStats, getSeasonHittingBasic, ipToFloat } from "../players";

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

describe("ipToFloat", () => {
  it("converts whole innings", () => {
    expect(ipToFloat("123.0")).toBe(123);
  });

  it("converts one-third innings", () => {
    expect(ipToFloat("123.1")).toBeCloseTo(123.333, 2);
  });

  it("converts two-thirds innings", () => {
    expect(ipToFloat("123.2")).toBeCloseTo(123.667, 2);
  });
});

describe("getPitcherPropStats", () => {
  it("computes K/9 and outs-per-start from season totals", async () => {
    mockFetchOnce({
      stats: [
        {
          type: { displayName: "season" },
          splits: [
            { stat: { inningsPitched: "180.0", strikeOuts: 200, gamesStarted: 30 } },
          ],
        },
      ],
    });

    const result = await getPitcherPropStats(12345, 2026);
    expect(result).not.toBeNull();
    expect(result!.k9).toBeCloseTo(10, 5); // 200 * 9 / 180
    expect(result!.outsPerStart).toBeCloseTo(18, 5); // 180 * 3 / 30
    expect(result!.gamesStarted).toBe(30);
  });

  it("returns null when the pitcher has no innings pitched this season", async () => {
    mockFetchOnce({
      stats: [
        {
          type: { displayName: "season" },
          splits: [{ stat: { inningsPitched: "0.0", strikeOuts: 0, gamesStarted: 0 } }],
        },
      ],
    });

    expect(await getPitcherPropStats(12345, 2026)).toBeNull();
  });

  it("returns null when the API has no season group for this player", async () => {
    mockFetchOnce({ stats: [] });
    expect(await getPitcherPropStats(12345, 2026)).toBeNull();
  });
});

describe("getSeasonHittingBasic", () => {
  it("parses season hitting totals", async () => {
    mockFetchOnce({
      stats: [
        {
          type: { displayName: "season" },
          splits: [
            {
              stat: {
                avg: ".280",
                obp: ".350",
                slg: ".480",
                hits: 150,
                homeRuns: 25,
                rbi: 80,
                baseOnBalls: 55,
                totalBases: 260,
                plateAppearances: 600,
                gamesPlayed: 150,
              },
            },
          ],
        },
      ],
    });

    expect(await getSeasonHittingBasic(67890, 2026)).toEqual({
      avg: ".280",
      obp: ".350",
      slg: ".480",
      h: 150,
      hr: 25,
      rbi: 80,
      bb: 55,
      totalBases: 260,
      pa: 600,
      games: 150,
    });
  });

  it("returns null when the API has no season group for this player", async () => {
    mockFetchOnce({ stats: [] });
    expect(await getSeasonHittingBasic(67890, 2026)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `ipToFloat`, `getPitcherPropStats`, `getSeasonHittingBasic` are not exported from `../players`.

- [ ] **Step 3: Implement the fetchers**

Modify `src/lib/mlb/players.ts` — append at the end of the file:

```ts
// --- Player-prop scoring stats ------------------------------------------------

/** Converts MLB's innings-pitched notation ("123.1" = 123⅓, "123.2" = 123⅔) to a float. */
export function ipToFloat(ip: string): number {
  const [whole, frac] = ip.split(".").map(Number);
  const fracInnings = frac === 1 ? 1 / 3 : frac === 2 ? 2 / 3 : 0;
  return (whole || 0) + fracInnings;
}

export interface PitcherPropStats {
  k9: number;
  outsPerStart: number;
  ip: number;
  gamesStarted: number;
}

/**
 * Season K/9 and outs-per-start for pitcher prop scoring. Returns `null` if
 * the player has no innings pitched this season (rookies, injured, or a
 * two-way/position player with no pitching record).
 */
export async function getPitcherPropStats(
  personId: number,
  season: number,
): Promise<PitcherPropStats | null> {
  const res = await mlbFetch<RawStatsResponse>(
    `/api/v1/people/${personId}/stats`,
    { stats: "season", group: "pitching", season },
    TTL.playerStats,
  );
  const stat = pickGroup(res, "season");
  if (!stat) return null;

  const ip = ipToFloat(s(stat.inningsPitched) ?? "0.0");
  if (ip <= 0) return null;

  const k = n(stat.strikeOuts) ?? 0;
  const gamesStarted = n(stat.gamesStarted) ?? 0;

  return {
    k9: (k * 9) / ip,
    outsPerStart: gamesStarted > 0 ? (ip * 3) / gamesStarted : 0,
    ip,
    gamesStarted,
  };
}

export interface SeasonHittingBasic {
  avg: string;
  obp: string;
  slg: string;
  h: number;
  hr: number;
  rbi: number;
  bb: number;
  totalBases: number;
  pa: number;
  games: number;
}

/** Season counting/rate stats for batter prop scoring. Returns `null` if the API has no season hitting record for this player. */
export async function getSeasonHittingBasic(
  personId: number,
  season: number,
): Promise<SeasonHittingBasic | null> {
  const res = await mlbFetch<RawStatsResponse>(
    `/api/v1/people/${personId}/stats`,
    { stats: "season", group: "hitting", season },
    TTL.playerStats,
  );
  const stat = pickGroup(res, "season");
  if (!stat) return null;

  return {
    avg: s(stat.avg) ?? "-",
    obp: s(stat.obp) ?? "-",
    slg: s(stat.slg) ?? "-",
    h: n(stat.hits) ?? 0,
    hr: n(stat.homeRuns) ?? 0,
    rbi: n(stat.rbi) ?? 0,
    bb: n(stat.baseOnBalls) ?? 0,
    totalBases: n(stat.totalBases) ?? 0,
    pa: n(stat.plateAppearances) ?? 0,
    games: n(stat.gamesPlayed) ?? 0,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git.exe -C 'C:/Users/harlan/GitHub/baseball-dashboard' add src/lib/mlb/players.ts src/lib/mlb/__tests__/playerPropStats.test.ts
git.exe -C 'C:/Users/harlan/GitHub/baseball-dashboard' commit -m "feat: add pitcher/batter season-stat fetchers for prop scoring"
```

---

## Task 4: Odds event lookup

**Files:**
- Create: `src/lib/odds/events.ts`
- Test: `src/lib/odds/__tests__/events.test.ts`

**Interfaces:**
- Consumes: `oddsFetch`, `TTL`, `getOddsApiKey` from `./client` (Task 1).
- Produces: `findOddsEvent(awayTeamName: string, homeTeamName: string, startTimeISO: string): Promise<string | null>`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/odds/__tests__/events.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '../events'`.

- [ ] **Step 3: Implement `events.ts`**

Create `src/lib/odds/events.ts`:

```ts
import { getOddsApiKey, oddsFetch, TTL } from "./client";

interface RawOddsEvent {
  id: string;
  commence_time: string;
  home_team: string;
  away_team: string;
}

function teamsMatch(oddsName: string, mlbName: string): boolean {
  const a = oddsName.trim().toLowerCase();
  const b = mlbName.trim().toLowerCase();
  return a === b || a.includes(b) || b.includes(a);
}

/**
 * Resolves an MLB game (identified by team names + start time) to the Odds
 * API's event id for that matchup, or `null` if the key is unset, the
 * request fails, or no event matches. On a doubleheader (two events for the
 * same team pair on the same day) picks whichever `commence_time` is closest
 * to `startTimeISO`.
 */
export async function findOddsEvent(
  awayTeamName: string,
  homeTeamName: string,
  startTimeISO: string,
): Promise<string | null> {
  if (!getOddsApiKey()) return null;

  let events: RawOddsEvent[];
  try {
    events = await oddsFetch<RawOddsEvent[]>(
      "/v4/sports/baseball_mlb/events",
      {},
      TTL.odds,
    );
  } catch {
    return null;
  }

  const matches = events.filter(
    (e) =>
      teamsMatch(e.home_team, homeTeamName) &&
      teamsMatch(e.away_team, awayTeamName),
  );
  if (matches.length === 0) return null;

  const startMs = new Date(startTimeISO).getTime();
  matches.sort(
    (a, b) =>
      Math.abs(new Date(a.commence_time).getTime() - startMs) -
      Math.abs(new Date(b.commence_time).getTime() - startMs),
  );
  return matches[0].id;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git.exe -C 'C:/Users/harlan/GitHub/baseball-dashboard' add src/lib/odds/events.ts src/lib/odds/__tests__/events.test.ts
git.exe -C 'C:/Users/harlan/GitHub/baseball-dashboard' commit -m "feat: resolve MLB games to Odds API event ids"
```

---

## Task 5: Player props fetch

**Files:**
- Create: `src/lib/odds/props.ts`
- Test: `src/lib/odds/__tests__/props.test.ts`

**Interfaces:**
- Consumes: `oddsFetch`, `TTL` from `./client` (Task 1); `PlayerProp`, `PropMarketKey` from `./types` (Task 1).
- Produces: `getPlayerProps(eventId: string): Promise<PlayerProp[]>`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/odds/__tests__/props.test.ts`:

```ts
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
```

Note the last test asserts `getPlayerProps` itself *rejects* on failure — callers (Task 7) are responsible for wrapping it in `safe()`, matching how every other data-fetcher in this codebase behaves (e.g. `getGameWeather`, `getHeadToHead`).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '../props'`.

- [ ] **Step 3: Implement `props.ts`**

Create `src/lib/odds/props.ts`:

```ts
import { oddsFetch, TTL } from "./client";
import type { PlayerProp, PropMarketKey } from "./types";

const PROP_MARKETS: PropMarketKey[] = [
  "pitcher_strikeouts",
  "pitcher_outs",
  "batter_hits",
  "batter_total_bases",
  "batter_home_runs",
  "batter_rbis",
  "batter_walks",
];

interface RawOutcome {
  name: string; // "Over" | "Under"
  description?: string; // player name
  price: number;
  point?: number;
}

interface RawMarket {
  key: string;
  outcomes: RawOutcome[];
}

interface RawBookmaker {
  key: string;
  markets: RawMarket[];
}

interface RawEventOdds {
  id: string;
  bookmakers?: RawBookmaker[];
}

/**
 * Fetches player-prop odds for one Odds API event across the 7 tracked
 * markets, from the first bookmaker in the response. Only outcome pairs
 * where both Over and Under exist with the same line are kept.
 */
export async function getPlayerProps(eventId: string): Promise<PlayerProp[]> {
  const res = await oddsFetch<RawEventOdds>(
    `/v4/sports/baseball_mlb/events/${eventId}/odds`,
    {
      regions: "us",
      markets: PROP_MARKETS.join(","),
      oddsFormat: "american",
    },
    TTL.odds,
  );

  const bookmaker = res.bookmakers?.[0];
  if (!bookmaker) return [];

  const props: PlayerProp[] = [];
  for (const market of bookmaker.markets) {
    if (!PROP_MARKETS.includes(market.key as PropMarketKey)) continue;

    const byPlayer = new Map<string, { over?: RawOutcome; under?: RawOutcome }>();
    for (const outcome of market.outcomes) {
      if (!outcome.description || outcome.point === undefined) continue;
      const entry = byPlayer.get(outcome.description) ?? {};
      if (outcome.name === "Over") entry.over = outcome;
      else if (outcome.name === "Under") entry.under = outcome;
      byPlayer.set(outcome.description, entry);
    }

    for (const [playerName, { over, under }] of byPlayer) {
      if (!over || !under || over.point !== under.point) continue;
      props.push({
        marketKey: market.key as PropMarketKey,
        playerName,
        line: over.point as number,
        overPrice: over.price,
        underPrice: under.price,
      });
    }
  }

  return props;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git.exe -C 'C:/Users/harlan/GitHub/baseball-dashboard' add src/lib/odds/props.ts src/lib/odds/__tests__/props.test.ts
git.exe -C 'C:/Users/harlan/GitHub/baseball-dashboard' commit -m "feat: fetch player-prop odds for an Odds API event"
```

---

## Task 6: Prop highlighting / tier scoring

**Files:**
- Create: `src/lib/odds/highlight.ts`
- Test: `src/lib/odds/__tests__/highlight.test.ts`

**Interfaces:**
- Consumes: `PlayerProp`, `PropTier`, `ScoredProp`, `PropMarketKey` from `./types` (Task 1); `PlayerRef` from `@/lib/mlb/types`; `GameWeather` from `@/lib/weather/types`.
- Produces: `PitcherStatContext { kind: "pitcher"; k9: number; outsPerStart: number; gamesStarted: number }`, `BatterStatContext { kind: "batter"; hitsPerGame: number; totalBasesPerGame: number; hrPerGame: number; rbiPerGame: number; bbPerGame: number; games: number }`, `StatContext = PitcherStatContext | BatterStatContext`, `scoreProp(prop: PlayerProp, player: PlayerRef, stats: StatContext | null, weather: GameWeather | null): ScoredProp`.

This is the core scoring logic and the most important thing to test thoroughly, since it's pure (no I/O) and directly drives what the user sees highlighted.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/odds/__tests__/highlight.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { scoreProp, type StatContext } from "../highlight";
import type { PlayerProp } from "../types";
import type { PlayerRef } from "@/lib/mlb/types";
import type { GameWeather } from "@/lib/weather/types";

const player: PlayerRef = { id: 1, fullName: "Test Player" };

function prop(overrides: Partial<PlayerProp>): PlayerProp {
  return {
    marketKey: "pitcher_strikeouts",
    playerName: "Test Player",
    line: 6,
    overPrice: -110,
    underPrice: -110,
    ...overrides,
  };
}

function windWeather(category: "out" | "in" | "calm", tempF: number): GameWeather {
  return {
    ballpark: null,
    elevationFt: null,
    roof: null,
    hours: [],
    tempRangeF: null,
    humidityPct: null,
    observed: null,
    gametime: {
      timeISO: "2026-07-22T23:00:00Z",
      tempF,
      humidityPct: 50,
      sky: "clear",
      skyLabel: "Clear",
      cloudCoverPct: 0,
      precipProbabilityPct: 0,
      wind: { plateRelativeDeg: 0, category, label: "", speedMph: 10 },
    },
  };
}

describe("scoreProp — pitcher strikeouts", () => {
  const pitcherStats: StatContext = {
    kind: "pitcher",
    k9: 12,
    outsPerStart: 18, // 6 IP/start -> expected K = (12/9)*6 = 8
    gamesStarted: 20,
  };

  it("tiers strong-over when season rate is far above the line", () => {
    const result = scoreProp(prop({ line: 6 }), player, pitcherStats, null);
    expect(result.tier).toBe("strong-over"); // 8 / 6 = 1.33
  });

  it("tiers lean-over just above the line", () => {
    const stats: StatContext = { ...pitcherStats, k9: 10.5 }; // expected K = 7
    const result = scoreProp(prop({ line: 6.2 }), player, stats, null);
    expect(result.tier).toBe("lean-over"); // 7 / 6.2 = 1.13
  });

  it("tiers neutral when close to the line", () => {
    const stats: StatContext = { ...pitcherStats, k9: 10.5 }; // expected K = 7
    const result = scoreProp(prop({ line: 6.8 }), player, stats, null);
    expect(result.tier).toBe("neutral"); // 7 / 6.8 = 1.03
  });

  it("tiers lean-under and strong-under symmetrically", () => {
    const leanStats: StatContext = { ...pitcherStats, k9: 7.5 }; // expected K = 5
    expect(scoreProp(prop({ line: 6 }), player, leanStats, null).tier).toBe(
      "lean-under",
    ); // 5 / 6 = 0.83

    const strongStats: StatContext = { ...pitcherStats, k9: 6 }; // expected K = 4
    expect(scoreProp(prop({ line: 6 }), player, strongStats, null).tier).toBe(
      "strong-under",
    ); // 4 / 6 = 0.67
  });

  it("stays neutral for a small sample regardless of the raw rate", () => {
    const stats: StatContext = { ...pitcherStats, gamesStarted: 2 };
    const result = scoreProp(prop({ line: 6 }), player, stats, null);
    expect(result.tier).toBe("neutral");
  });
});

describe("scoreProp — pitcher outs", () => {
  it("scores directly off outsPerStart", () => {
    const stats: StatContext = {
      kind: "pitcher",
      k9: 9,
      outsPerStart: 18,
      gamesStarted: 20,
    };
    const result = scoreProp(
      prop({ marketKey: "pitcher_outs", line: 15 }),
      player,
      stats,
      null,
    );
    expect(result.tier).toBe("strong-over"); // 18 / 15 = 1.2... wait see note below
  });
});

describe("scoreProp — batter markets", () => {
  const batterStats: StatContext = {
    kind: "batter",
    hitsPerGame: 1.0,
    totalBasesPerGame: 1.6,
    hrPerGame: 0.345,
    rbiPerGame: 0.6,
    bbPerGame: 0.4,
    games: 100,
  };

  it("scores batter_hits off hitsPerGame", () => {
    const result = scoreProp(
      prop({ marketKey: "batter_hits", line: 0.8 }),
      player,
      batterStats,
      null,
    );
    expect(result.tier).toBe("lean-over"); // 1.0 / 0.8 = 1.25... see note below
  });

  it("stays neutral for a small sample regardless of the raw rate", () => {
    const stats: StatContext = { ...batterStats, games: 10 };
    const result = scoreProp(
      prop({ marketKey: "batter_hits", line: 0.5 }),
      player,
      stats,
      null,
    );
    expect(result.tier).toBe("neutral");
  });

  it("returns neutral with a 'no stats' label when stats are unavailable", () => {
    const result = scoreProp(
      prop({ marketKey: "batter_hits", line: 0.8 }),
      player,
      null,
      null,
    );
    expect(result.tier).toBe("neutral");
    expect(result.statLabel).toBe("No stats available");
  });
});

describe("scoreProp — weather nudge", () => {
  const hrStats: StatContext = {
    kind: "batter",
    hitsPerGame: 1.0,
    totalBasesPerGame: 1.6,
    hrPerGame: 0.345, // vs line 0.3 -> ratio 1.15 -> lean-over baseline
    rbiPerGame: 0.6,
    bbPerGame: 0.4,
    games: 100,
  };

  it("nudges batter_home_runs from lean-over to strong-over when wind blows out", () => {
    const result = scoreProp(
      prop({ marketKey: "batter_home_runs", line: 0.3 }),
      player,
      hrStats,
      windWeather("out", 70),
    );
    expect(result.tier).toBe("strong-over");
  });

  it("nudges batter_home_runs from lean-over to neutral when wind blows in", () => {
    const result = scoreProp(
      prop({ marketKey: "batter_home_runs", line: 0.3 }),
      player,
      hrStats,
      windWeather("in", 70),
    );
    expect(result.tier).toBe("neutral");
  });

  it("does not nudge past strong-over", () => {
    const stats: StatContext = { ...hrStats, hrPerGame: 1.0 }; // ratio 3.3 -> strong-over baseline
    const result = scoreProp(
      prop({ marketKey: "batter_home_runs", line: 0.3 }),
      player,
      stats,
      windWeather("out", 70),
    );
    expect(result.tier).toBe("strong-over");
  });

  it("does not nudge a non weather-sensitive market (batter_hits)", () => {
    const result = scoreProp(
      prop({ marketKey: "batter_hits", line: 0.8 }), // hitsPerGame 1.0 / 0.8 = 1.25 -> lean-over
      player,
      hrStats,
      windWeather("out", 70),
    );
    expect(result.tier).toBe("lean-over");
  });

  it("does not nudge when weather has no gametime hour", () => {
    const weather: GameWeather = {
      ballpark: null,
      elevationFt: null,
      roof: null,
      hours: [],
      tempRangeF: null,
      humidityPct: null,
      observed: null,
      gametime: null,
    };
    const result = scoreProp(
      prop({ marketKey: "batter_home_runs", line: 0.3 }),
      player,
      hrStats,
      weather,
    );
    expect(result.tier).toBe("lean-over");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '../highlight'`.

- [ ] **Step 3: Implement `highlight.ts`**

Create `src/lib/odds/highlight.ts`:

```ts
import type { PlayerRef } from "@/lib/mlb/types";
import type { GameWeather } from "@/lib/weather/types";
import type { PlayerProp, PropMarketKey, PropTier, ScoredProp } from "./types";

export interface PitcherStatContext {
  kind: "pitcher";
  k9: number;
  outsPerStart: number;
  gamesStarted: number;
}

export interface BatterStatContext {
  kind: "batter";
  hitsPerGame: number;
  totalBasesPerGame: number;
  hrPerGame: number;
  rbiPerGame: number;
  bbPerGame: number;
  games: number;
}

export type StatContext = PitcherStatContext | BatterStatContext;

/** Below this many starts, a pitcher's season rate is too noisy to grade. */
const MIN_GAMES_STARTED_FOR_TIER = 3;
/** Below this many games played, a batter's per-game rate is too noisy to grade. */
const MIN_GAMES_PLAYED_FOR_TIER = 20;

const WEATHER_SENSITIVE_MARKETS: PropMarketKey[] = [
  "batter_home_runs",
  "batter_total_bases",
];

const TIER_ORDER: PropTier[] = [
  "strong-under",
  "lean-under",
  "neutral",
  "lean-over",
  "strong-over",
];

/** The player's season-average count for this market's line, or `null` if the sample is too small / the market has no stat basis for this player kind. */
function seasonAvgFor(marketKey: PropMarketKey, stats: StatContext): number | null {
  if (stats.kind === "pitcher") {
    if (stats.gamesStarted < MIN_GAMES_STARTED_FOR_TIER) return null;
    switch (marketKey) {
      case "pitcher_strikeouts":
        // K/9 times this pitcher's average innings per start.
        return (stats.k9 / 9) * stats.outsPerStart;
      case "pitcher_outs":
        return stats.outsPerStart;
      default:
        return null;
    }
  }

  if (stats.games < MIN_GAMES_PLAYED_FOR_TIER) return null;
  switch (marketKey) {
    case "batter_hits":
      return stats.hitsPerGame;
    case "batter_total_bases":
      return stats.totalBasesPerGame;
    case "batter_home_runs":
      return stats.hrPerGame;
    case "batter_rbis":
      return stats.rbiPerGame;
    case "batter_walks":
      return stats.bbPerGame;
    default:
      return null;
  }
}

function tierFromRatio(seasonAvg: number, line: number): PropTier {
  if (line <= 0) return "neutral";
  const ratio = seasonAvg / line;
  if (ratio >= 1.3) return "strong-over";
  if (ratio >= 1.1) return "lean-over";
  if (ratio <= 1 / 1.3) return "strong-under";
  if (ratio <= 1 / 1.1) return "lean-under";
  return "neutral";
}

function nudgeForWeather(tier: PropTier, weather: GameWeather | null): PropTier {
  const hour = weather?.gametime;
  if (!hour) return tier;

  const favorsOver = hour.wind.category === "out" || hour.tempF >= 85;
  const favorsUnder = hour.wind.category === "in" || hour.tempF <= 45;
  if (favorsOver === favorsUnder) return tier; // both or neither true — no clear signal

  const idx = TIER_ORDER.indexOf(tier);
  if (favorsOver && idx < TIER_ORDER.length - 1) return TIER_ORDER[idx + 1];
  if (favorsUnder && idx > 0) return TIER_ORDER[idx - 1];
  return tier;
}

/**
 * Scores one player prop against their season stats (+ ballpark weather, for
 * HR/total-bases markets only), producing a display-ready tier and label.
 * `stats: null` (fetch failed, or no stat basis for this market/player kind)
 * always yields `"neutral"`.
 */
export function scoreProp(
  prop: PlayerProp,
  player: PlayerRef,
  stats: StatContext | null,
  weather: GameWeather | null,
): ScoredProp {
  const seasonAvg = stats ? seasonAvgFor(prop.marketKey, stats) : null;

  let tier: PropTier = "neutral";
  let statLabel = "No stats available";

  if (seasonAvg != null) {
    tier = tierFromRatio(seasonAvg, prop.line);
    statLabel = `Season avg: ${seasonAvg.toFixed(1)} (line ${prop.line})`;
    if (WEATHER_SENSITIVE_MARKETS.includes(prop.marketKey)) {
      tier = nudgeForWeather(tier, weather);
    }
  }

  return {
    player,
    marketKey: prop.marketKey,
    line: prop.line,
    overPrice: prop.overPrice,
    underPrice: prop.underPrice,
    tier,
    statLabel,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`

Before running, double-check two ratios called out inline above:
- "pitcher outs" test: `outsPerStart` 18 vs line 15 → ratio `18/15 = 1.2`, which falls in `[1.1, 1.3)` → **`lean-over`**, not `strong-over`. Fix the test's expectation to `"lean-over"` before running (the comment in the test step already flags this — correct it there, not in the implementation).
- "batter_hits" test: `hitsPerGame` 1.0 vs line 0.8 → ratio `1.25` → also `[1.1, 1.3)` → **`lean-over`** (the test already expects `"lean-over"` — that one is correct as written).

Expected after that fix: PASS (16 tests).

- [ ] **Step 5: Fix the flagged test expectation**

In `src/lib/odds/__tests__/highlight.test.ts`, change:

```ts
    expect(result.tier).toBe("strong-over"); // 18 / 15 = 1.2... wait see note below
```

to:

```ts
    expect(result.tier).toBe("lean-over"); // 18 / 15 = 1.2
```

And remove the now-stale `// see note below` comments on the `batter_hits` test (line ratio 1.25 already correctly expects `"lean-over"`).

- [ ] **Step 6: Re-run tests to verify they pass**

Run: `npm test`
Expected: PASS (16 tests).

- [ ] **Step 7: Commit**

```bash
git.exe -C 'C:/Users/harlan/GitHub/baseball-dashboard' add src/lib/odds/highlight.ts src/lib/odds/__tests__/highlight.test.ts
git.exe -C 'C:/Users/harlan/GitHub/baseball-dashboard' commit -m "feat: add stat + weather based prop tier scoring"
```

---

## Task 7: Sidebar components

**Files:**
- Create: `src/components/PropsSidebar.tsx`
- Create: `src/components/PropsSidebarSection.tsx`

**Interfaces:**
- Consumes: `ScoredProp`, `PropMarketKey`, `PropTier` from `@/lib/odds/types`; `scoreProp`, `StatContext` from `@/lib/odds/highlight`; `findOddsEvent` from `@/lib/odds/events`; `getPlayerProps` from `@/lib/odds/props`; `matchPlayerName` from `@/lib/odds/playerMatch`; `getRosterWithSeasonStats`, `getPitcherPropStats`, `getSeasonHittingBasic` from `@/lib/mlb/players`; `GameFeed`, `PlayerRef`, `TeamRef` from `@/lib/mlb/types`; `GameWeather` from `@/lib/weather/types`; `GOOD_CLASS`, `BAD_CLASS` from `@/lib/statColor`; `PlayerHeadshot`, `TeamLogo` components.
- Produces: `PropsSidebar({ groups: PropTeamGroup[] })` (default export) and `PropTeamGroup { team: TeamRef; props: ScoredProp[] }` (named export) from `PropsSidebar.tsx`; `PropsSidebarSection({ feed: GameFeed; season: number; weather: GameWeather | null })` (default export, async server component) from `PropsSidebarSection.tsx`.

No automated test for these — this repo has no React component testing set up (consistent with every other component here), so verification is manual in Task 8 once wired into the page.

- [ ] **Step 1: Write the presentational component**

Create `src/components/PropsSidebar.tsx`:

```tsx
import PlayerHeadshot from "@/components/PlayerHeadshot";
import TeamLogo from "@/components/TeamLogo";
import { GOOD_CLASS, BAD_CLASS } from "@/lib/statColor";
import type { TeamRef } from "@/lib/mlb/types";
import type { PropMarketKey, PropTier, ScoredProp } from "@/lib/odds/types";

const MARKET_LABELS: Record<PropMarketKey, string> = {
  pitcher_strikeouts: "Strikeouts",
  pitcher_outs: "Outs recorded",
  batter_hits: "Hits",
  batter_total_bases: "Total bases",
  batter_home_runs: "Home runs",
  batter_rbis: "RBIs",
  batter_walks: "Walks",
};

const TIER_CLASS: Record<PropTier, string> = {
  "strong-over": GOOD_CLASS,
  "lean-over": "bg-hot/8 text-hot/80",
  neutral: "text-ink/50",
  "lean-under": "bg-cold/8 text-cold/80",
  "strong-under": BAD_CLASS,
};

const TIER_LABEL: Record<PropTier, string> = {
  "strong-over": "Strong over",
  "lean-over": "Lean over",
  neutral: "Neutral",
  "lean-under": "Lean under",
  "strong-under": "Strong under",
};

function formatPrice(price: number): string {
  return price > 0 ? `+${price}` : `${price}`;
}

function PropRow({ prop }: { prop: ScoredProp }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-ink/10 bg-paper px-2.5 py-2">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-ink">
          {MARKET_LABELS[prop.marketKey]} {prop.line}
        </div>
        <div className="mt-0.5 truncate text-xs text-ink/50">{prop.statLabel}</div>
      </div>
      <div className="flex flex-shrink-0 flex-col items-end gap-0.5">
        <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${TIER_CLASS[prop.tier]}`}>
          {TIER_LABEL[prop.tier]}
        </span>
        <span className="nums font-mono text-xs text-ink/60">
          O {formatPrice(prop.overPrice)} / U {formatPrice(prop.underPrice)}
        </span>
      </div>
    </div>
  );
}

function PlayerGroup({
  playerId,
  playerName,
  props,
}: {
  playerId: number;
  playerName: string;
  props: ScoredProp[];
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <PlayerHeadshot personId={playerId} size={20} />
        <span className="text-sm font-semibold text-ink">{playerName}</span>
      </div>
      <div className="space-y-1.5">
        {props.map((p, i) => (
          <PropRow key={i} prop={p} />
        ))}
      </div>
    </div>
  );
}

export interface PropTeamGroup {
  team: TeamRef;
  props: ScoredProp[];
}

/**
 * Presentational — renders the sidebar's content. Owns its own card shell
 * (unlike the page's other `Section`-wrapped children) since it needs to
 * render its own empty state without a surrounding title bar mismatch.
 */
export default function PropsSidebar({ groups }: { groups: PropTeamGroup[] }) {
  if (groups.length === 0) {
    return (
      <div className="rounded-md border border-ink/10 bg-card p-4 shadow-sm">
        <h2 className="eyebrow text-base">Player props</h2>
        <p className="mt-2 text-sm text-ink/50">No props available for this game.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-ink/10 bg-card p-4 shadow-sm">
      <h2 className="eyebrow mb-3 text-base">Player props</h2>
      <div className="space-y-5">
        {groups.map(({ team, props }) => {
          const byPlayer = new Map<number, { name: string; props: ScoredProp[] }>();
          for (const p of props) {
            const g = byPlayer.get(p.player.id) ?? { name: p.player.fullName, props: [] };
            g.props.push(p);
            byPlayer.set(p.player.id, g);
          }
          return (
            <div key={team.id} className="space-y-3">
              <div className="flex items-center gap-1.5 border-b border-ink/10 pb-1.5">
                <TeamLogo teamId={team.id} size={18} />
                <span className="text-xs font-semibold uppercase tracking-wide text-ink/60">
                  {team.abbreviation ?? team.name}
                </span>
              </div>
              {[...byPlayer.entries()].map(([playerId, g]) => (
                <PlayerGroup key={playerId} playerId={playerId} playerName={g.name} props={g.props} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write the data-fetching section**

Create `src/components/PropsSidebarSection.tsx`:

```tsx
import type { GameFeed, PlayerRef, TeamRef } from "@/lib/mlb/types";
import type { GameWeather } from "@/lib/weather/types";
import { findOddsEvent } from "@/lib/odds/events";
import { getPlayerProps } from "@/lib/odds/props";
import { matchPlayerName } from "@/lib/odds/playerMatch";
import { scoreProp, type StatContext } from "@/lib/odds/highlight";
import type { PlayerProp, ScoredProp } from "@/lib/odds/types";
import {
  getRosterWithSeasonStats,
  getPitcherPropStats,
  getSeasonHittingBasic,
} from "@/lib/mlb/players";
import PropsSidebar, { type PropTeamGroup } from "./PropsSidebar";

async function safe<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch {
    return null;
  }
}

interface RosterEntry {
  player: PlayerRef;
  team: TeamRef;
}

function findEntry(name: string, entries: RosterEntry[]): RosterEntry | null {
  const matched = matchPlayerName(
    name,
    entries.map((e) => e.player),
  );
  if (!matched) return null;
  return entries.find((e) => e.player.id === matched.id) ?? null;
}

export default async function PropsSidebarSection({
  feed,
  season,
  weather,
}: {
  feed: GameFeed;
  season: number;
  weather: GameWeather | null;
}) {
  const eventId = await safe(
    findOddsEvent(feed.away.team.name, feed.home.team.name, feed.startTime),
  );
  if (!eventId) return <PropsSidebar groups={[]} />;

  const props = (await safe(getPlayerProps(eventId))) ?? [];
  if (props.length === 0) return <PropsSidebar groups={[]} />;

  const [awayRoster, homeRoster] = await Promise.all([
    safe(getRosterWithSeasonStats(feed.away.team.id, season)),
    safe(getRosterWithSeasonStats(feed.home.team.id, season)),
  ]);

  const pitcherEntries: RosterEntry[] = (
    [
      [feed.probablePitchers.away, feed.away.team],
      [feed.probablePitchers.home, feed.home.team],
    ] as const
  )
    .filter((pair): pair is [PlayerRef, TeamRef] => pair[0] != null)
    .map(([player, team]) => ({ player, team }));

  const batterEntries: RosterEntry[] = [
    ...(awayRoster ?? []).map((r) => ({ player: r.player, team: feed.away.team })),
    ...(homeRoster ?? []).map((r) => ({ player: r.player, team: feed.home.team })),
  ];

  const matched: { prop: PlayerProp; entry: RosterEntry; isPitcher: boolean }[] = [];
  for (const prop of props) {
    const isPitcher =
      prop.marketKey === "pitcher_strikeouts" || prop.marketKey === "pitcher_outs";
    const entry = findEntry(prop.playerName, isPitcher ? pitcherEntries : batterEntries);
    if (entry) matched.push({ prop, entry, isPitcher });
  }

  const pitcherIds = [...new Set(matched.filter((m) => m.isPitcher).map((m) => m.entry.player.id))];
  const batterIds = [...new Set(matched.filter((m) => !m.isPitcher).map((m) => m.entry.player.id))];

  const [pitcherStatsList, batterStatsList] = await Promise.all([
    Promise.all(
      pitcherIds.map(async (id) => [id, await safe(getPitcherPropStats(id, season))] as const),
    ),
    Promise.all(
      batterIds.map(async (id) => [id, await safe(getSeasonHittingBasic(id, season))] as const),
    ),
  ]);

  const pitcherStatsById = new Map(pitcherStatsList);
  const batterStatsById = new Map(batterStatsList);

  const scoredByTeam = new Map<number, ScoredProp[]>([
    [feed.away.team.id, []],
    [feed.home.team.id, []],
  ]);

  for (const { prop, entry, isPitcher } of matched) {
    let stats: StatContext | null = null;
    if (isPitcher) {
      const p = pitcherStatsById.get(entry.player.id);
      if (p) {
        stats = { kind: "pitcher", k9: p.k9, outsPerStart: p.outsPerStart, gamesStarted: p.gamesStarted };
      }
    } else {
      const h = batterStatsById.get(entry.player.id);
      if (h && h.games > 0) {
        stats = {
          kind: "batter",
          hitsPerGame: h.h / h.games,
          totalBasesPerGame: h.totalBases / h.games,
          hrPerGame: h.hr / h.games,
          rbiPerGame: h.rbi / h.games,
          bbPerGame: h.bb / h.games,
          games: h.games,
        };
      }
    }
    scoredByTeam.get(entry.team.id)!.push(scoreProp(prop, entry.player, stats, weather));
  }

  const groups: PropTeamGroup[] = [
    { team: feed.away.team, props: scoredByTeam.get(feed.away.team.id) ?? [] },
    { team: feed.home.team, props: scoredByTeam.get(feed.home.team.id) ?? [] },
  ].filter((g) => g.props.length > 0);

  return <PropsSidebar groups={groups} />;
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing `PropsSidebar.tsx` or `PropsSidebarSection.tsx`. (The project has no other compile errors as of this plan's writing — if unrelated pre-existing errors appear, ignore them; if any reference these two new files, fix before proceeding.)

- [ ] **Step 4: Commit**

```bash
git.exe -C 'C:/Users/harlan/GitHub/baseball-dashboard' add src/components/PropsSidebar.tsx src/components/PropsSidebarSection.tsx
git.exe -C 'C:/Users/harlan/GitHub/baseball-dashboard' commit -m "feat: add player props sidebar components"
```

---

## Task 8: Wire the sidebar into the game page

**Files:**
- Modify: `src/app/games/[gamePk]/page.tsx`

**Interfaces:**
- Consumes: `PropsSidebarSection` (default export) from `@/components/PropsSidebarSection` (Task 7); `GameWeather` type from `@/lib/weather/types`.

This task lifts the weather fetch out of `WeatherSection` (so both it and the new sidebar can use the same result without a duplicate fetch — cheap and TTL-cached either way, but no reason to double it), and restructures the page body into a two-column grid.

- [ ] **Step 1: Add the `GameWeather` type import**

In `src/app/games/[gamePk]/page.tsx`, modify the import block:

```ts
import { getGameWeather } from "@/lib/weather/report";
import type {
  BullpenPitcher,
  GameFeed,
  TeamBoxscore,
} from "@/lib/mlb/types";
```

to:

```ts
import { getGameWeather } from "@/lib/weather/report";
import type { GameWeather } from "@/lib/weather/types";
import PropsSidebarSection from "@/components/PropsSidebarSection";
import type {
  BullpenPitcher,
  GameFeed,
  TeamBoxscore,
} from "@/lib/mlb/types";
```

- [ ] **Step 2: Change `WeatherSection` to take weather as a prop instead of fetching it**

Replace:

```tsx
async function WeatherSection({ feed }: { feed: GameFeed }) {
  const weather = await safe(
    getGameWeather({
      venueId: feed.venueId,
      startTimeISO: feed.startTime,
      observed: feed.weather ?? null,
    }),
  );
  if (!weather) return <SectionError label="ballpark weather" />;
  return <BallparkWeather weather={weather} />;
}
```

with:

```tsx
function WeatherSection({ weather }: { weather: GameWeather | null }) {
  if (!weather) return <SectionError label="ballpark weather" />;
  return <BallparkWeather weather={weather} />;
}
```

- [ ] **Step 3: Fetch weather once in the page body**

In `GamePage`, after:

```tsx
  const season = seasonOf(feed);
  const scored = feed.state === "Live" || feed.state === "Final";
  const isPreview = feed.state === "Preview";
  const isDisrupted = /Postponed|Suspended|Cancel/i.test(feed.detailedState);
  const d = feed.decisions;
```

add:

```tsx
  const weather =
    !isDisrupted && (isPreview || feed.state === "Live")
      ? await safe(
          getGameWeather({
            venueId: feed.venueId,
            startTimeISO: feed.startTime,
            observed: feed.weather ?? null,
          }),
        )
      : null;
```

- [ ] **Step 4: Update the weather section's call site**

Replace:

```tsx
      {/* Ballpark weather */}
      {!isDisrupted && (isPreview || feed.state === "Live") && (
        <Section title="Ballpark weather">
          <Suspense fallback={<SectionSkeleton />}>
            <WeatherSection feed={feed} />
          </Suspense>
        </Section>
      )}
```

with:

```tsx
      {/* Ballpark weather */}
      {!isDisrupted && (isPreview || feed.state === "Live") && (
        <Section title="Ballpark weather">
          <WeatherSection weather={weather} />
        </Section>
      )}
```

(No `Suspense` needed here anymore — `weather` is already resolved before render.)

- [ ] **Step 5: Restructure the page body into a two-column grid**

Replace the whole `return ( ... )` block in `GamePage` — from `return (` through the closing `);` — with:

```tsx
  return (
    <div className="space-y-5">
      <AutoRefresh enabled={feed.state === "Live"} />

      <Link
        href="/"
        className="inline-block text-sm text-ink/60 hover:text-ink"
      >
        ← All games
      </Link>

      {/* Header */}
      <div className="rounded-md border border-ink/10 bg-card p-4 shadow-sm">
        <h1 className="sr-only">
          {feed.away.team.name} at {feed.home.team.name}
        </h1>
        <div className="mb-3 flex items-center justify-between">
          <GameStatusBadge game={{ state: feed.state, detailedState: feed.detailedState }} />
          {isPreview && feed.startTime && (
            <span className="font-mono text-sm text-ink/60">
              <LocalTime iso={feed.startTime} weekday />
            </span>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="font-display flex items-center gap-2.5 text-xl font-semibold">
            <TeamLogo teamId={feed.away.team.id} size={28} />
            {feed.away.team.name}
          </span>
          {scored && (
            <span className="font-mono text-xl font-semibold">
              {feed.away.score ?? "-"}
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span className="font-display flex items-center gap-2.5 text-xl font-semibold">
            <TeamLogo teamId={feed.home.team.id} size={28} />
            {feed.home.team.name}
          </span>
          {scored && (
            <span className="font-mono text-xl font-semibold">
              {feed.home.score ?? "-"}
            </span>
          )}
        </div>

        {feed.venue && (
          <p className="mt-2 text-xs text-ink/50">
            {[feed.venue, feed.venueCity].filter(Boolean).join(", ")}
          </p>
        )}

        {feed.state === "Final" && (d?.winner || d?.loser) && (
          <p className="mt-3 border-t border-ink/10 pt-2 text-xs text-ink/60">
            {d?.winner && <>W: {d.winner.fullName}</>}
            {d?.loser && <> · L: {d.loser.fullName}</>}
            {d?.save && <> · SV: {d.save.fullName}</>}
          </p>
        )}

        {isPreview && (feed.probablePitchers.away || feed.probablePitchers.home) && (
          <div className="mt-3 border-t border-ink/10 pt-2 text-sm text-ink/60">
            <span className="mr-3">Probables:</span>
            <span className="inline-flex flex-wrap items-center gap-x-5 gap-y-1 align-middle">
              {(["away", "home"] as const).map((side) => {
                const pitcher = feed.probablePitchers[side];
                return (
                  <span key={side} className="inline-flex items-center gap-1.5">
                    {pitcher && <PlayerHeadshot personId={pitcher.id} size={22} />}
                    <span className="text-ink/40">
                      {teamName(feed[side].team)}
                    </span>
                    {pitcher?.fullName ?? "TBD"}
                  </span>
                );
              })}
            </span>
          </div>
        )}
      </div>

      {isDisrupted && (
        <p className="rounded-md border border-clay/40 bg-clay/10 px-3 py-2 text-sm text-clay">
          This game is {feed.detailedState.toLowerCase()}.
        </p>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px] lg:items-start">
        <div className="space-y-5">
          {/* Probable starters */}
          {!isDisrupted && isPreview && (
            <Section title="Probable starters">
              <Suspense fallback={<SectionSkeleton />}>
                <ProbableStartersSection feed={feed} season={season} />
              </Suspense>
            </Section>
          )}

          {/* Ballpark weather */}
          {!isDisrupted && (isPreview || feed.state === "Live") && (
            <Section title="Ballpark weather">
              <WeatherSection weather={weather} />
            </Section>
          )}

          {/* 1. Linescore + boxscore (from the feed) */}
          {scored && !isDisrupted && (
            <Section title="Boxscore">
              <div className="space-y-4">
                <Linescore feed={feed} />
                <BoxscoreTables
                  away={feed.boxscore.away}
                  home={feed.boxscore.home}
                  isLive={feed.state === "Live"}
                />
              </div>
            </Section>
          )}

          {/* Game log */}
          {scored && !isDisrupted && (
            <Section title="Game log">
              <Suspense fallback={<SectionSkeleton />}>
                <GameLogSection feed={feed} />
              </Suspense>
            </Section>
          )}

          {/* 2. Bullpen (also from the feed) */}
          {!isDisrupted &&
            (feed.boxscore.away.bullpen.length > 0 ||
              feed.boxscore.home.bullpen.length > 0) && (
              <Section title={scored ? "Bullpen (available arms)" : "Bullpen"}>
                <Suspense fallback={<SectionSkeleton />}>
                  <BullpenSection feed={feed} season={season} />
                </Suspense>
              </Section>
            )}

          {/* 3. Head-to-head */}
          <Section title="Season series">
            <Suspense fallback={<SectionSkeleton />}>
              <HeadToHeadSection feed={feed} season={season} />
            </Suspense>
          </Section>

          {/* 4. Batter vs pitcher */}
          <Section title="Matchups">
            <Suspense fallback={<SectionSkeleton />}>
              <MatchupSection feed={feed} season={season} />
            </Suspense>
          </Section>

          {/* 5. Sabermetrics */}
          <Section title="Sabermetric evaluations">
            <Suspense fallback={<SectionSkeleton />}>
              <RosterStatsSection feed={feed} season={season} />
            </Suspense>
          </Section>
        </div>

        {/* Player props sidebar — Preview only; sportsbooks pull lines once a game goes live. */}
        {!isDisrupted && isPreview && (
          <div className="lg:sticky lg:top-4">
            <Suspense fallback={<SectionSkeleton />}>
              <PropsSidebarSection feed={feed} season={season} weather={weather} />
            </Suspense>
          </div>
        )}
      </div>
    </div>
  );
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Lint**

Run: `npm run lint`
Expected: no errors (warnings pre-existing elsewhere in the repo are not this task's concern; anything newly introduced in `page.tsx` must be clean).

- [ ] **Step 8: Manual verification in the browser**

Run: `npm run dev`, then in a browser:

1. **No API key configured** (default — `.env` has no `ODDS_API_KEY`, or it's unset): open any today's-date Preview game at `http://localhost:3000/games/<gamePk>`. Expect: page loads normally, sidebar shows "Player props" with "No props available for this game." — nothing else on the page is affected.
2. **With a real `ODDS_API_KEY`** set in `.env.local` (sign up for a free key at the-odds-api.com and paste it in): reload the same Preview game. Expect: sidebar shows grouped props by team → player, each row tier-colored, with Over/Under American-odds prices.
3. **A Preview game with no Odds API coverage** (a low-profile matchup, or query a date/gamePk where `findOddsEvent` returns no match): expect the same graceful "No props available" empty state, not an error.
4. **A Live or Final game**: expect no sidebar at all — page reverts to its previous single-column-plus-full-width layout for those states, and the rest of the page (boxscore, bullpen, etc.) renders exactly as it did before this change.
5. **Mobile width** (resize browser or use devtools device mode) on a Preview game: expect the grid collapses to one column, with the sidebar's card appearing after the Sabermetric evaluations section, not overlapping any content.

- [ ] **Step 9: Commit**

```bash
git.exe -C 'C:/Users/harlan/GitHub/baseball-dashboard' add src/app/games/\[gamePk\]/page.tsx
git.exe -C 'C:/Users/harlan/GitHub/baseball-dashboard' commit -m "feat: wire player props sidebar into the game detail page"
```

---

## Self-Review Notes

- **Spec coverage:** every spec section (source, scope, markets, matching, highlight math, weather nudge, layout, error handling) maps to a task above. The one deliberate deviation from the spec's literal wording — computing pitcher K/9 from raw `strikeOuts`/`inningsPitched`/`gamesStarted` in a new `getPitcherPropStats` rather than reusing `SaberPitching.kPct` — is called out in Task 3's intro, since `kPct` alone can't yield K/9 without also fetching batters-faced.
- **No placeholders:** every step has complete, runnable code; no "TBD"/"add error handling" left unresolved.
- **Type consistency checked:** `PropTier`, `PlayerProp`, `ScoredProp`, `PropMarketKey` (Task 1) are used identically across `highlight.ts` (Task 6), `props.ts` (Task 5), and both components (Task 7). `StatContext`/`PitcherStatContext`/`BatterStatContext` (Task 6) match their construction sites in `PropsSidebarSection.tsx` (Task 7) field-for-field. `PitcherPropStats`/`SeasonHittingBasic` (Task 3) field names match their consumption in Task 7.
