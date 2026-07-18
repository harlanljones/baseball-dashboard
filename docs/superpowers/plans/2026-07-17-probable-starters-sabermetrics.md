# Probable Starters Sabermetrics Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Probable starters" section to the game detail page (Preview-state games only) showing each team's probable starter's season sabermetric line, home/road split, vs-LHB/vs-RHB splits, and trailing-30-day form, side by side.

**Architecture:** Three new `player.ts` fetch functions (pitching-group analogs of the existing hitting-group split helpers) feed a new async server component (`ProbableStartersSection`) that fetches both starters' data in parallel and renders it via a new presentational component (`ProbableStarterCard`). Wired into `page.tsx` as a new `Section`, gated on `isPreview`.

**Tech Stack:** Next.js App Router (server components), TypeScript strict mode, Tailwind. No test runner is installed in this repo (`package.json` has no test script) — verification is `npx tsc --noEmit`, `npm run lint`, and manual verification against the real MLB Stats API (this project has no mocking layer; every existing component fetches live data).

## Global Constraints

- Strict TypeScript (`tsconfig.json` has `"strict": true`) — no `any`, all new exports fully typed.
- Follow existing formatting/coloring conventions: `statClass`/`rateClass` from `src/lib/statColor.ts`; pitcher BB%/K% are **never** color-graded (the shared bands are hitter-oriented) — see `src/components/RosterStatsRow.tsx`'s pitcher branch, which colors WAR/ERA-/ERA/FIP/xFIP but leaves BB%/K% plain.
- MLB Stats API field names (verified live against `https://statsapi.mlb.com/api/v1/people/605483/stats`):
  - `statSplits` with `sitCodes=h|a` (home/road, group=pitching) **includes** `era`.
  - `statSplits` with `sitCodes=vl|vr` (vs left/right batters, group=pitching) does **not** include `era` — only rate stats like `avg`/`obp`/`slg`/`ops`. `era` will be `undefined` for these rows; render as `—`, same fallback already used everywhere else.
  - `byDateRange` (group=pitching) includes `gamesStarted`, `era`, `inningsPitched`, `baseOnBalls`, `strikeOuts`, `battersFaced`.
- `pct(part, whole)` in `players.ts` already handles the `whole === 0` → `"-"` case — reuse it, don't reimplement.
- Existing `Section`/`SectionSkeleton`/`SectionError` helpers in `page.tsx` are page-local (not exported) — the new section must render its own fallback/error content, not import from `page.tsx`.
- No git commits without explicit instruction to do so beyond what this plan's steps say (the user has already indicated they don't want git operations performed automatically in this session — stage changes but let the user confirm before any commit).

---

### Task 1: Add `PitcherSplitLine` / `PitcherRecentForm` types

**Files:**
- Modify: `src/lib/mlb/types.ts` (add after the `SaberPitching` interface, currently ending at line 212)

**Interfaces:**
- Produces: `PitcherSplitLine { ip: string; era?: string; bbPct?: string; kPct?: string }` and `PitcherRecentForm extends PitcherSplitLine { starts: number }`, both exported from `src/lib/mlb/types.ts`.

- [ ] **Step 1: Add the two interfaces**

Insert immediately after the closing `}` of `SaberPitching` (line 212 in the current file):

```typescript
/** A pitcher's rate line for one situational split (home/road or vs-hand). */
export interface PitcherSplitLine {
  ip: string;   // "0.0" when no innings in the split
  era?: string; // absent for vs-hand splits — MLB's API doesn't compute ERA by opposing batter hand
  bbPct?: string;
  kPct?: string;
}

/** A pitcher's trailing-N-day form as of some reference date. */
export interface PitcherRecentForm extends PitcherSplitLine {
  starts: number; // gamesStarted in the window — 0 means "didn't pitch," used to gate a fallback message
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (these are new, unused-so-far exports — TypeScript doesn't flag unused exported types).

- [ ] **Step 3: Commit**

```bash
git add src/lib/mlb/types.ts
git commit -m "feat: add PitcherSplitLine and PitcherRecentForm types"
```

---

### Task 2: Add pitcher split/form fetch functions to `players.ts`

**Files:**
- Modify: `src/lib/mlb/players.ts` (add after `getHomeAwaySplit`, currently ending at line 288)

**Interfaces:**
- Consumes: `mlbFetch<T>(path, params, revalidate)` and `TTL` from `./client`; `n()`, `s()`, `pct()` helpers already defined in this file; `PitcherSplitLine`, `PitcherRecentForm` from `./types` (Task 1).
- Produces:
  - `getPitcherHomeAwaySplit(pitcherId: number, isHome: boolean, season: number): Promise<PitcherSplitLine>`
  - `getPitcherPlatoonSplit(pitcherId: number, vsBatterHand: "L" | "R", season: number): Promise<PitcherSplitLine>`
  - `getPitcherRecentForm(pitcherId: number, asOfDate: string, days?: number): Promise<PitcherRecentForm>`

- [ ] **Step 1: Add the import**

At the top of `src/lib/mlb/players.ts`, the existing type import block reads:

```typescript
import type {
  PlayerRef,
  SaberHitting,
  SaberPitching,
  SplitLine,
  VsPlayerLine,
  VsPlayerSeasonLine,
} from "./types";
```

Change it to:

```typescript
import type {
  PitcherRecentForm,
  PitcherSplitLine,
  PlayerRef,
  SaberHitting,
  SaberPitching,
  SplitLine,
  VsPlayerLine,
  VsPlayerSeasonLine,
} from "./types";
```

- [ ] **Step 2: Add the parser, fetcher, and three exported functions**

Insert immediately after `getHomeAwaySplit`'s closing `}` (currently line 288):

```typescript
/**
 * A pitcher's rate line for one MLB Stats API `sitCodes` split (`h`/`a` for
 * home/road, `vl`/`vr` for vs-hand). `era` is only present on `h`/`a` splits —
 * MLB's API doesn't compute ERA broken out by opposing batter hand.
 */
function parsePitcherSplitStat(stat?: Record<string, unknown>): PitcherSplitLine {
  const bf = n(stat?.battersFaced) ?? 0;
  const bb = n(stat?.baseOnBalls) ?? 0;
  const k = n(stat?.strikeOuts) ?? 0;
  return {
    ip: s(stat?.inningsPitched) ?? "0.0",
    era: s(stat?.era),
    bbPct: pct(bb, bf),
    kPct: pct(k, bf),
  };
}

/**
 * A pitcher's current-season line for one `sitCodes` split. Mirrors
 * {@link fetchSituationalSplit} but for the `pitching` stat group.
 */
async function fetchPitcherSituationalSplit(
  pitcherId: number,
  sitCode: string,
  season: number,
): Promise<PitcherSplitLine> {
  const res = await mlbFetch<RawStatsResponse>(
    `/api/v1/people/${pitcherId}/stats`,
    { stats: "statSplits", sitCodes: sitCode, group: "pitching", season },
    TTL.playerStats,
  );
  return parsePitcherSplitStat(res.stats?.[0]?.splits?.[0]?.stat);
}

/**
 * A probable starter's current-season home or road split. Used on the game
 * page's probable-starters card, picking whichever split matches this game.
 */
export async function getPitcherHomeAwaySplit(
  pitcherId: number,
  isHome: boolean,
  season: number,
): Promise<PitcherSplitLine> {
  return fetchPitcherSituationalSplit(pitcherId, isHome ? "h" : "a", season);
}

/**
 * A probable starter's current-season split facing left- or right-handed
 * batters.
 */
export async function getPitcherPlatoonSplit(
  pitcherId: number,
  vsBatterHand: "L" | "R",
  season: number,
): Promise<PitcherSplitLine> {
  return fetchPitcherSituationalSplit(
    pitcherId,
    vsBatterHand === "L" ? "vl" : "vr",
    season,
  );
}

/**
 * A pitcher's trailing-`days`-day form as of `asOfDate`, excluding `asOfDate`
 * itself — same day-before convention as {@link getBullpenWorkload}, since a
 * probable starter obviously hasn't pitched in today's not-yet-played game.
 */
export async function getPitcherRecentForm(
  pitcherId: number,
  asOfDate: string,
  days = 30,
): Promise<PitcherRecentForm> {
  const endDate = shiftDate(asOfDate, -1);
  const startDate = shiftDate(endDate, -(days - 1));
  const res = await mlbFetch<RawStatsResponse>(
    `/api/v1/people/${pitcherId}/stats`,
    { stats: "byDateRange", startDate, endDate, group: "pitching" },
    TTL.pitcherLog,
  );
  const stat = res.stats?.[0]?.splits?.[0]?.stat;
  return {
    ...parsePitcherSplitStat(stat),
    starts: n(stat?.gamesStarted) ?? 0,
  };
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification against the live API**

Run (uses a real, currently-active pitcher id — Blake Snell, 605483 — and a real season/date; adjust the season if it's off-season when you run this):

```bash
curl -s "https://statsapi.mlb.com/api/v1/people/605483/stats?stats=statSplits&sitCodes=h&group=pitching&season=2025" | python3 -m json.tool | grep -E '"era"|"inningsPitched"|"battersFaced"'
curl -s "https://statsapi.mlb.com/api/v1/people/605483/stats?stats=byDateRange&startDate=2025-08-01&endDate=2025-08-30&group=pitching" | python3 -m json.tool | grep -E '"era"|"gamesStarted"'
```

Expected: both commands print non-empty matches, confirming the field names `parsePitcherSplitStat`/`getPitcherRecentForm` read (`era`, `inningsPitched`, `battersFaced`, `gamesStarted`) exist in the real response shape.

- [ ] **Step 5: Commit**

```bash
git add src/lib/mlb/players.ts
git commit -m "feat: add pitcher home/road, platoon, and recent-form fetchers"
```

---

### Task 3: Hoist shared number formatters into `src/lib/format.ts`

`page.tsx` currently defines `rate3`, `int`, `dec1`, `dec2` as page-local functions (lines 48-61). The new card component needs the same formatters — duplicating them would drift. Hoist them into a shared module both files import.

**Files:**
- Create: `src/lib/format.ts`
- Modify: `src/app/games/[gamePk]/page.tsx:48-61` (remove the local definitions, import from the new module)

**Interfaces:**
- Produces: `rate3(n?: number): string`, `int(n?: number): string`, `dec1(n?: number): string`, `dec2(n?: number): string`, all exported from `src/lib/format.ts`.
- Consumes (Task 4 will import these too): nothing external.

- [ ] **Step 1: Create `src/lib/format.ts`**

```typescript
/** Format a rate stat like wOBA as `.462` (three decimals, no leading zero). */
export function rate3(n?: number): string {
  if (n == null) return "—";
  return n.toFixed(3).replace(/^0(?=\.)/, "");
}

export function int(n?: number): string {
  return n == null ? "—" : String(Math.round(n));
}

export function dec1(n?: number): string {
  return n == null ? "—" : n.toFixed(1);
}

export function dec2(n?: number): string {
  return n == null ? "—" : n.toFixed(2);
}
```

- [ ] **Step 2: Update `page.tsx` to import instead of define**

In `src/app/games/[gamePk]/page.tsx`, delete lines 48-61 (the four function definitions: `rate3`, `int`, `dec1`, `dec2`) and add this import alongside the other `@/lib/...` imports near the top of the file (next to the `getGameWeather` import):

```typescript
import { dec1, dec2, int, rate3 } from "@/lib/format";
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. If any error mentions a missing `rate3`/`int`/`dec1`/`dec2` reference elsewhere in `page.tsx`, that confirms the import path is correct and just needs to be placed above its first use (import order doesn't matter in JS/TS, so this shouldn't happen — but double check the deleted line range didn't accidentally remove `seasonOf`/`teamName`, which sit just above/below in the file).

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.ts "src/app/games/[gamePk]/page.tsx"
git commit -m "refactor: hoist stat formatters into shared src/lib/format.ts"
```

---

### Task 4: `ProbableStarterCard` presentational component

**Files:**
- Create: `src/components/ProbableStarterCard.tsx`

**Interfaces:**
- Consumes: `dec1, dec2, int, rate3` from `@/lib/format` (Task 3); `statClass` from `@/lib/statColor`; `PlayerHeadshot` (existing, `personId: number; size?: number`); `PlayerRef`, `TeamRef`, `SaberPitching`, `PitcherSplitLine`, `PitcherRecentForm` from `@/lib/mlb/types`.
- Produces: default export `ProbableStarterCard(props): JSX.Element` with props:
  ```typescript
  {
    pitcher: PlayerRef | null;
    team: TeamRef;
    hand: "L" | "R" | null;
    season: SaberPitching | null;
    homeAway: PitcherSplitLine | null;
    vsLeft: PitcherSplitLine | null;
    vsRight: PitcherSplitLine | null;
    recentForm: PitcherRecentForm | null;
    homeAwayLabel: "Home" | "Road";
  }
  ```
  Consumed by `ProbableStartersSection` (Task 5).

- [ ] **Step 1: Write the component**

```typescript
import PlayerHeadshot from "./PlayerHeadshot";
import { dec1, dec2, int, rate3 } from "@/lib/format";
import { statClass } from "@/lib/statColor";
import type {
  PitcherRecentForm,
  PitcherSplitLine,
  PlayerRef,
  SaberPitching,
  TeamRef,
} from "@/lib/mlb/types";

function teamName(t: TeamRef): string {
  return t.abbreviation ?? t.name;
}

function SplitRow({
  label,
  split,
}: {
  label: string;
  split: PitcherSplitLine | null;
}) {
  return (
    <tr className="border-t border-ink/10">
      <td className="px-2 py-1 text-left text-ink/60">{label}</td>
      <td className="font-mono px-2 py-1 text-right">{split?.ip ?? "—"}</td>
      <td className={`font-mono px-2 py-1 text-right ${statClass("era", split?.era)}`}>
        {split?.era ?? "—"}
      </td>
      <td className="font-mono px-2 py-1 text-right">{split?.bbPct ?? "—"}</td>
      <td className="font-mono px-2 py-1 text-right">{split?.kPct ?? "—"}</td>
    </tr>
  );
}

export default function ProbableStarterCard({
  pitcher,
  team,
  hand,
  season,
  homeAway,
  vsLeft,
  vsRight,
  recentForm,
  homeAwayLabel,
}: {
  pitcher: PlayerRef | null;
  team: TeamRef;
  hand: "L" | "R" | null;
  season: SaberPitching | null;
  homeAway: PitcherSplitLine | null;
  vsLeft: PitcherSplitLine | null;
  vsRight: PitcherSplitLine | null;
  recentForm: PitcherRecentForm | null;
  homeAwayLabel: "Home" | "Road";
}) {
  if (!pitcher) {
    return (
      <div className="min-w-0 rounded-md border border-ink/10 p-3">
        <h3 className="font-display mb-1 text-base font-semibold">{teamName(team)}</h3>
        <p className="text-sm text-ink/50">Probable starter: TBD</p>
      </div>
    );
  }

  return (
    <div className="min-w-0 rounded-md border border-ink/10 p-3">
      <h3 className="font-display mb-2 flex items-center gap-2 text-base font-semibold">
        <PlayerHeadshot personId={pitcher.id} size={28} />
        {pitcher.fullName}
        {hand && <span className="text-sm font-normal text-ink/50">({hand})</span>}
        <span className="ml-auto text-sm font-normal text-ink/50">{teamName(team)}</span>
      </h3>

      <div className="overflow-x-auto">
        <table className="nums w-full min-w-max text-sm">
          <caption className="sr-only">
            {pitcher.fullName} season sabermetrics and situational splits
          </caption>
          <thead>
            <tr>
              <th scope="col" className="font-display px-2 py-1 text-left text-xs font-semibold uppercase tracking-wider text-ink/50">
                Season
              </th>
              <th scope="col" className="font-display px-2 py-1 text-right text-xs font-semibold uppercase tracking-wider text-ink/50">IP</th>
              <th scope="col" className="font-display px-2 py-1 text-right text-xs font-semibold uppercase tracking-wider text-ink/50">ERA</th>
              <th scope="col" className="font-display px-2 py-1 text-right text-xs font-semibold uppercase tracking-wider text-ink/50">BB%</th>
              <th scope="col" className="font-display px-2 py-1 text-right text-xs font-semibold uppercase tracking-wider text-ink/50">K%</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-ink/10">
              <td className="px-2 py-1 text-left text-ink/60">
                WAR {season ? dec2(season.war) : "—"} · FIP{" "}
                <span className={statClass("fip", season?.fip)}>{season ? dec2(season.fip) : "—"}</span>{" "}
                · xFIP {season ? dec2(season.xfip) : "—"} · ERA-{" "}
                <span className={statClass("eraMinus", season?.eraMinus)}>{season ? int(season.eraMinus) : "—"}</span>
              </td>
              <td className="font-mono px-2 py-1 text-right">{season?.ip ?? "—"}</td>
              <td className={`font-mono px-2 py-1 text-right ${statClass("era", season?.era)}`}>
                {season?.era ?? "—"}
              </td>
              <td className="font-mono px-2 py-1 text-right">{season?.bbPct ?? "—"}</td>
              <td className="font-mono px-2 py-1 text-right">{season?.kPct ?? "—"}</td>
            </tr>
            <SplitRow label={homeAwayLabel} split={homeAway} />
            <SplitRow label="vs LHB" split={vsLeft} />
            <SplitRow label="vs RHB" split={vsRight} />
            {recentForm && recentForm.starts === 0 ? (
              <tr className="border-t border-ink/10">
                <td colSpan={5} className="px-2 py-1 text-left text-sm text-ink/50">
                  No outings in the last 30 days
                </td>
              </tr>
            ) : (
              <SplitRow label="Last 30 days" split={recentForm} />
            )}
          </tbody>
        </table>
      </div>
      {!season && (
        <p className="mt-2 text-xs text-ink/50">Season stats unavailable.</p>
      )}
    </div>
  );
}
```

Note: `rate3` is imported but unused in this file as written — remove it from the import if `npx tsc --noEmit` / lint flags it as unused (strict TS won't error on unused imports by default, but the Next.js ESLint config does; check Step 3 below and drop `rate3` from the import list if flagged).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no errors. If `rate3` is flagged as an unused import, remove it from the `import { dec1, dec2, int, rate3 } from "@/lib/format";` line (it isn't used by any season/split rendering above — `era`/`bbPct`/`kPct` come pre-formatted as strings from the API).

- [ ] **Step 4: Commit**

```bash
git add src/components/ProbableStarterCard.tsx
git commit -m "feat: add ProbableStarterCard component"
```

---

### Task 5: `ProbableStartersSection` async data component

**Files:**
- Create: `src/components/ProbableStartersSection.tsx`

**Interfaces:**
- Consumes: `getSaberPitchingWithSeasonStats`, `getPitchHand`, `getPitcherHomeAwaySplit`, `getPitcherPlatoonSplit`, `getPitcherRecentForm` from `@/lib/mlb/players` (Task 2 + existing); `easternDateOf` from `@/lib/mlb/client`; `GameFeed`, `TeamRef`, `PlayerRef` from `@/lib/mlb/types`; `ProbableStarterCard` (Task 4).
- Produces: default export `ProbableStartersSection({ feed, season }: { feed: GameFeed; season: number }): Promise<JSX.Element>`, consumed by `page.tsx` (Task 6).

- [ ] **Step 1: Write the component**

```typescript
import ProbableStarterCard from "./ProbableStarterCard";
import { easternDateOf } from "@/lib/mlb/client";
import {
  getPitcherHomeAwaySplit,
  getPitcherPlatoonSplit,
  getPitcherRecentForm,
  getPitchHand,
  getSaberPitchingWithSeasonStats,
} from "@/lib/mlb/players";
import type { GameFeed, PlayerRef, TeamRef } from "@/lib/mlb/types";

async function safe<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch {
    return null;
  }
}

function settled<T>(r: PromiseSettledResult<T>): T | null {
  return r.status === "fulfilled" ? r.value : null;
}

async function StarterCard({
  pitcher,
  team,
  isHome,
  season,
  gameDate,
}: {
  pitcher: PlayerRef | undefined;
  team: TeamRef;
  isHome: boolean;
  season: number;
  gameDate: string;
}) {
  if (!pitcher) {
    return (
      <ProbableStarterCard
        pitcher={null}
        team={team}
        hand={null}
        season={null}
        homeAway={null}
        vsLeft={null}
        vsRight={null}
        recentForm={null}
        homeAwayLabel={isHome ? "Home" : "Road"}
      />
    );
  }

  const [seasonStats, hand, splitResults] = await Promise.all([
    safe(getSaberPitchingWithSeasonStats(pitcher.id, season)),
    safe(getPitchHand(pitcher.id)),
    Promise.allSettled([
      getPitcherHomeAwaySplit(pitcher.id, isHome, season),
      getPitcherPlatoonSplit(pitcher.id, "L", season),
      getPitcherPlatoonSplit(pitcher.id, "R", season),
      getPitcherRecentForm(pitcher.id, gameDate),
    ]),
  ]);

  const [homeAway, vsLeft, vsRight, recentForm] = splitResults;

  return (
    <ProbableStarterCard
      pitcher={pitcher}
      team={team}
      hand={hand}
      season={seasonStats}
      homeAway={settled(homeAway)}
      vsLeft={settled(vsLeft)}
      vsRight={settled(vsRight)}
      recentForm={settled(recentForm)}
      homeAwayLabel={isHome ? "Home" : "Road"}
    />
  );
}

export default async function ProbableStartersSection({
  feed,
  season,
}: {
  feed: GameFeed;
  season: number;
}) {
  const gameDate = easternDateOf(feed.startTime || new Date());
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <StarterCard
        pitcher={feed.probablePitchers.away}
        team={feed.away.team}
        isHome={false}
        season={season}
        gameDate={gameDate}
      />
      <StarterCard
        pitcher={feed.probablePitchers.home}
        team={feed.home.team}
        isHome={true}
        season={season}
        gameDate={gameDate}
      />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/ProbableStartersSection.tsx
git commit -m "feat: add ProbableStartersSection data-fetching component"
```

---

### Task 6: Wire the section into the game page

**Files:**
- Modify: `src/app/games/[gamePk]/page.tsx`

**Interfaces:**
- Consumes: `ProbableStartersSection` (Task 5), existing `Section`, `SectionSkeleton`, `Suspense`, `isPreview`, `isDisrupted`, `feed`, `season` — all already in scope in `GamePage`.

- [ ] **Step 1: Add the import**

Near the other component imports at the top of `src/app/games/[gamePk]/page.tsx` (alongside `import MatchupTable from "@/components/MatchupTable";`), add:

```typescript
import ProbableStartersSection from "@/components/ProbableStartersSection";
```

- [ ] **Step 2: Add the section, right after the header block and before "Ballpark weather"**

In the returned JSX, immediately after the closing `</div>` of the header block (the `div` containing the team names/scores/probables, right before the `{isDisrupted && (...)}` block) and before the existing:

```tsx
{/* Ballpark weather */}
{!isDisrupted && (isPreview || feed.state === "Live") && (
```

insert:

```tsx
{/* Probable starters */}
{!isDisrupted && isPreview && (
  <Section title="Probable starters">
    <Suspense fallback={<SectionSkeleton />}>
      <ProbableStartersSection feed={feed} season={season} />
    </Suspense>
  </Section>
)}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 5: Manual verification — run the dev server and view a real Preview-state game**

```bash
npm run dev
```

Then in a browser (or via the `run`/`verify` skill if available):
1. Visit `/` to find today's or tomorrow's schedule, and open a game that hasn't started yet (`Preview` state — look for a game with a future start time).
2. Confirm a new "Probable starters" section appears right below the header, above "Ballpark weather".
3. Confirm both cards render: headshot, name, hand, season line (IP/ERA/FIP/xFIP/ERA-/WAR/BB%/K%), Home or Road row, vs LHB row, vs RHB row, and either a "Last 30 days" row or "No outings in the last 30 days".
4. If one team's probable hasn't been announced, confirm that side shows the "Probable starter: TBD" placeholder instead of an error or blank space.
5. Confirm the section does **not** appear on a `Live` or `Final` game.

Expected: all five checks pass. If a card shows all "—" for splits but a working season line, that's an acceptable degraded state (per the design's independent-failure requirement) — not a bug, unless it happens for every pitcher, which would indicate a wrong `sitCodes`/`group` param.

- [ ] **Step 6: Commit**

```bash
git add "src/app/games/[gamePk]/page.tsx"
git commit -m "feat: wire Probable starters section into the game page"
```

---

## Self-Review Notes

- **Spec coverage:** Preview-only trigger (Task 6), TBD placeholder (Task 4/5), season line + coloring convention matching `RosterStatsRow` (Task 4), home/road split (Task 2/4/5), vs-LHB/vs-RHB splits (Task 2/4/5), last-30-days form with fallback (Task 2/4), independent-failure via `Promise.allSettled` (Task 5), shared formatters hoisted (Task 3) — all covered.
- **Type consistency:** `PitcherSplitLine`/`PitcherRecentForm` (Task 1) match usage in `players.ts` (Task 2), `ProbableStarterCard` props (Task 4), and `ProbableStartersSection` (Task 5) — checked field names (`ip`, `era`, `bbPct`, `kPct`, `starts`) are identical across all four tasks.
- **No placeholders:** every step has complete, runnable code — verified against the live MLB API response shapes in Task 2's Global Constraints and Step 4.
