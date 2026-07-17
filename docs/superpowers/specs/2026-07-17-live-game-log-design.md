---
title: Live Game Log with Inning-Grouped Significant Events
date: 2026-07-17
author: Claude
status: draft
---

# Live Game Log with Inning-Grouped Significant Events

## Overview

When a game is in progress (`state === "Live"`), hide pitchers' batting lines from the boxscore table (keep their pitching stats) and add a new "Game log" section after the boxscore that displays significant plays grouped by inning.

## Requirements

### Pitcher Removal from Batting Boxscore
- **Trigger:** Only when `feed.state === "Live"`
- **Behavior:** Filter out pitchers' batting lines, but keep pitchers' pitching stats table intact
- **Implementation:** Add `isLive` boolean prop to `BoxscoreTables` component

### Game Log Display
- **Data source:** MLB API's play-by-play (`/api/v1.1/game/{gamePk}/feed/live` endpoint)
- **Significant events:** Runs scored, stolen bases, caught stealing, errors, sacrifices, wild pitches, balks
- **Organization:** Group by inning, then by Top/Bottom half
- **Display:** One card per inning with nested list of plays, running score after each play
- **Placement:** After boxscore in the game detail page
- **Loading:** Lazy-loaded via Suspense (independent of boxscore fetch)
- **Visibility:** Show when game is scored (`scored && !isDisrupted` conditions)

## Data Model

### ScoringPlay Type

```typescript
export interface ScoringPlay {
  inning: number;              // 1-based
  ordinal: string;             // "Top" | "Bottom"
  batter?: PlayerRef;          // Who was batting
  pitcher?: PlayerRef;         // Who was pitching
  description: string;         // Human-readable event from API
  eventType: ScoringPlayEventType;
  awayScore: number;           // Score after this play
  homeScore: number;
}

export type ScoringPlayEventType =
  | "home_run"
  | "single" | "double" | "triple"  // only if RBI
  | "stolen_base"
  | "caught_stealing"
  | "error"
  | "sacrifice_bunt" | "sacrifice_fly"
  | "wild_pitch" | "passed_ball"
  | "balk";
```

### Inferred from API

The MLB Stats API `feed/live` endpoint includes `liveData.plays[]`, where each play has:
- `about.inning` (number) and `about.halfInning` ("Top" or "Bottom")
- `result.eventType` (e.g., "home_run", "single", "stolen_base_2b", "caught_stealing_2b", "error", "balk")
- `result.description` (human-readable string)
- `playEvents[].details.description` (pitch-level detail)
- Nested `runners[]` with `homeTeamRuns` / `awayTeamRuns` after the play completes

## Implementation Architecture

### Data Layer (`src/lib/mlb/game.ts`)

**New function:**
```typescript
export async function getGamePlays(gamePk: number): Promise<ScoringPlay[]>
```

- Fetch `/api/v1.1/game/{gamePk}/feed/live`
- Parse `liveData.plays[]`
- Filter for significant events (event types listed above)
- Map to `ScoringPlay[]`
- Sort by inning/half (natural order from API)
- Cache with `TTL.live` (same as boxscore)

**Event type mapping logic:**
- Look up `result.eventType` from API
- Match against known significant-event patterns (home_run, stolen_base_*, caught_stealing_*, error, sacrifice_*, balk, wild_pitch, passed_ball)
- Extract batter/pitcher IDs from the play result
- Use running score (`homeTeamRuns`/`awayTeamRuns`) after the play

### Component Layer

**Modify `BoxscoreTables.tsx`:**
- Add `isLive?: boolean` prop (default `false`)
- Before rendering batters, filter: `batters.filter(b => !isLive || !pitcherIds.includes(b.id))`
- Keep pitchers table unchanged

**New `GameLog.tsx` component:**
- Receives `plays: ScoringPlay[]`
- Groups plays into a map: `Map<inning, Map<ordinal, ScoringPlay[]>>`
- Renders one card per inning (e.g., "Top 1", "Bottom 1")
- Within each card, lists plays with:
  - Event description
  - Running score in monospace (e.g., "1-0 Away")
- Simple styling: reuse Section component pattern or similar card style

**New `GameLogSection.tsx` async component:**
- Server component that calls `getGamePlays(gamePk)`
- Returns `<GameLog plays={plays} />` or error boundary
- Wrapped in Suspense in the page

### Page Integration (`src/app/games/[gamePk]/page.tsx`)

**BoxscoreTables call:**
```tsx
<BoxscoreTables 
  away={feed.boxscore.away} 
  home={feed.boxscore.home}
  isLive={feed.state === "Live"}
/>
```

**New GameLog section:**
```tsx
{scored && !isDisrupted && (
  <Section title="Game log">
    <Suspense fallback={<SectionSkeleton />}>
      <GameLogSection feed={feed} />
    </Suspense>
  </Section>
)}
```

Place this section immediately after the boxscore.

## UI/UX Details

### GameLog Layout

```
┌────────────────────────────────────┐
│ Top 1                              │
├────────────────────────────────────┤
│ • Batter Name: Single        │ 1-0 Away  │
│ • Pitcher Name: Hit by pitch │ 1-1 Away  │
└────────────────────────────────────┘
┌────────────────────────────────────┐
│ Bottom 1                           │
├────────────────────────────────────┤
│ • Batter Name: Home run      │ 1-1 Tied  │
└────────────────────────────────────┘
```

- Card styling matches existing Section component
- Play items as bullet points
- Description text left-aligned
- Score right-aligned in monospace
- Each inning is its own folding unit (optional: could add collapse/expand, but start simple)

### Edge Cases

- **No significant plays in an inning:** Don't render that inning's card
- **Extra innings:** Continue the pattern (Top 10, Bottom 10, etc.)
- **Game still in progress:** Refresh via auto-refresh (existing mechanism)
- **Missing batter/pitcher data:** Still show description, just no player links

## Testing Strategy

1. **Unit:** `getGamePlays()` with mocked MLB API response
2. **Component:** `GameLog` with mock `ScoringPlay[]` array
3. **E2E:** Load a live game page, verify boxscore hides pitcher batting lines and game log appears with correct plays

## Scope

- Adds ~150-200 lines of new code (types, fetch, component)
- No database changes
- No API changes (uses existing feed endpoint)
- Optional future: add player links in game log (not in MVP)
