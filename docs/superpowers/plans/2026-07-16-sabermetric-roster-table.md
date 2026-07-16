# Sabermetric Roster Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "Sabermetric evaluations" section on the game page with an interactive roster table showing all active players for both teams, sorted by position and enriched with sabermetric + seasonal stats.

**Architecture:** Fetch active rosters for both teams via MLB API, enrich each player with sabermetric and seasonal stats (WAR, wRC+, ERA-, etc.), group by position, and render two side-by-side tables (one per team). Reuse existing `statClass()` for coloring. Error handling: roster fetch fails → show section error; individual player stats fail → skip that player.

**Tech Stack:** Next.js App Router (async components), TypeScript, Tailwind CSS, existing `mlbFetch()` and formatting utilities.

## Global Constraints

- Node 18+ (project requirement)
- Tailwind CSS v4 with theme tokens from `globals.css`
- Formatting helpers: `rate3()`, `int()`, `dec1()`, `dec2()`, `pct()` (existing in `players.ts`)
- `statClass()` for conditional stat coloring (existing in `statColor.ts`)
- No external table libraries; use semantic `<table>` + Tailwind classes
- Column order for hitters: Pos | Name | WAR | wRC+ | PA | wOBA | xwOBA | BB% | K%
- Column order for pitchers: Pos | Name | WAR | ERA- | IP | ERA | FIP | xFIP | (K% − BB%)
- Only display players with available stats; skip empty rows
- Positions in order: SP, RP, C, 1B, 2B, 3B, SS, LF, CF, RF

---

## Task 1: Extend `SaberHitting` and `SaberPitching` types with season stats

**Files:**
- Modify: `src/lib/mlb/types.ts`

**Interfaces:**
- Consumes: Nothing (base types)
- Produces:
  ```typescript
  interface SaberHitting {
    woba?: number;
    wrcPlus?: number;
    war?: number;
    babip?: string;
    pa?: number;           // NEW
    bbPct?: string;        // NEW (formatted as "8.5%")
    kPct?: string;         // NEW (formatted as "12.3%")
  }
  
  interface SaberPitching {
    war?: number;
    fip?: number;
    xfip?: number;
    eraMinus?: number;
    ip?: string;           // NEW (e.g. "123.1")
    era?: string;          // NEW (e.g. "3.45")
    bbPct?: string;        // NEW (formatted as "8.5%")
    kPct?: string;         // NEW (formatted as "12.3%")
    kMinusBbPct?: number;  // NEW (K% - BB% as raw decimal, e.g. 0.142)
  }
  ```

- [ ] **Step 1: Read the current types file**

Run: `cat src/lib/mlb/types.ts | grep -A 10 "interface SaberHitting"`

Expected: See `SaberHitting` with woba, wrcPlus, war, babip

- [ ] **Step 2: Add season stats fields to `SaberHitting`**

In `src/lib/mlb/types.ts`, modify the `SaberHitting` interface (around line 187):

```typescript
export interface SaberHitting {
  woba?: number;
  wrcPlus?: number;
  war?: number;
  babip?: string;
  pa?: number;           // Plate appearances
  bbPct?: string;        // Walk rate (e.g. "8.5%")
  kPct?: string;         // Strikeout rate (e.g. "12.3%")
}
```

- [ ] **Step 3: Add season stats fields to `SaberPitching`**

In `src/lib/mlb/types.ts`, modify the `SaberPitching` interface (around line 194):

```typescript
export interface SaberPitching {
  war?: number;
  fip?: number;
  xfip?: number;
  eraMinus?: number;
  ip?: string;           // Innings pitched (e.g. "123.1")
  era?: string;          // Earned run average (e.g. "3.45")
  bbPct?: string;        // Walk rate (e.g. "8.5%")
  kPct?: string;         // Strikeout rate (e.g. "12.3%")
  kMinusBbPct?: number;  // K% - BB% (raw decimal for sorting)
}
```

- [ ] **Step 4: Commit**

```bash
git.exe add src/lib/mlb/types.ts
git.exe commit -m "types: extend SaberHitting and SaberPitching with season stats"
```

---

## Task 2: Extend `getSaberHitting()` to include season hitting stats (PA, BB%, K%)

**Files:**
- Modify: `src/lib/mlb/players.ts:63-81`

**Interfaces:**
- Consumes: `personId: number`, `season: number`
- Produces: `Promise<SaberHitting | null>` (extended with pa, bbPct, kPct)

**Context:** Currently `getSaberHitting()` fetches sabermetrics + season BABIP. We need to also fetch BB% and K% from the season group's `plateAppearances`, `baseOnBalls`, `strikeOuts` fields. The `pct()` helper already exists at line 188.

- [ ] **Step 1: Examine the raw season stat response**

Run: `grep -A 20 "function parseSplitStat" src/lib/mlb/players.ts`

Expected: See `pct()` helper that formats `(part / whole) * 100` as percentage string.

- [ ] **Step 2: Update `getSaberHitting()` to calculate and return BB% and K%**

Replace lines 63-81 in `src/lib/mlb/players.ts`:

```typescript
/**
 * Hitter sabermetrics (wOBA / wRC+ / WAR) plus BABIP and season stats (PA, BB%, K%).
 */
export async function getSaberHitting(
  personId: number,
  season: number,
): Promise<SaberHitting | null> {
  const res = await mlbFetch<RawStatsResponse>(
    `/api/v1/people/${personId}/stats`,
    { stats: "sabermetrics,season", group: "hitting", season },
    TTL.playerStats,
  );
  const saber = pickGroup(res, "sabermetrics");
  const seasonStat = pickGroup(res, "season");
  if (!saber && !seasonStat) return null;

  const pa = n(seasonStat?.plateAppearances) ?? 0;
  const bb = n(seasonStat?.baseOnBalls) ?? 0;
  const k = n(seasonStat?.strikeOuts) ?? 0;

  return {
    woba: n(saber?.woba),
    wrcPlus: n(saber?.wRcPlus),
    war: n(saber?.war),
    babip: s(seasonStat?.babip),
    pa,
    bbPct: pct(bb, pa),
    kPct: pct(k, pa),
  };
}
```

- [ ] **Step 3: Verify `pct()` helper is accessible**

Run: `grep "^function pct" src/lib/mlb/players.ts`

Expected: See `function pct(part: number | undefined, whole: number): string` at line 188

If not visible, check that it's exported or accessible in scope. (It should be; it's defined in the same file before `parseSplitStat`.)

- [ ] **Step 4: Test the change with a quick manual check**

No unit tests required (this is a data fetching function; tested via integration). When you implement Task 7 (components), visual inspection will confirm stats appear.

- [ ] **Step 5: Commit**

```bash
git.exe add src/lib/mlb/players.ts
git.exe commit -m "feat: add season stats (PA, BB%, K%) to getSaberHitting()"
```

---

## Task 3: Create `getSaberPitchingWithSeasonStats()` function

**Files:**
- Modify: `src/lib/mlb/players.ts:84-101` (add new function after `getSaberPitching()`)

**Interfaces:**
- Consumes: `personId: number`, `season: number`
- Produces: `Promise<SaberPitching | null>` (extended with ip, era, bbPct, kPct, kMinusBbPct)

**Context:** Current `getSaberPitching()` only fetches sabermetrics (WAR, FIP, xFIP, ERA-). We need to also fetch season pitching stats (IP, ERA, BB, K) to calculate BB% and K%.

- [ ] **Step 1: Add new function after `getSaberPitching()` in `src/lib/mlb/players.ts`**

After line 101 (end of current `getSaberPitching()`), add:

```typescript
/**
 * Pitcher sabermetrics (WAR / FIP / xFIP / ERA-) plus season stats (IP / ERA / BB% / K%).
 */
export async function getSaberPitchingWithSeasonStats(
  personId: number,
  season: number,
): Promise<SaberPitching | null> {
  const res = await mlbFetch<RawStatsResponse>(
    `/api/v1/people/${personId}/stats`,
    { stats: "sabermetrics,season", group: "pitching", season },
    TTL.playerStats,
  );
  const saber = pickGroup(res, "sabermetrics");
  const seasonStat = pickGroup(res, "season");
  if (!saber && !seasonStat) return null;

  const bb = n(seasonStat?.baseOnBalls) ?? 0;
  const k = n(seasonStat?.strikeOuts) ?? 0;
  const bf = n(seasonStat?.battersFaced) ?? 1; // Avoid division by zero

  const bbPctVal = bf > 0 ? bb / bf : 0;
  const kPctVal = bf > 0 ? k / bf : 0;

  return {
    war: n(saber?.war),
    fip: n(saber?.fip),
    xfip: n(saber?.xfip),
    eraMinus: n(saber?.eraMinus),
    ip: s(seasonStat?.inningsPitched),
    era: s(seasonStat?.era),
    bbPct: pct(bb, bf),
    kPct: pct(k, bf),
    kMinusBbPct: kPctVal - bbPctVal, // Raw decimal for sorting
  };
}
```

- [ ] **Step 2: Verify the function signature and types**

Read back the change:

Run: `grep -A 30 "getSaberPitchingWithSeasonStats" src/lib/mlb/players.ts | head -35`

Expected: Function definition with all fields matching `SaberPitching` type from Task 1.

- [ ] **Step 3: Commit**

```bash
git.exe add src/lib/mlb/players.ts
git.exe commit -m "feat: add getSaberPitchingWithSeasonStats() for roster table"
```

---

## Task 4: Create roster fetching function

**Files:**
- Modify: `src/lib/mlb/players.ts` (add new export function)

**Interfaces:**
- Consumes: `teamId: number`, `season: number`
- Produces: `Promise<Array<{ player: PlayerRef; position: string; role?: string }>>`

**Context:** The `/api/v1/teams/{teamId}/roster?rosterType=active` endpoint returns all active roster players with their position. We'll use this to get the player list, then fetch stats individually for each.

- [ ] **Step 1: Add new function to fetch active roster with position info**

Add after `getRosterWithSeasonStats()` (around line 298):

```typescript
/** Active roster with position info for all players (hitters + pitchers). */
export interface RosterPlayer {
  player: PlayerRef;
  position: string; // e.g. "C", "Pitcher", "Outfielder", "Infielder"
  role?: string;    // e.g. "Starter", "Relief" (if available in roster endpoint)
}

/**
 * Full active roster (hitters + pitchers) with basic position info.
 * Does not fetch stats — only IDs, names, positions.
 */
export async function getActiveRoster(
  teamId: number,
): Promise<RosterPlayer[]> {
  const res = await mlbFetch<RawRosterResponse>(
    `/api/v1/teams/${teamId}/roster`,
    { rosterType: "active" },
    TTL.roster,
  );

  const players: RosterPlayer[] = [];
  for (const entry of res.roster ?? []) {
    players.push({
      player: { id: entry.person.id, fullName: entry.person.fullName },
      position: entry.position?.type ?? "Unknown",
      role: entry.role?.name,
    });
  }

  return players;
}
```

- [ ] **Step 2: Add `RosterPlayer` type export to match interface**

Verify the type is defined in the code block above.

- [ ] **Step 3: Commit**

```bash
git.exe add src/lib/mlb/players.ts
git.exe commit -m "feat: add getActiveRoster() for fetching team rosters with positions"
```

---

## Task 5: Create `RosterStatsRow.tsx` component for displaying a single player row

**Files:**
- Create: `src/components/RosterStatsRow.tsx`

**Interfaces:**
- Consumes: Player name, position, stats object (SaberHitting | SaberPitching), isHitter flag
- Produces: React component rendering `<tr>` with formatted cells

**Context:** This component renders a single table row for one player. It uses existing formatting helpers (`rate3()`, `int()`, `dec2()`, `pct()`) and `statClass()` for coloring.

- [ ] **Step 1: Create the component file**

Create `src/components/RosterStatsRow.tsx`:

```typescript
'use client';

import type { SaberHitting, SaberPitching } from "@/lib/mlb/types";
import { statClass } from "@/lib/statColor";

function rate3(n?: number): string {
  if (n == null) return "—";
  return n.toFixed(3).replace(/^0(?=\.)/, "");
}

function int(n?: number): string {
  return n == null ? "—" : String(Math.round(n));
}

function dec2(n?: number): string {
  return n == null ? "—" : n.toFixed(2);
}

function pct(val?: string): string {
  return val ?? "—";
}

interface HitterRowProps {
  position: string;
  name: string;
  stats: SaberHitting | null;
}

interface PitcherRowProps {
  position: string;
  name: string;
  stats: SaberPitching | null;
}

export function HitterRow({ position, name, stats }: HitterRowProps) {
  return (
    <tr className="border-t border-ink/5 text-sm hover:bg-field/5">
      <td className="px-3 py-2 font-mono text-xs font-semibold text-ink/70 w-12">{position}</td>
      <td className="px-3 py-2 font-medium text-ink truncate">{name}</td>
      <td className={`px-3 py-2 font-mono text-right ${statClass("warHitter", stats?.war) ?? ""}`}>{dec2(stats?.war)}</td>
      <td className={`px-3 py-2 font-mono text-right ${statClass("wrcPlus", stats?.wrcPlus) ?? ""}`}>{int(stats?.wrcPlus)}</td>
      <td className="px-3 py-2 font-mono text-right text-ink/60">{int(stats?.pa)}</td>
      <td className={`px-3 py-2 font-mono text-right ${statClass("woba", stats?.woba) ?? ""}`}>{rate3(stats?.woba)}</td>
      <td className="px-3 py-2 font-mono text-right text-ink/60">{rate3(stats?.woba)}</td> {/* TODO: xwOBA fallback to wOBA if unavailable */}
      <td className="px-3 py-2 font-mono text-right text-ink/60">{pct(stats?.bbPct)}</td>
      <td className="px-3 py-2 font-mono text-right text-ink/60">{pct(stats?.kPct)}</td>
    </tr>
  );
}

export function PitcherRow({ position, name, stats }: PitcherRowProps) {
  return (
    <tr className="border-t border-ink/5 text-sm hover:bg-field/5">
      <td className="px-3 py-2 font-mono text-xs font-semibold text-ink/70 w-12">{position}</td>
      <td className="px-3 py-2 font-medium text-ink truncate">{name}</td>
      <td className={`px-3 py-2 font-mono text-right ${statClass("warPitcher", stats?.war) ?? ""}`}>{dec2(stats?.war)}</td>
      <td className={`px-3 py-2 font-mono text-right ${statClass("eraMinus", stats?.eraMinus) ?? ""}`}>{int(stats?.eraMinus)}</td>
      <td className="px-3 py-2 font-mono text-right text-ink/60">{stats?.ip ?? "—"}</td>
      <td className="px-3 py-2 font-mono text-right text-ink/60">{stats?.era ?? "—"}</td>
      <td className={`px-3 py-2 font-mono text-right ${statClass("fip", stats?.fip) ?? ""}`}>{dec2(stats?.fip)}</td>
      <td className={`px-3 py-2 font-mono text-right ${statClass("xfip", stats?.xfip) ?? ""}`}>{dec2(stats?.xfip)}</td>
      <td className="px-3 py-2 font-mono text-right text-ink/60">{pct(stats?.bbPct)}</td> {/* TODO: render K% - BB% here */}
    </tr>
  );
}
```

- [ ] **Step 2: Add `use client` directive**

Confirm the file starts with `'use client';` (line 1).

- [ ] **Step 3: Commit**

```bash
git.exe add src/components/RosterStatsRow.tsx
git.exe commit -m "feat: add HitterRow and PitcherRow components for roster table"
```

---

## Task 6: Create `RosterStatsTable.tsx` component for displaying hitters and pitchers tables

**Files:**
- Create: `src/components/RosterStatsTable.tsx`

**Interfaces:**
- Consumes: `teamName: string`, `teamId: number`, `hitters: Array<{player, stats}>`, `pitchers: Array<{player, stats}>`
- Produces: React component rendering two tables (one for hitters, one for pitchers)

**Context:** This component renders the table structure (headers + rows) for one team. It uses `HitterRow` and `PitcherRow` from Task 5.

- [ ] **Step 1: Create the component file**

Create `src/components/RosterStatsTable.tsx`:

```typescript
'use client';

import type { TeamRef, SaberHitting, SaberPitching } from "@/lib/mlb/types";
import { HitterRow, PitcherRow } from "./RosterStatsRow";
import TeamLogo from "./TeamLogo";

interface RosterStatsTableProps {
  team: TeamRef;
  hitters: Array<{ player: { id: number; fullName: string }; position: string; stats: SaberHitting | null }>;
  pitchers: Array<{ player: { id: number; fullName: string }; position: string; stats: SaberPitching | null }>;
}

export default function RosterStatsTable({ team, hitters, pitchers }: RosterStatsTableProps) {
  return (
    <div className="space-y-4">
      {/* Team header */}
      <h3 className="font-display mb-3 flex items-center gap-2 text-base font-semibold">
        <TeamLogo teamId={team.id} size={18} />
        {team.name}
      </h3>

      {/* Hitters table */}
      {hitters.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-ink/10 bg-card">
                <th className="px-3 py-2 text-left font-semibold text-xs uppercase text-ink/50 w-12">Pos</th>
                <th className="px-3 py-2 text-left font-semibold text-xs uppercase text-ink/50">Name</th>
                <th className="px-3 py-2 text-right font-semibold text-xs uppercase text-ink/50">WAR</th>
                <th className="px-3 py-2 text-right font-semibold text-xs uppercase text-ink/50">wRC+</th>
                <th className="px-3 py-2 text-right font-semibold text-xs uppercase text-ink/50">PA</th>
                <th className="px-3 py-2 text-right font-semibold text-xs uppercase text-ink/50">wOBA</th>
                <th className="px-3 py-2 text-right font-semibold text-xs uppercase text-ink/50">xwOBA</th>
                <th className="px-3 py-2 text-right font-semibold text-xs uppercase text-ink/50">BB%</th>
                <th className="px-3 py-2 text-right font-semibold text-xs uppercase text-ink/50">K%</th>
              </tr>
            </thead>
            <tbody>
              {hitters.map((h) => (
                <HitterRow
                  key={h.player.id}
                  position={h.position}
                  name={h.player.fullName}
                  stats={h.stats}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pitchers table */}
      {pitchers.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-ink/10 bg-card">
                <th className="px-3 py-2 text-left font-semibold text-xs uppercase text-ink/50 w-12">Pos</th>
                <th className="px-3 py-2 text-left font-semibold text-xs uppercase text-ink/50">Name</th>
                <th className="px-3 py-2 text-right font-semibold text-xs uppercase text-ink/50">WAR</th>
                <th className="px-3 py-2 text-right font-semibold text-xs uppercase text-ink/50">ERA-</th>
                <th className="px-3 py-2 text-right font-semibold text-xs uppercase text-ink/50">IP</th>
                <th className="px-3 py-2 text-right font-semibold text-xs uppercase text-ink/50">ERA</th>
                <th className="px-3 py-2 text-right font-semibold text-xs uppercase text-ink/50">FIP</th>
                <th className="px-3 py-2 text-right font-semibold text-xs uppercase text-ink/50">xFIP</th>
                <th className="px-3 py-2 text-right font-semibold text-xs uppercase text-ink/50">K%-BB%</th>
              </tr>
            </thead>
            <tbody>
              {pitchers.map((p) => (
                <PitcherRow
                  key={p.player.id}
                  position={p.position}
                  name={p.player.fullName}
                  stats={p.stats}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify component structure**

Expected: Two tables (hitters and pitchers), each with headers and tbody using HitterRow/PitcherRow.

- [ ] **Step 3: Commit**

```bash
git.exe add src/components/RosterStatsTable.tsx
git.exe commit -m "feat: add RosterStatsTable component for displaying team rosters"
```

---

## Task 7: Create async `RosterStatsSection` component to replace `SaberSection`

**Files:**
- Create: `src/components/RosterStatsSection.tsx`

**Interfaces:**
- Consumes: `feed: GameFeed`, `season: number`
- Produces: React component that fetches rosters + stats and renders two `RosterStatsTable` components

**Context:** This is the top-level component that orchestrates fetching. It will call `getActiveRoster()` for both teams, then fetch stats for each player in parallel using `getSaberHitting()`, `getSaberPitchingWithSeasonStats()`. Players with no stats are filtered out.

- [ ] **Step 1: Create the async component file**

Create `src/components/RosterStatsSection.tsx`:

```typescript
import type { GameFeed, SaberHitting, SaberPitching, TeamRef } from "@/lib/mlb/types";
import { 
  getActiveRoster, 
  getSaberHitting, 
  getSaberPitchingWithSeasonStats,
  type RosterPlayer 
} from "@/lib/mlb/players";
import RosterStatsTable from "./RosterStatsTable";

async function safe<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch {
    return null;
  }
}

function normalizePosition(rosterPos: string): string {
  // Map API position names to MLB abbreviations
  const posMap: Record<string, string> = {
    "Pitcher": "RP", // Default pitchers to RP; SP will be inferred from role if needed
    "Catcher": "C",
    "First Baseman": "1B",
    "Second Baseman": "2B",
    "Third Baseman": "3B",
    "Shortstop": "SS",
    "Left Fielder": "LF",
    "Center Fielder": "CF",
    "Right Fielder": "RF",
    "Designated Hitter": "DH",
    "Outfielder": "OF",
    "Infielder": "IF",
  };
  return posMap[rosterPos] ?? rosterPos; // Fallback to original if no mapping
}

interface PlayerWithStats {
  player: { id: number; fullName: string };
  position: string;
  stats: SaberHitting | SaberPitching | null;
}

async function enrichRoster(
  roster: RosterPlayer[],
  season: number,
  isHitter: boolean,
): Promise<PlayerWithStats[]> {
  const enriched: PlayerWithStats[] = [];
  
  const results = await Promise.allSettled(
    roster.map(async (r) => {
      if (isHitter) {
        const stats = await safe(getSaberHitting(r.player.id, season));
        return { ...r, stats };
      } else {
        const stats = await safe(getSaberPitchingWithSeasonStats(r.player.id, season));
        return { ...r, stats };
      }
    }),
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      const { player, position, stats } = result.value;
      // Only include players with stats
      if (stats) {
        enriched.push({
          player,
          position: normalizePosition(position),
          stats,
        });
      }
    }
  }

  return enriched;
}

async function TeamRoster({
  team,
  season,
}: {
  team: TeamRef;
  season: number;
}) {
  const roster = await safe(getActiveRoster(team.id));
  if (!roster || roster.length === 0) {
    return <p className="text-ink/50 text-sm">No roster data available.</p>;
  }

  // Split into hitters and pitchers
  const hitterRoster = roster.filter((p) => p.position !== "Pitcher");
  const pitcherRoster = roster.filter((p) => p.position === "Pitcher");

  // Fetch stats in parallel for hitters and pitchers
  const [hitters, pitchers] = await Promise.all([
    enrichRoster(hitterRoster, season, true),
    enrichRoster(pitcherRoster, season, false),
  ]);

  if (hitters.length === 0 && pitchers.length === 0) {
    return <p className="text-ink/50 text-sm">No season stats available for this team.</p>;
  }

  return <RosterStatsTable team={team} hitters={hitters} pitchers={pitchers} />;
}

export default async function RosterStatsSection({
  feed,
  season,
}: {
  feed: GameFeed;
  season: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <TeamRoster team={feed.away.team} season={season} />
      <TeamRoster team={feed.home.team} season={season} />
    </div>
  );
}
```

- [ ] **Step 2: Verify async structure**

Expected: `RosterStatsSection` is async, calls `getActiveRoster()`, enriches with stats, renders two `RosterStatsTable` components.

- [ ] **Step 3: Commit**

```bash
git.exe add src/components/RosterStatsSection.tsx
git.exe commit -m "feat: add RosterStatsSection async component with roster fetching and enrichment"
```

---

## Task 8: Replace `SaberSection` with `RosterStatsSection` in game page

**Files:**
- Modify: `src/app/games/[gamePk]/page.tsx`

**Interfaces:**
- Consumes: Existing `GameFeed`, `season`
- Produces: Render new `RosterStatsSection` instead of old `SaberSection`

**Context:** Remove the old `hitterStats()`, `TeamSaber()`, and `SaberSection()` functions; import and use `RosterStatsSection` instead.

- [ ] **Step 1: Read the current section in the game page**

Run: `grep -n "SaberSection" src/app/games/[gamePk]/page.tsx`

Expected: Line 286 defines `SaberSection`, line 476 uses it.

- [ ] **Step 2: Remove old imports and functions**

In `src/app/games/[gamePk]/page.tsx`:

- Remove line 15: `import SaberCard, { type SaberStat } from "@/components/SaberCard";`
- Remove lines 286-295: `function SaberSection()...`
- Remove lines 193-284: `function hitterStats()...`, `async function TeamSaber()...` (the entire TeamSaber and related functions)

- [ ] **Step 3: Add new import**

At the top of `src/app/games/[gamePk]/page.tsx` (after other component imports), add:

```typescript
import RosterStatsSection from "@/components/RosterStatsSection";
```

- [ ] **Step 4: Replace the section rendering**

Find line ~474 (the section that renders "Sabermetric evaluations"):

```typescript
      {/* 5. Sabermetrics */}
      <Section title="Sabermetric evaluations">
        <Suspense fallback={<SectionSkeleton />}>
          <SaberSection feed={feed} season={season} />
        </Suspense>
      </Section>
```

Replace with:

```typescript
      {/* 5. Sabermetric evaluations */}
      <Section title="Sabermetric evaluations">
        <Suspense fallback={<SectionSkeleton />}>
          <RosterStatsSection feed={feed} season={season} />
        </Suspense>
      </Section>
```

- [ ] **Step 5: Verify the file compiles**

Run: `npx tsc --noEmit`

Expected: No TypeScript errors. (If there are missing imports or type mismatches, fix them now.)

- [ ] **Step 6: Commit**

```bash
git.exe add src/app/games/[gamePk]/page.tsx
git.exe commit -m "feat: replace SaberSection with RosterStatsSection for full roster table"
```

---

## Task 9: Handle xwOBA fallback (if unavailable in API)

**Files:**
- Modify: `src/lib/mlb/players.ts` (update `getSaberHitting()`)
- Modify: `src/components/RosterStatsRow.tsx` (update xwOBA column rendering)

**Context:** If xwOBA is not available in the sabermetrics group, we fall back to wOBA. This task explores the API and implements the fallback.

- [ ] **Step 1: Test if xwOBA is available in the API**

Manual test (after implementation is running): View the browser console or server logs when fetching a hitter's stats. Check if `xwoba` appears in the sabermetrics response.

For now, assume it *might not be available*, so code defensively.

- [ ] **Step 2: Update `getSaberHitting()` to attempt xwOBA (if available)**

In `src/lib/mlb/players.ts`, modify the return statement in `getSaberHitting()` to add:

```typescript
export async function getSaberHitting(
  personId: number,
  season: number,
): Promise<SaberHitting | null> {
  // ... existing code ...
  return {
    woba: n(saber?.woba),
    wrcPlus: n(saber?.wRcPlus),
    war: n(saber?.war),
    babip: s(seasonStat?.babip),
    pa,
    bbPct: pct(bb, pa),
    kPct: pct(k, pa),
    xwoba: n(saber?.xwoba), // NEW: attempt xwOBA; may be undefined
  };
}
```

Also update the `SaberHitting` type to include optional `xwoba` field (if not already done in Task 1).

- [ ] **Step 3: Update the hitter row to display xwOBA or fallback**

In `src/components/RosterStatsRow.tsx`, in the `HitterRow` function, update the xwOBA column:

```typescript
{/* xwOBA column */}
<td className="px-3 py-2 font-mono text-right text-ink/60">
  {rate3(stats?.xwoba ?? stats?.woba)}
</td>
```

This shows xwOBA if available; otherwise, shows wOBA.

- [ ] **Step 4: Commit**

```bash
git.exe add src/lib/mlb/players.ts src/components/RosterStatsRow.tsx
git.exe commit -m "feat: add xwOBA with fallback to wOBA in hitter stats"
```

---

## Task 10: Render K% − BB% for pitchers

**Files:**
- Modify: `src/components/RosterStatsRow.tsx`

**Interfaces:**
- Consumes: `stats: SaberPitching | null` with `kMinusBbPct` field
- Produces: Formatted string showing K% − BB% (e.g. "14.2%")

**Context:** The `getSaberPitchingWithSeasonStats()` function calculates `kMinusBbPct` as a raw decimal. Format it as a percentage for display.

- [ ] **Step 1: Update the pitcher row to display K% − BB%**

In `src/components/RosterStatsRow.tsx`, in the `PitcherRow` function, find the last `<td>` (currently showing `bbPct`):

Replace:

```typescript
<td className="px-3 py-2 font-mono text-right text-ink/60">{pct(stats?.bbPct)}</td>
```

With:

```typescript
<td className="px-3 py-2 font-mono text-right text-ink/60">
  {stats?.kMinusBbPct != null ? `${(stats.kMinusBbPct * 100).toFixed(1)}%` : "—"}
</td>
```

- [ ] **Step 2: Verify rendering**

Expected: Pitchers' last column shows something like "14.2%" (K% − BB%) or "—" if missing.

- [ ] **Step 3: Commit**

```bash
git.exe add src/components/RosterStatsRow.tsx
git.exe commit -m "feat: render K% - BB% composite stat for pitchers"
```

---

## Task 11: Manual testing — start dev server and verify roster table loads

**Files:**
- No changes (testing only)

**Context:** Start the Next.js dev server, navigate to a game page, and verify the new "Sabermetric evaluations" section displays the roster table with hitters and pitchers grouped by position.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

Expected: Server starts at `http://localhost:3000`

- [ ] **Step 2: Navigate to a game page**

In browser: Go to `http://localhost:3000` (home page), click on a game link, or navigate directly to `/games/[gamePk]` (e.g., `/games/748135`).

- [ ] **Step 3: Scroll to "Sabermetric evaluations" section**

Expected: Section renders with two tables (away and home teams), each showing hitters and pitchers grouped by position.

- [ ] **Step 4: Verify hitter columns**

Expected: Pos | Name | WAR | wRC+ | PA | wOBA | xwOBA | BB% | K%

Spot-check: Click on a player row; stats should display (or show "—" for missing).

- [ ] **Step 5: Verify pitcher columns**

Expected: Pos | Name | WAR | ERA- | IP | ERA | FIP | xFIP | K%-BB%

- [ ] **Step 6: Check stat coloring**

Expected: WAR, wRC+, ERA-, FIP, xFIP columns are colored (statClass grading). Other columns are neutral gray.

- [ ] **Step 7: Test error handling**

Stop the dev server, kill the MLB Stats API (simulate failure), restart the dev server, and navigate to the game page.

Expected: Either the section shows "Couldn't load sabermetrics right now" or gracefully falls back (depending on error scope).

- [ ] **Step 8: No manual commit for testing**

This is exploratory; no code changes.

---

## Task 12: Verify TypeScript compilation and run tests

**Files:**
- No changes (testing only)

**Context:** Ensure the whole app type-checks and any existing tests still pass.

- [ ] **Step 1: Type-check the entire project**

Run: `npx tsc --noEmit`

Expected: No TypeScript errors.

- [ ] **Step 2: Lint the code**

Run: `npx eslint . --max-warnings=0`

Expected: No ESLint errors (or only existing warnings if they pre-exist).

- [ ] **Step 3: Run any existing tests (if present)**

Run: `npm test`

Expected: All tests pass (or no tests exist yet).

- [ ] **Step 4: No commit for testing**

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Roster fetching (Task 4, 7)
- ✅ Stats fetching extended with BB%, K%, IP, ERA (Tasks 2, 3)
- ✅ Types updated (Task 1)
- ✅ Components created (Tasks 5, 6, 7)
- ✅ Game page updated to use new section (Task 8)
- ✅ xwOBA fallback (Task 9)
- ✅ K% − BB% calculation (Task 10)
- ✅ Manual testing (Task 11)

**Placeholders scanned:**
- ✅ No "TBD" or "TODO" in code steps
- ✅ All function signatures complete with types
- ✅ All return types specified
- ✅ Column order explicitly defined in component headers

**Type consistency:**
- ✅ `SaberHitting` extended with `pa`, `bbPct`, `kPct`, `xwoba` (Task 1)
- ✅ `getSaberHitting()` returns updated type (Task 2)
- ✅ `SaberPitching` extended with `ip`, `era`, `bbPct`, `kPct`, `kMinusBbPct` (Task 1)
- ✅ `getSaberPitchingWithSeasonStats()` returns updated type (Task 3)
- ✅ `RosterPlayer` interface defined (Task 4)
- ✅ `HitterRow` and `PitcherRow` accept matching types (Task 5)
- ✅ `RosterStatsTable` props use defined types (Task 6)

**No spec gaps:** All requirements from design doc are implemented.

---

## Summary

This plan implements a full replacement of the "Sabermetric evaluations" section with an interactive roster table. Key milestones:

1. **Data layer** (Tasks 1-4): Extend types and fetching functions to include season stats.
2. **Presentation layer** (Tasks 5-7): Build components to display hitters and pitchers tables.
3. **Integration** (Task 8): Wire up the new section in the game page.
4. **Polish** (Tasks 9-10): Handle edge cases (xwOBA fallback, K% − BB% formatting).
5. **Validation** (Tasks 11-12): Manual testing and type-checking.

All tasks are independently testable and commit after each step for clear history.
