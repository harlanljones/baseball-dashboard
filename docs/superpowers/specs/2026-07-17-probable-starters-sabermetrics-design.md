---
title: Probable Starters Sabermetrics Section
date: 2026-07-17
author: Claude
status: draft
---

# Probable Starters Sabermetrics Section

## Overview

Add a dedicated "Probable starters" section to the game detail page that gives a
detailed sabermetric profile of each team's probable starting pitcher: season
line, home/road split, vs-handedness split, and last-30-days form. Shown only
for `Preview`-state games, placed right after the game header (before ballpark
weather / boxscore / etc.).

This goes beyond what's already on the page today: the header shows just the
probable's name + headshot, and the existing "Sabermetric evaluations" section
shows season-long SP stats buried in a full-roster table. This section is a
focused, at-a-glance comparison of the two starters.

## Requirements

- **Trigger:** `feed.state === "Preview" && !isDisrupted`
- **Visibility:** Render even if one or both probables are `TBD` — render a
  placeholder card for the missing side rather than omitting the section.
- **Layout:** Two cards side by side (`grid grid-cols-1 lg:grid-cols-2`, same
  pattern as `MatchupSection`), away on the left, home on the right — mirrors
  the away/home ordering used elsewhere on the page.
- **Each card shows:**
  1. Headshot, full name, team, throwing hand (e.g. "R")
  2. Season line: IP, ERA, FIP, xFIP, ERA-, WAR, BB%, K% — same
     `getSaberPitchingWithSeasonStats` call and `statClass` coloring
     convention already used in `RosterStatsRow`'s pitcher branch (BB%/K% are
     **not** colored there, for the same reason — the shared `kPct`/`bbPct`
     bands are hitter-oriented, so leave them uncolored for pitchers here too)
  3. Home/Road split (IP, ERA, BB%, K%) — whichever applies to this game
     (home split if this pitcher's team is home, road split if away)
  4. vs-LHB and vs-RHB splits (IP, ERA, BB%, K%) — both shown, one row each
  5. Last-30-days form (IP, ERA, BB%, K%, GS) — trailing 30-day window ending
     the day before the game date, matching the `getBullpenWorkload` pattern
     of excluding same-day data. Shows "No outings in the last 30 days"
     instead of a zeroed line when the pitcher hasn't appeared in the window.
- **Independent failure:** Splits/form are fetched with `Promise.allSettled`
  per pitcher so one bad lookup shows "—" for that row only, not a blanked
  card. The season line uses the existing `safe()` wrapper; if it fails, show
  "—" throughout the season-line row but still attempt splits/form.
- **TBD probable:** Card shows team name + "Probable starter: TBD", no stat
  rows, no fetches attempted for that side.

## Data Model

New fields needed beyond the existing `SaberPitching` type. Reusing
`SaberPitching` for the season line; new types for splits/form:

```typescript
/** A pitcher's rate line for one situational split (home/road or vs-hand). */
export interface PitcherSplitLine {
  ip: string;   // "0.0" when no innings in the split
  era?: string;
  bbPct?: string;
  kPct?: string;
}

/** A pitcher's trailing-N-day form. */
export interface PitcherRecentForm extends PitcherSplitLine {
  starts: number; // gamesStarted in the window, used to gate the "no outings" fallback
}
```

Both live in `src/lib/mlb/types.ts` near `SaberPitching`.

## Implementation

### `src/lib/mlb/players.ts` — new fetch functions

Follows the existing `fetchSituationalSplit` pattern (currently hardcoded to
`group: "hitting"`), but for pitchers:

```typescript
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

/** A pitcher's current-season home or road split. */
export async function getPitcherHomeAwaySplit(
  pitcherId: number,
  isHome: boolean,
  season: number,
): Promise<PitcherSplitLine> {
  return fetchPitcherSituationalSplit(pitcherId, isHome ? "h" : "a", season);
}

/** A pitcher's current-season split facing left- or right-handed batters. */
export async function getPitcherPlatoonSplit(
  pitcherId: number,
  vsBatterHand: "L" | "R",
  season: number,
): Promise<PitcherSplitLine> {
  return fetchPitcherSituationalSplit(pitcherId, vsBatterHand === "L" ? "vl" : "vr", season);
}

/**
 * A pitcher's trailing-30-day form as of `asOfDate` (exclusive of `asOfDate`
 * itself, matching getBullpenWorkload's day-before convention). `days`
 * defaults to 30.
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

### `src/components/ProbableStarterCard.tsx` — presentational

Props: `{ pitcher: PlayerRef | null; team: TeamRef; isHome: boolean; hand: "L" | "R" | null; season: SaberPitching | null; homeAway: PitcherSplitLine | null; vsLeft: PitcherSplitLine | null; vsRight: PitcherSplitLine | null; recentForm: PitcherRecentForm | null }`.

- `pitcher === null` → render the TBD placeholder card and return early.
- Otherwise render headshot/name/hand header, a season-line stat row (reusing
  the same `dec1`/`dec2`/`rate3`/`int`-style formatters already defined in
  `page.tsx` — hoist those into a shared `src/lib/format.ts` since both
  `page.tsx` and this new component need them, avoiding duplicated formatting
  logic), then three labeled split rows using `statClass("era", …)` for
  coloring (BB%/K% uncolored, per the design decision above).
- Recent-form row: if `recentForm.starts === 0`, render "No outings in the
  last 30 days" instead of the stat row.

### `src/components/ProbableStartersSection.tsx` — async data-fetching

Server component, same shape as `RosterStatsSection.tsx`:

```typescript
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
      <StarterCard side="away" feed={feed} season={season} gameDate={gameDate} />
      <StarterCard side="home" feed={feed} season={season} gameDate={gameDate} />
    </div>
  );
}
```

`StarterCard` (internal async function, mirrors `BullpenSection`'s
`withBullpenStats` helper pattern):
- Reads `feed.probablePitchers[side]`; if absent, renders
  `<ProbableStarterCard pitcher={null} team={feed[side].team} ... />`.
- Otherwise fetches in parallel:
  - `safe(getSaberPitchingWithSeasonStats(id, season))`
  - `safe(getPitchHand(id))`
  - `Promise.allSettled([getPitcherHomeAwaySplit(id, side === "home", season), getPitcherPlatoonSplit(id, "L", season), getPitcherPlatoonSplit(id, "R", season), getPitcherRecentForm(id, gameDate)])`
- Passes everything to `ProbableStarterCard`.

### `src/app/games/[gamePk]/page.tsx`

Add the section immediately after the header block, before the
ballpark-weather section:

```tsx
{!isDisrupted && isPreview && (
  <Section title="Probable starters">
    <Suspense fallback={<SectionSkeleton />}>
      <ProbableStartersSection feed={feed} season={season} />
    </Suspense>
  </Section>
)}
```

## Edge Cases

- Both probables TBD → section still renders, both cards show the TBD
  placeholder (useful early in the day before either is announced).
- Pitcher has never faced a batter of one hand this season (tiny IP) → split
  still renders with the season's actual (possibly near-zero) IP; no special
  casing beyond the existing "—" fallback for missing/unparseable values.
- Pitcher recently activated from IL / call-up with zero games in the last 30
  days → "No outings in the last 30 days" fallback via the `starts` field.
- `getSaberPitchingWithSeasonStats` fails but splits succeed (or vice versa) →
  each row degrades independently; no single failure blanks the whole card.

## Scope

- New types: `PitcherSplitLine`, `PitcherRecentForm` (`types.ts`)
- New fetch functions: `getPitcherHomeAwaySplit`, `getPitcherPlatoonSplit`,
  `getPitcherRecentForm` (`players.ts`)
- New shared formatter module: `src/lib/format.ts` (hoisted from `page.tsx`)
- New components: `ProbableStarterCard.tsx`, `ProbableStartersSection.tsx`
- One new `Section` block wired into `page.tsx`
- No API route changes, no database changes
- ~250-300 lines of new code
